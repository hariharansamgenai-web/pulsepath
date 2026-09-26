# Personal Health Manager — Architecture Plan

## 1. Overall Application Architecture

A single-page React application (Vite + TypeScript + Tailwind) that talks directly to Supabase for auth, database, and storage. AI features route through Supabase Edge Functions, which call the OpenAI API server-side so the API key never reaches the browser.

```
┌─────────────────────────────────────────────────┐
│                 Browser (SPA)                    │
│   React + TypeScript + Tailwind + React Router   │
│                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│   │  Pages    │  │ UI Kit   │  │ Auth Context │  │
│   └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        │             │               │           │
│        └─────────────┴───────────────┘           │
│                      │                           │
│              ┌───────┴────────┐                  │
│              │ Supabase Client │                  │
│              └───────┬────────┘                  │
└──────────────────────┼──────────────────────────┘
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
    ┌──────────┐ ┌──────────┐ ┌────────────────┐
    │   Auth   │ │ Postgres │ │   Edge Funcs   │
    │(GoTrue)  │ │  + RLS   │ │  (Deno)        │
    └──────────┘ └──────────┘ └───────┬────────┘
                                         │
                                         ▼
                                  ┌────────────┐
                                  │  OpenAI API │
                                  └────────────┘
```

## 2. Frontend Architecture

- **Framework**: React 18 + TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS v3 with a custom design token system (CSS variables for color ramps, spacing, typography)
- **Routing**: React Router v6 (data routers / createBrowserRouter)
- **State**: React Context for auth/session; local component state + Supabase realtime subscriptions for data
- **Data fetching**: `@supabase/supabase-js` client; queries colocated in feature modules, not a global store
- **Icons**: `lucide-react`
- **Form handling**: Controlled components with lightweight validation (no heavy form library unless the complexity demands it later)

### Folder Structure

```
src/
├── main.tsx                  # App entry
├── App.tsx                   # Router + providers
├── index.css                 # Tailwind layers + design tokens
├── lib/
│   ├── supabase.ts           # Supabase client
│   └── utils.ts              # cn() and small helpers
├── types/
│   └── index.ts              # Shared domain types
├── context/
│   └── AuthContext.tsx       # Session + profile state
├── components/
│   ├── ui/                   # Generic primitives (Button, Input, Card, Modal…)
│   ├── layout/               # AppLayout, Sidebar, TopBar
│   ├── feedback/             # ErrorBoundary, Loading, EmptyState, ErrorState
│   └── common/               # Shared feature components
├── pages/
│   ├── auth/                 # Login, Register
│   ├── Dashboard.tsx
│   ├── CheckIns.tsx
│   ├── Exercise.tsx
│   ├── Goals.tsx
│   ├── Nutrition.tsx
│   ├── Documents.tsx
│   ├── Timeline.tsx
│   ├── Sharing.tsx
│   ├── Family.tsx
│   ├── Profile.tsx
│   ├── AISummary.tsx
│   └── NotFound.tsx
└── routes/
    ├── ProtectedRoute.tsx    # Auth guard
    └── index.tsx             # Route config
```

## 3. Supabase Architecture

- **Auth**: Supabase Auth (GoTrue) with email/password only. No magic links, no social providers (per MVP spec). Email confirmation OFF for dev; can be enabled for production.
- **Database**: PostgreSQL with RLS enabled on every table.
- **Storage**: Supabase Storage for medical document uploads, with private buckets and per-user folder paths.
- **Edge Functions**: Deno-based functions for OpenAI calls. `verify_jwt: true` on all AI-related functions. CORS headers mandatory on all responses.
- **Realtime**: Optionally subscribe to data changes (e.g., shared profiles updates) — not MVP-critical but architecturally ready.

## 4. Authentication Architecture

- Email + password only (MVP).
- Session managed by `@supabase/supabase-js`; `onAuthStateChange` listener updates the React AuthContext.
- AuthContext exposes: `session`, `user`, `profile`, `loading`, `signIn`, `signUp`, `signOut`.
- `ProtectedRoute` wraps all authenticated pages; redirects to `/login` when no session.
- Public routes: `/login`, `/register`.
- No role-based access control in MVP — all authenticated users have the same capabilities. Ownership is enforced per-row via RLS (`auth.uid() = user_id`).

## 5. Database Architecture

