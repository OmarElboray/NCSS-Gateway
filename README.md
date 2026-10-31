# NCSS Gateway

NCSS Gateway is a role-based application portal for educational programs. It supports the application lifecycle from student submission through faculty review and status updates.

## Features

### Applicants

- Create an account and sign in with Supabase Auth.
- Submit, edit, and track applications.
- Request blind review to reduce exposure of identifying information.

### Reviewers and administrators

- Role-aware routes and dashboards.
- Review submissions and provide feedback.
- Update application status.
- Bulk-invite reviewers and administrators.

## Tech stack

- React and TypeScript
- Vite
- React Router
- Tailwind CSS
- Supabase Auth and PostgreSQL
- Supabase Edge Functions for server-side notifications
- Vercel Analytics

## Local development

### Prerequisites

- Node.js and npm
- A Supabase project

### Setup

```bash
git clone https://github.com/OmarElboray/NCSS-Gateway.git
cd NCSS-Gateway
npm install
```

Create `.env.local` with the Supabase values used by the application, for example:

```dotenv
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Project structure

```text
NCSS-Gateway/
├── src/
│   ├── App.tsx       # Application routes and UI
│   ├── main.tsx      # React entry point
│   └── index.css     # Global styles
├── docs/             # Operational setup notes
├── public/           # Static assets
├── index.html
└── vite.config.ts
```

## Security

Keep Supabase Row Level Security enabled and never commit service-role keys or SMTP credentials. Frontend environment variables are not secret; authorization must be enforced by Supabase policies and server-side functions.
