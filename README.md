# School Portal

A modern MVP for student program applications and faculty review, built with React, Vite, Tailwind CSS, and shadcn-style UI components.

## Quick start

```bash
cd school-portal
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Demo accounts

| Role      | Email                 | Password   |
|-----------|-----------------------|------------|
| Applicant | `student@school.edu`  | Any 6+ chars |
| Reviewer  | `reviewer@school.edu` | Any 6+ chars |

Applicants can also create a new account at `/signup`.

## Routes

- `/` — Landing page
- `/login?role=applicant` — Applicant login (with sign-up link)
- `/login?role=reviewer` — Reviewer login (no sign-up)
- `/signup` — Applicant registration
- `/applicant` — Applicant dashboard (protected)
- `/reviewer` — Reviewer dashboard (protected)

## Supabase (Lovable)

Add your project credentials in the Lovable sidebar or a local `.env` file:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Auth state listeners in `src/lib/supabase.ts` and `src/lib/portal-store.tsx` will sync sessions when credentials are present. Until then, the app uses localStorage mock auth.