All tables have `id` (UUID PK, `gen_random_uuid()`), `created_at`, `updated_at` (trigger-maintained). All tables enable RLS.

### Core Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `profiles` | Extended user info | `id` (FK→auth.users), `display_name`, `avatar_url`, `date_of_birth`, `sex`, `created_at` |
| `family_members` | Family profiles the user manages | `id`, `owner_id` (FK→profiles), `name`, `relationship`, `date_of_birth`, `sex`, `avatar_url` |
| `check_ins` | Daily health check-in | `id`, `user_id`, `family_member_id` (nullable), `date`, `mood`, `energy_level`, `sleep_hours`, `notes` |
| `exercises` | Activity/exercise log | `id`, `user_id`, `family_member_id` (nullable), `date`, `activity_type`, `duration_min`, `intensity`, `calories_burned`, `notes` |
| `goals` | Health goals | `id`, `user_id`, `family_member_id` (nullable), `title`, `category`, `target_value`, `current_value`, `unit`, `status` (active/completed/abandoned), `target_date` |
| `nutrition_logs` | Food/diet log | `id`, `user_id`, `family_member_id` (nullable), `date`, `meal_type`, `food_name`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `notes` |
| `documents` | Medical document metadata | `id`, `user_id`, `family_member_id` (nullable), `file_name`, `file_path` (storage path), `mime_type`, `file_size`, `category`, `description`, `uploaded_at` |
| `timeline_events` | Health timeline entries | `id`, `user_id`, `family_member_id` (nullable), `event_date`, `title`, `description`, `category`, `source_type` (manual/check_in/exercise/goal/document) |
| `shares` | Secure sharing records | `id`, `owner_id`, `shared_with_email`, `resource_type`, `resource_id`, `permissions` (read/write), `expires_at`, `status` (pending/active/revoked) |
| `ai_summaries` | Cached AI-generated summaries | `id`, `user_id`, `summary_text`, `period_start`, `period_end`, `generated_at`, `data_hash` |

### Key Design Decisions

- **`family_member_id` is nullable** on all health-data tables so entries can belong to the user directly or to a family member.
- **`timeline_events`** can be auto-generated from other tables via DB triggers (future) or manually created. MVP: manual + app-level creation on check-in/exercise/etc.
- **`shares`** uses email-based sharing (no separate user accounts required for recipients in MVP). The share record grants scoped access.
- **`ai_summaries`** caches results keyed by a data hash so we don't re-call OpenAI for unchanged data.

## 6. Family/Profile Architecture

- Every authenticated user has exactly one `profiles` row (created on signup via a trigger or app-level callback).
- A user can create `family_members` rows — they own and manage these.
- Health data (check-ins, exercises, nutrition, documents, goals, timeline) can reference either the user themselves (`user_id` only) or a family member (`user_id` + `family_member_id`).
- RLS: the `owner_id` of a family_member row controls who can CRUD it. Health-data rows are scoped to `user_id` (the account holder), not to `family_member_id`, so the account holder retains ownership of all data they log — even data about a family member.

## 7. Storage Architecture

- **Bucket**: `medical-documents` (private, not public).
- **Path convention**: `{user_id}/{document_id}/{original_filename}`.
- RLS storage policies: users can only read/write objects whose path prefix matches their `auth.uid()`.
- Upload flow: client generates document metadata row → gets `document_id` → uploads file to storage at `{user_id}/{document_id}/{filename}` → updates row with `file_path`.
- File size limits enforced at app level (e.g., 10 MB) and mime-type allowlist (PDF, images: png/jpg/jpeg/webp, text).

## 8. RLS / Security Architecture

Every table has RLS enabled with four policies (SELECT, INSERT, UPDATE, DELETE), each scoped to `TO authenticated` and using `auth.uid()` for ownership checks.

