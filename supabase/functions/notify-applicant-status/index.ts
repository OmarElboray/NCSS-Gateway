import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: SubmissionRecord;
}

interface SubmissionRecord {
  id?: string;
  title?: string;
  status?: string;
  student_email?: string; // Updated to match your actual database column!
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

  try {
    // 1. Validate Webhook Secret
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    if (webhookSecret) {
      const incoming = req.headers.get("x-webhook-secret");
      if (incoming !== webhookSecret) {
        return json({ error: "Unauthorized webhook" }, 401);
      }
    }

    // 2. Fetch Secrets
    const smtpEmail = Deno.env.get("SMTP_EMAIL");
    const smtpAppPassword = Deno.env.get("SMTP_APP_PASSWORD");
    const portalUrl = Deno.env.get("PORTAL_URL") ?? "https://ncss-gateway.vercel.app";

    if (!smtpEmail || !smtpAppPassword) {
      throw new Error("Missing SMTP_EMAIL or SMTP_APP_PASSWORD secrets");
    }

    // 3. Parse Webhook Payload Safely
    const bodyText = await req.text();
    if (!bodyText) {
      return json({ error: "Empty request body" }, 400);
    }
    
    const body = JSON.parse(bodyText) as WebhookPayload & SubmissionRecord;
    const record = body.record ?? body;
    
    const status = record.status?.trim() || "Updated";
    const title = record.title?.trim() || "Your application";
    
    // THE FIX: We are now explicitly pulling the student_email column
    const applicantEmail = record.student_email?.trim();

    if (!applicantEmail) {
      console.error("Payload missing email. Received data:", JSON.stringify(record));
      return json({ error: "No student_email found in submission record" }, 400);
    }

    // 4. Prepare Email Content
    const dashboardUrl = `${portalUrl.replace(/\/$/, "")}/applicant-dashboard`;
    const subject = `Application Status Update: ${status}`;
    
    const plainText = [
      "Application Status Update",
      "",
      `Hello,`,
      "",
      `Your application "${title}" has been updated to: ${status}`,
      "",
      `View the full details on your dashboard: ${dashboardUrl}`,
      "",
      "Thank you,",
      "NCSS Gateway Admissions",
    ].join("\n");

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; line-height: 1.5; color: #1e293b;">
        <h2 style="color: #1e3a5f;">Application Status Update</h2>
        <p>Hello,</p>
        <p>Your application <strong>"${escapeHtml(title)}"</strong> has been updated to: <strong style="color: #0f172a; background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(status)}</strong>.</p>
        <p style="margin-top: 24px;">
          <a href="${escapeHtml(dashboardUrl)}"
             style="background: #1e3a5f; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; display: inline-block;">
            View Dashboard
          </a>
        </p>
        <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          This is an automated message from the NCSS Gateway. Please do not reply directly to this email.
        </p>
      </div>
    `;

    // 5. Send Email
    transporter = nodemailer.createTransport({
      host: GMAIL_SMTP_HOST,
      port: GMAIL_SMTP_PORT,
      secure: true,
      auth: {
        user: smtpEmail,
        pass: smtpAppPassword,
      },
    });

    await transporter.sendMail({
      from: `"NCSS Gateway" <${smtpEmail}>`,
      to: applicantEmail,
      subject,
      text: plainText,
      html,
    });

    transporter.close();
    transporter = null;

    return json({
      ok: true,
      status,
      emailsSent: 1,
      recipient: applicantEmail,
    });

  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  } finally {
    if (transporter) {
      transporter.close();
    }
  }
});

// Helper Functions
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}