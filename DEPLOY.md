# Personal Health Manager — Full Deployment Guide

## Prerequisites
- Node.js 18+ and npm
- Supabase project (free tier works)
- Supabase CLI (optional — migrations can be run via SQL Editor)
- OpenAI API key (for AI Health Summary feature)
- Netlify / Vercel account (or any static host)

---

## Step 1 — Clone / extract

Unzip `phm-full-deploy.zip` into a folder, then:

```bash
cd personal-health-manager
npm install
```

---

## Step 2 — Create your Supabase project

1. Go to https://supabase.com → New project
2. Note your **Project URL** and **anon public key** (Settings → API)

---

## Step 3 — Set environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your values:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Step 4 — Run migrations (in order)

Open the Supabase **SQL Editor** and run each file below in sequence.
Each file is idempotent (`IF NOT EXISTS`, `DROP … IF EXISTS`) — safe to re-run.

| Order | File |
|-------|------|
| 1 | `supabase/migrations/20260925125838_0001_profiles_and_infrastructure.sql` |
| 2 | `supabase/migrations/20260925125938_0002_health_tracking_tables.sql` |
| 3 | `supabase/migrations/20260925130017_0003_nutrition_tables.sql` |
| 4 | `supabase/migrations/20260925130104_0004_medical_sharing_devices_ai_audit.sql` |
| 5 | `supabase/migrations/20260925130147_0005_fix_security_advisor_findings.sql` |
| 6 | `supabase/migrations/20260925130207_0006_revoke_public_execute.sql` |
| 7 | `supabase/migrations/20260925130651_0007_auto_create_profile_on_signup.sql` |
| 8 | `supabase/migrations/20260925150000_0008_family_profiles.sql` |
| 9 | `supabase/migrations/20260925160000_0009_dashboard_and_checkin_fields.sql` |
| 10 | `supabase/migrations/20260925170000_0010_activities_and_goals.sql` |
| 11 | `supabase/migrations/20260925180000_0011_nutrition_enhancements.sql` |
| 12 | `supabase/migrations/20260925190000_0012_medical_documents_phase9.sql` |
| 13 | `supabase/migrations/20260925200000_0013_document_sharing_phase10.sql` |
| 14 | `supabase/migrations/20260925210000_0014_wearable_groundwork.sql` |

---

## Step 5 — Create storage bucket

In Supabase → Storage → New bucket:
- Name: `medical-documents`
- **Public: OFF** (private — critical for security)

---

## Step 6 — Deploy the AI Edge Function

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Link to your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set the OpenAI secret
supabase secrets set OPENAI_API_KEY=sk-your-key-here

# Deploy
supabase functions deploy health-summary --no-verify-jwt=false
```

> The Edge Function is at `supabase/functions/health-summary/index.ts`
> If you skip this step, the AI Summary page shows an error — all other features work normally.

---

## Step 7 — Build and deploy the frontend

### Local preview
```bash
npm run dev
```
Open http://localhost:5173

### Production build
```bash
npm run build
# Output in dist/
```

### Deploy to Netlify (recommended)
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Deploy to Vercel
```bash
npm install -g vercel
vercel --prod
```

Add a redirect rule so React Router works on direct URLs:
- **Netlify**: create `public/_redirects` with: `/* /index.html 200`
- **Vercel**: add to `vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

---

## Step 8 — Enable email auth in Supabase

Supabase Dashboard → Authentication → Providers → Email → Enable

Optionally configure SMTP (Settings → Auth → SMTP) for real password-reset emails.

---

## Verification checklist

- [ ] Sign up / login works
- [ ] Dashboard loads after demo data seeded
- [ ] Check-in form saves and reflects on dashboard
- [ ] Documents upload and download via signed URL
- [ ] Sharing page creates and lists share links
- [ ] AI Summary returns a result (requires Edge Function + OpenAI key)
- [ ] Dark/light mode toggle persists on reload

---

## Features included (Phases 1–14)

| Phase | Feature |
|-------|---------|
| 1–3 | Auth, database schema, RLS, basic structure |
| 4 | Family profiles + profile switcher |
| 5 | Dashboard + daily check-ins |
| 6 | Activity tracking + goals |
| 7 | Health timeline |
| 8 | Nutrition & food logging |
| 9 | Medical document repository (private storage, signed URLs) |
| 10 | Secure document sharing schema |
| 11 | AI Health Summary (OpenAI via Edge Function) |
| 12 | Security verification pass |
| 13 | Wearable groundwork (provider abstraction, sync badges) |
| 14 | Automated unit tests (38 tests) |
| Design A | Clinical Command dark/light theme, colourful sidebar |
| Sharing | Full working share link create/revoke/delete UI |

---

## Tech stack

- React 18 + TypeScript + Vite
- Tailwind CSS (darkMode: 'class') + Manrope font
- Supabase (Postgres + Auth + Storage + Edge Functions)
- Radix UI primitives + class-variance-authority
- Lucide React icons
- Vitest unit tests (38 tests)