General pattern:
- **SELECT**: `USING (auth.uid() = user_id)` — user sees only their own rows.
- **INSERT**: `WITH CHECK (auth.uid() = user_id)` — user can only insert rows owned by themselves.
- **UPDATE**: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` — user can only update their own rows, and cannot reassign ownership.
- **DELETE**: `USING (auth.uid() = user_id)` — user can only delete their own rows.

For `family_members`, ownership is `auth.uid() = owner_id`.
For `shares`, ownership is `auth.uid() = owner_id` (owner controls shares they create).

**Storage RLS**: SELECT/INSERT/UPDATE/DELETE on `medical-documents` bucket objects, scoped by path prefix matching `auth.uid()`.

**AI summaries**: scoped to `auth.uid() = user_id`.

### Sensitive columns

No role/balance/moderation columns exist in MVP. If admin features are added later, they would use a separate `is_admin` check via `auth.jwt() ->> 'role'` or a SECURITY DEFINER function — never a user-editable column.

## 9. Edge Functions Architecture

- Runtime: Deno (Supabase Edge Functions).
- Language: TypeScript.
- All functions: `verify_jwt: true` (require authenticated session).
- CORS headers on every response (preflight, success, error).
- OpenAI API key stored as a Supabase secret (`OPENAI_API_KEY`), read via `Deno.env.get()`.
- Never return the API key or raw prompt to the client.

### MVP Edge Functions

| Function | Method | Purpose |
|---|---|---|
| `ai-health-summary` | POST | Accepts a date range, fetches the user's health data (server-side, using the JWT to identify the user), sends a structured prompt to OpenAI, returns a natural-language summary. Caches result in `ai_summaries` if data hash unchanged. |

### Future Edge Functions (not MVP)

- `ai-document-summary` — summarize uploaded medical documents (requires OCR, deferred).
- `ai-assistant-chat` — conversational health assistant.

## 10. OpenAI Integration Architecture

- Only called from Edge Functions, never from the browser.
- The Edge Function:
  1. Validates the JWT from the Authorization header (Supabase client handles this when `verify_jwt: true`).
  2. Extracts `auth.uid()` from the JWT.
  3. Queries the user's health data for the requested period directly from Postgres (using the service role key or the user's JWT — RLS will scope correctly with the JWT).
  4. Structures the data into a prompt (no raw PII beyond what the user themselves logged).
  5. Calls OpenAI Chat Completions API (`gpt-4o-mini` for cost efficiency).
  6. Returns the summary text to the client.
  7. Optionally caches in `ai_summaries` with a hash of the underlying data to avoid redundant calls.

- **Privacy**: The data sent to OpenAI is the user's own logged health data. The user is informed (in the UI) that AI summaries process their data via OpenAI. This is disclosed in the AI summary page with an explicit "Generate Summary" action — not automatic.

## 11. Routing / Navigation Structure

```
/login                          (public)
/register                       (public)
/                               → /dashboard        (protected)
/dashboard                      Dashboard overview
/check-ins                      Daily check-ins list + create
/exercise                       Exercise/activity log
/goals                          Goals management
/nutrition                      Nutrition/food log
/documents                      Medical document repository
/timeline                       Health timeline
/sharing                        Secure sharing settings
/family                         Family profiles management
/profile                        User profile settings
/ai-summary                     AI health summary
*                               NotFound (404)
```

Navigation: persistent left sidebar (collapsible on mobile → hamburger/drawer). Top bar shows user avatar, profile link, sign-out.

## 12. Component Structure

### UI Primitives (`components/ui/`)
- `Button` — variants: primary, secondary, outline, ghost, danger; sizes: sm, md, lg; loading state.
- `Input` — text, email, password, number, date; label, error, helper text.
- `Textarea` — label, error, helper text.
- `Select` — label, error, options.
- `Card` — container with optional header/footer.
- `Modal` — overlay dialog; ESC to close, click-outside to close.
- `Badge` — status/category labels.
- `Avatar` — image or initials fallback.
- `Spinner` — loading indicator.
- `ProgressBar` — for goals and data viz.
- `DatePicker` — date input (native input styled, or lightweight picker if needed).

### Layout (`components/layout/`)
- `AppLayout` — sidebar + topbar + content area.
- `Sidebar` — navigation links, collapsible.
- `TopBar` — page title, user menu, avatar.

### Feedback (`components/feedback/`)
- `ErrorBoundary` — catches render errors, shows fallback UI.
- `Loading` / `LoadingSpinner` — full-page and inline loading states.
- `EmptyState` — icon + title + description + optional action.
- `ErrorState` — error message + retry action.

### Feature Components (`components/common/`)
- Built per phase as features are implemented (e.g., `CheckInForm`, `ExerciseCard`, `GoalTracker`, `DocumentUploader`).

## 13. Environment Configuration

### `.env` (local, gitignored)
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### Supabase Edge Function secrets (set via Supabase dashboard or MCP)
```
OPENAI_API_KEY=<openai-api-key>
```

### `.env.example` (committed)
Contains the variable names with placeholder values and comments explaining each.

**Note**: `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` are pre-populated in the hosted environment for server-side/edge-function use. They are NOT exposed to the browser (no `VITE_` prefix).

## 14. GitHub / Project Structure

```
health-manager/
├── .github/
│   └── workflows/
│       └── e2e.yml              # Playwright tests (future)
├── docs/
│   └── ARCHITECTURE.md          # This document
├── public/
│   └── favicon.svg
├── src/
│   └── (see Frontend Architecture)
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 0001_initial_schema.sql
│   └── functions/
│       └── ai-health-summary/
│           └── index.ts
├── tests/
│   └── e2e/                     # Playwright tests (future)
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 15. Testing Strategy

