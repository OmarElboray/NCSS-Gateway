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
  program?: string;
  title?: string;
  student_name?: string;
  is_anonymous?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

  try {
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    if (webhookSecret) {
      const incoming = req.headers.get("x-webhook-secret");
      if (incoming !== webhookSecret) {
        return json({ error: "Unauthorized webhook" }, 401);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const smtpEmail = Deno.env.get("SMTP_EMAIL");
    const smtpAppPassword = Deno.env.get("SMTP_APP_PASSWORD");
    const portalUrl = Deno.env.get("PORTAL_URL") ?? "https://ncssgateway.vercel.app/reviewer-dashboard";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    if (!smtpEmail || !smtpAppPassword) {
      throw new Error("Missing SMTP_EMAIL or SMTP_APP_PASSWORD secrets");
    }

    const body = (await req.json()) as WebhookPayload & SubmissionRecord;
    const record = body.record ?? body;
    const program = record.program?.trim();

    if (!program) {
      return json({ error: "No program on submission record" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: reviewers, error: queryError } = await supabase
      .from("profiles")
      .select("email, full_name, expertise_programs")
      .eq("role", "reviewer")
      .contains("expertise_programs", [program]);

    if (queryError) {
      throw queryError;
    }

    const emails = (reviewers ?? [])
      .map((r) => r.email?.trim())
      .filter((e): e is string => Boolean(e));

    if (emails.length === 0) {
      return json({
        ok: true,
        program,
        emailsSent: 0,
        message: "No reviewers matched this program expertise.",
      });
    }

    const title = record.title ?? "New application";
    const anonymousNote = record.is_anonymous
      ? " (submitted with blind review — student identity is hidden)"
      : "";

    const dashboardUrl = `${portalUrl.replace(/\/$/, "")}/reviewer-dashboard`;
    const subject = `New ${program} application — review needed`;
    const plainText = [
      "New application needs your review",
      "",
      `A new application for ${program} has just been submitted and needs your review.${anonymousNote}`,
      "",
      `Essay title: ${title}`,
      "",
      `Open reviewer dashboard: ${dashboardUrl}`,
      "",
      `You received this because ${program} is listed in your expertise on School Portal.`,
    ].join("\n");

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; line-height: 1.5;">
        <h2 style="color: #1e3a5f;">New application needs your review</h2>
        <p>A new application for <strong>${escapeHtml(program)}</strong> has just been submitted and needs your review.${escapeHtml(anonymousNote)}</p>
        <p><strong>Essay title:</strong> ${escapeHtml(title)}</p>
        <p style="margin-top: 24px;">
          <a href="${escapeHtml(dashboardUrl)}"
             style="background: #1e3a5f; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
            Open reviewer dashboard
          </a>
        </p>
        <p style="color: #64748b; font-size: 12px; margin-top: 32px;">
          You received this because ${escapeHtml(program)} is listed in your expertise on School Portal.
        </p>
      </div>
    `;

    transporter = nodemailer.createTransport({
      host: GMAIL_SMTP_HOST,
      port: GMAIL_SMTP_PORT,
      secure: true,
      auth: {
        user: smtpEmail,
        pass: smtpAppPassword,
      },
    });

    const sentTo: string[] = [];
    const failed: { email: string; error: string }[] = [];

    for (const recipient of emails) {
      try {
        await transporter.sendMail({
          from: smtpEmail,
          to: recipient,
          subject,
          text: plainText,
          html,
        });
        sentTo.push(recipient);
      } catch (sendErr) {
        const message = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.error(`SMTP send failed for ${recipient}:`, message);
        failed.push({ email: recipient, error: message });
      }
    }

    transporter.close();
    transporter = null;

    if (sentTo.length === 0) {
      return json(
        {
          error: "All SMTP sends failed",
          program,
          failed,
        },
        502
      );
    }

    return json({
      ok: true,
      program,
      emailsSent: sentTo.length,
      recipients: sentTo,
      ...(failed.length > 0 ? { partialFailures: failed } : {}),
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
