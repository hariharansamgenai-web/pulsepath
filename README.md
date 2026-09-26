# Personal Health Manager

A production-oriented personal health management application for tracking daily check-ins, exercise, nutrition, goals, medical documents, and AI-powered health summaries.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v3
- **Routing**: React Router v6
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- **AI**: OpenAI API (via Supabase Edge Functions, server-side only)
- **Icons**: lucide-react

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment example file and fill in your Supabase project credentials:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your Supabase URL and anon key. These values are pre-populated in the hosted environment — only needed for local development.

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking only |

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` (browser-safe) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env` (browser-safe) | Supabase anon key (safe with RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | hosted env (server only) | Used by Edge Functions |
| `SUPABASE_DB_URL` | hosted env (server only) | Direct database connection |
| `OPENAI_API_KEY` | Supabase secret | Used by AI Edge Functions |

**Never commit your `.env` file.** The `.gitignore` already excludes it.

## Project Structure

```
src/
├── main.tsx                  # App entry point
├── App.tsx                   # Root component (providers + router)
├── index.css                 # Tailwind + design tokens
├── lib/
│   ├── supabase.ts           # Supabase client singleton
│   └── utils.ts              # Shared utility functions
├── types/
│   └── index.ts              # Domain type definitions
├── context/
│   └── AuthContext.tsx       # Auth session state + methods
├── components/
│   ├── ui/                   # Reusable UI primitives
│   ├── layout/               # App layout (sidebar, topbar)
│   ├── feedback/             # Error, loading, empty states
│   └── common/               # Shared feature components
├── pages/
│   ├── auth/                 # Login & Register
│   ├── Dashboard.tsx         # (placeholder)
│   ├── CheckIns.tsx          # (placeholder)
│   ├── Exercise.tsx          # (placeholder)
│   ├── Goals.tsx             # (placeholder)
│   ├── Nutrition.tsx         # (placeholder)
│   ├── Documents.tsx         # (placeholder)
│   ├── Timeline.tsx          # (placeholder)
│   ├── Sharing.tsx           # (placeholder)
│   ├── Family.tsx            # (placeholder)
│   ├── Profile.tsx           # (placeholder)
│   ├── AISummary.tsx         # (placeholder)
│   └── NotFound.tsx          # 404 page
└── routes/
    ├── index.tsx             # Router configuration
    └── ProtectedRoute.tsx    # Auth guard
```

## Current Status — Phase 1 (Foundation)

This phase established the project foundation with no business logic. What's included:

- **UI kit**: Button, Input, Textarea, Select, Card, Modal, Badge, Avatar, ProgressBar, Spinner
- **Feedback components**: ErrorBoundary, Loading, EmptyState, ErrorState
- **Layout**: Responsive sidebar (collapsible on mobile), top bar with user menu, content area
- **Routing**: All routes defined with auth-protected wrapper; placeholder pages for future features
- **Auth scaffold**: AuthContext with sign-in/sign-up/sign-out methods; login and register pages
- **Supabase client**: Configured singleton reading from environment variables
- **Design system**: Custom Tailwind color ramps (primary, secondary, accent, success, warning, error, neutral), Inter font, consistent spacing, subtle animations

### How to verify the foundation works

1. Run `npm run build` — should complete without errors
2. Run `npm run typecheck` — should pass with no type errors
3. Run `npm run dev` and open the browser:
   - `/login` shows the sign-in page
   - `/register` shows the sign-up page
   - All other routes redirect to `/login` (protected)
   - The 404 page shows for unknown routes

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture plan covering database schema, RLS policies, Edge Functions, OpenAI integration, and the phased implementation roadmap.

## Security

- Supabase Row Level Security (RLS) will be enforced on every database table
- Medical documents stored in private Supabase Storage buckets
- OpenAI API key never exposed to the browser — only used in Edge Functions
- No secrets hard-coded in the codebase

## Phase 4 — Family profiles

- Migration `supabase/migrations/20260925150000_0008_family_profiles.sql`:
  - **Fixes RLS on all health tables** (restores `EXECUTE` on `user_owns_profile` for `authenticated`; without it every health-table query fails with *permission denied*).
  - Adds `height_cm`, `weight_kg`, relationships `mother` / `father`, one `self` profile per account, self profile can't be deleted, private `avatars` storage bucket.
- The active profile lives in `ActiveProfileContext` (`useActiveProfile()`). Every health page must read `activeProfile.id` and filter by `profile_id`. Pages remount on profile switch, so no data from the previous profile lingers.
- Isolation tests: run `supabase/tests/profile_isolation.sql` in the SQL Editor. It creates two throwaway users, runs 16 checks, prints `PASS …`, and rolls everything back.