### MVP (Phase 1 foundation)
- TypeScript compilation (`tsc --noEmit`) — catches type errors.
- Vite build (`vite build`) — catches import/bundling errors.
- Manual verification of routing and UI primitives.

### Future phases
- **Unit tests**: Vitest for utility functions and complex component logic.
- **Integration tests**: React Testing Library for form flows, data fetching.
- **E2E tests**: Playwright for critical user journeys (signup → check-in → view dashboard → upload document → AI summary).
- **RLS tests**: SQL scripts that verify a user cannot access another user's data.

## 16. Production Deployment Strategy

- **Frontend**: Deploy via Vite build → static hosting (Bolt handles deployment).
- **Database/Auth/Storage/Edge Functions**: Supabase managed.
- **Environment**: Production Supabase project with its own URL + keys. OpenAI API key set as a Supabase secret.
- **Security checklist before production**:
  - RLS enabled and policies tested on every table.
  - Storage bucket is private with correct policies.
  - Edge Functions verify JWT and include CORS headers.
  - No secrets in client bundle.
  - Email confirmation enabled for production auth.
  - Rate limiting on Edge Functions (Supabase platform handles baseline).

## 17. MVP vs Future-Feature Separation

### MVP (Phases 1–11)
| Feature | Phase |
|---|---|
| Project foundation, UI kit, routing | 1 |
| Database schema + RLS | 2 |
| Authentication (email/password) | 3 |
| Personal profile | 4 |
| Family profiles | 5 |
| Dashboard | 6 |
| Daily check-ins | 7 |
| Exercise/activity logging | 8 |
| Goals | 9 |
| Nutrition/food logging | 10 |
| Medical document upload + repository | — |
| Basic secure sharing | — |
| Health timeline | — |
| AI summary of habits and progress | 11 |

### Future (post-MVP)
| Feature | Notes |
|---|---|
| Wearable integration | Apple Health, Google Fit, Fitbit APIs. Requires OAuth flows and sync scheduling. |
| OCR | Extract text from uploaded documents. Requires a vision-capable model or OCR service. |
| AI document summarization | Edge function that reads document content and generates a summary. Depends on OCR or text extraction. |
| Medical report comparison | Diff two documents/reports and highlight changes. Depends on document summarization. |
| Advanced AI assistant | Multi-turn conversation with health context. Requires conversation state management and stricter prompt engineering. |
| Doctor portal | Separate role with scoped access to patient data. Requires role-based access control, invitation system, and audit logging. |

## Open Questions for Review

These are decisions that should be confirmed before proceeding, though reasonable defaults have been chosen:

1. **Sharing model**: MVP uses email-based sharing where the owner creates a share record and the recipient receives a link. The recipient does not need an account to view (the link carries a scoped token). Alternative: require recipients to have an account. **Default chosen**: link-based with optional expiry.

2. **Family member data ownership**: All health data is owned by the account holder who logged it, even data about a family member. Family members do not have their own accounts. **Default chosen**: account-holder owns all data.

3. **AI summary trigger**: The AI summary requires an explicit user action ("Generate Summary") rather than running automatically. **Default chosen**: explicit action with data-processing disclosure.

4. **Timeline auto-population**: Timeline events are created manually or by the app when a check-in/exercise/goal is logged. No DB triggers in MVP. **Default chosen**: app-level creation, no triggers.

5. **Document categories**: A predefined set (lab results, imaging, prescriptions, visit notes, insurance, other) vs. free-form tags. **Default chosen**: predefined categories with an "other" fallback.
