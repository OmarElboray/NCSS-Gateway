# Admin bulk reviewer invite

Locked to **gtr92876@gmail.com** on both the React app and the `bulk-invite-reviewers` Edge Function.

## Deploy the Edge Function

```bash
supabase functions deploy bulk-invite-reviewers
```

Do **not** pass `--no-verify-jwt` — JWT verification must stay enabled.

Optional secret (defaults to `gatewayncss` if unset):

```bash
supabase secrets set BULK_INVITE_DEFAULT_PASSWORD=gatewayncss
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

## Use the dashboard

1. Sign in to the portal with **gtr92876@gmail.com**.
2. Open **Admin dashboard** from the home page (link only visible to that email).
3. Paste reviewer emails (one per line) and click **Bulk Add Reviewers**.

New accounts are created with `email_confirm: true` and `profiles.role = reviewer`.

## Security

| Layer | Check |
|-------|--------|
| Frontend | `AdminRoute` + `isAdminEmail()` — others redirected to `/` |
| Edge Function | `auth.getUser()` on caller JWT — non-admin gets **403** |
| Password | Only set server-side; never sent from the browser |
