import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "gtr92876@gmail.com";

interface InviteRequest {
  emails?: string[];
}

interface InviteFailure {
  email: string;
  error: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const defaultPassword = Deno.env.get("BULK_INVITE_DEFAULT_PASSWORD") ?? "gatewayncss";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Missing Supabase environment configuration");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !caller) {
      return json({ error: "Invalid or expired session" }, 401);
    }

    const callerEmail = caller.email?.trim().toLowerCase();
    if (callerEmail !== ADMIN_EMAIL.toLowerCase()) {
      return json({ error: "Forbidden: admin access only" }, 403);
    }

    const body = (await req.json()) as InviteRequest;
    const emails = normalizeEmails(body.emails ?? []);

    if (emails.length === 0) {
      return json({ error: "No valid email addresses provided" }, 400);
    }

    if (emails.length > 100) {
      return json({ error: "Maximum 100 emails per request" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const created: string[] = [];
    const updated: string[] = [];
    const failed: InviteFailure[] = [];

    for (const email of emails) {
      try {
        const outcome = await ensureReviewerAccount(admin, email, defaultPassword);
        if (outcome === "created") created.push(email);
        else updated.push(email);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed.push({ email, error: message });
      }
    }

    return json({ created, updated, failed });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

async function ensureReviewerAccount(
  admin: ReturnType<typeof createClient>,
  email: string,
  password: string
): Promise<"created" | "updated"> {
  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "reviewer",
      full_name: email.split("@")[0],
    },
  });

  if (!createError && createData.user) {
    await upsertReviewerProfile(admin, createData.user.id, email);
    return "created";
  }

  const message = createError?.message ?? "";
  const alreadyExists =
    message.toLowerCase().includes("already") ||
    message.toLowerCase().includes("registered") ||
    message.toLowerCase().includes("exists");

  if (!alreadyExists) {
    throw new Error(message || "Failed to create user");
  }

  const userId = await resolveAuthUserId(admin, email);
  if (!userId) {
    throw new Error("User exists in Auth but could not be resolved by email");
  }

  await upsertReviewerProfile(admin, userId, email);
  return "updated";
}

async function upsertReviewerProfile(
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string
) {
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      role: "reviewer",
      full_name: email.split("@")[0],
      expertise_programs: [],
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`Profile upsert failed: ${error.message}`);
  }
}

async function resolveAuthUserId(
  admin: ReturnType<typeof createClient>,
  email: string
): Promise<string | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profile?.id) {
    return profile.id as string;
  }

  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw new Error(`listUsers failed: ${error.message}`);
    }
    const match = data.users.find((u) => u.email?.trim().toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) break;
    page += 1;
  }

  return null;
}

function normalizeEmails(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const item of raw) {
    const email = item.trim().toLowerCase();
    if (!email || seen.has(email) || !emailRe.test(email)) continue;
    seen.add(email);
    result.push(email);
  }

  return result;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
