# Reviewer Expertise Routing (Supabase + Gmail SMTP)

This guide wires automatic email notifications to reviewers who have expertise in the program an applicant applied to.

> **Security:** Never commit passwords. Store `SMTP_APP_PASSWORD` only in Supabase Edge Function secrets.

---

## Step 1 — Database schema

Run the migration in **Supabase Dashboard → SQL Editor**:

`supabase/migrations/20260519120000_reviewer_expertise_routing.sql`

Or with the CLI:

```bash
supabase db push
```

---

## Step 2 — Frontend (already implemented)

- **Reviewer dashboard → “My Expertise”** — saves `expertise_programs` to Supabase
- **Applicant submit** — inserts into `submissions` (fires the webhook)

Requires in Lovable / `.env`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Step 3 — Edge Function (Gmail SMTP via nodemailer)

The function uses `npm:nodemailer` (not `deno.land/x/smtp`) so it runs on the current Supabase Deno runtime.

Deploy from the project root:

```bash
cd school-portal
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy notify-matching-reviewers --no-verify-jwt
```

### Remove old Resend secrets

```bash
supabase secrets unset RESEND_API_KEY
supabase secrets unset RESEND_FROM_EMAIL
```

### Add Gmail SMTP secrets

```bash
supabase secrets set SMTP_EMAIL=yourname@gmail.com
supabase secrets set SMTP_APP_PASSWORD=your16charapppassword
supabase secrets set PORTAL_URL=https://your-deployed-portal.com
supabase secrets set WEBHOOK_SECRET=choose-a-long-random-string
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

---

## Step 4 — Gmail App Password (free, no custom domain)

1. Create or use a **Google Account** (free Gmail).
2. Turn on **2-Step Verification**: [Google Account → Security](https://myaccount.google.com/security).
3. Open **App passwords**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
4. Select app **Mail**, device **Other (Custom name)** → e.g. `School Portal`.
5. Click **Generate** — Google shows a **16-character password** (often grouped like `abcd efgh ijkl mnop`).
6. Copy it **without spaces** into `SMTP_APP_PASSWORD`.

Emails are sent **from** your `SMTP_EMAIL` address **to** each matched reviewer’s email. No custom domain required.

**Limits:** Free Gmail allows roughly **500 emails/day**. Fine for school MVP volume.

---

## Step 5 — Database Webhook

1. **Supabase Dashboard** → **Database** → **Webhooks**
2. **Create webhook**
3. Table: `submissions` | Events: **Insert**
4. Destination: Edge Function `notify-matching-reviewers`
5. Header: `x-webhook-secret` = your `WEBHOOK_SECRET`

---

## Step 6 — Test

1. Reviewer: save expertise for a program (e.g. YYGS).
2. Applicant: submit an essay for that program.
3. Check **Edge Functions → Logs** and the reviewer inbox (spam folder too).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Deno.writeAll is not a function` | Redeploy after updating to the nodemailer-based function |
| `Invalid login` | Regenerate App Password; no spaces in secret |
| `Missing SMTP_*` | Run `supabase secrets set` and redeploy |
| No emails | Verify `expertise_programs` matches program string exactly |
| Webhook 401 | Match `x-webhook-secret` header |
| Gmail blocked send | Ensure 2FA + App Password (not your normal Gmail password) |
