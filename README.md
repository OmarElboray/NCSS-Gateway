# 🎓 NCSS Application Portal

A secure, role-based application management system designed for educational programs. This portal streamlines the entire application lifecycle, from student submissions to faculty reviews, featuring blind-review capabilities and automated email notifications.

## ✨ Key Features

**For Applicants:**
* **Seamless Authentication:** Passwordless/secure login with persistent browser sessions.
* **Application Management:** Submit, edit, and track the status of essays in real-time.
* **Blind Review Option:** Applicants can choose to mask their PII (Personally Identifiable Information) from reviewers for unbiased evaluation.

**For Reviewers & Admins:**
* **Role-Based Access Control (RBAC):** Strict routing and dashboard protection based on user roles (`applicant`, `reviewer`, `admin`).
* **Evaluation Dashboard:** Read submissions, leave detailed feedback, and update statuses (Accepted, Rejected, Revision Requested).
* **Bulk Invites:** Admin tools to parse and bulk-invite faculty members securely.

**Infrastructure & Architecture:**
* **Custom SMTP Pipeline:** Bypasses standard rate limits using a custom Edge Function webhook and Google App Passwords for guaranteed email delivery.
* **Automated Webhooks:** Database triggers automatically fire serverless Edge Functions to notify students when their application status changes.
* **"Bouncer" Pattern Security:** Frontend route protection that verifies Supabase auth tokens before rendering sensitive dashboards.

## 🛠️ Tech Stack

* **Frontend:** React, React Router, Tailwind CSS, shadcn/ui
* **Backend & Database:** Supabase (PostgreSQL)
* **Authentication:** Supabase Auth 
* **Serverless:** Deno Edge Functions (Supabase)
* **Hosting:** Vercel

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed and a [Supabase](https://supabase.com/) account.

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/OmarElboray/NCSS-Gateway.git](https://github.com/OmarElboray/NCSS-Gateway.git)
   cd ncss-application-portal
Install dependencies:

Bash
npm install
Set up Environment Variables:
Create a .env.local file in the root directory and add your Supabase credentials:

Code snippet
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
Start the development server:

Bash
npm run dev
Deploying Edge Functions
If you are modifying the backend email triggers, you will need the Supabase CLI installed to push updates to the Edge Functions:

Bash
npx supabase functions deploy notify-applicant-status --no-verify-jwt
🔒 Security Notes
This project utilizes Supabase's Row Level Security (RLS) policies to ensure that applicants can only view their own submissions, while reviewers can access the global queue. Environment variables and SMTP credentials are encrypted and stored in the Supabase Vault.

📄 License
This project is licensed under the MIT License.
