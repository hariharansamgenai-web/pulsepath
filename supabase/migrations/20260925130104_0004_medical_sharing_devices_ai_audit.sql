/*
# Medical documents, sharing, devices, AI summaries, and audit logs

## Purpose
Creates the remaining five tables: medical document metadata, secure sharing
records, wearable device connections, AI-generated summary cache, and an audit
log for sensitive operations.

## New Tables

### `medical_documents`
Metadata for uploaded medical documents. The actual file is stored in Supabase
Storage (private bucket). This table holds the metadata: file name, storage path,
category, description, etc.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | Which profile this document belongs to |
| `file_name` | text NOT NULL | Original file name |
| `file_path` | text NOT NULL | Storage bucket path |
| `mime_type` | text NOT NULL | File MIME type |
| `file_size` | integer NOT NULL | File size in bytes |
| `category` | text NOT NULL DEFAULT 'other' | 'lab_results', 'imaging', 'prescriptions', 'visit_notes', 'insurance', 'other' |
| `description` | text | User-provided description |
| `uploaded_at` | timestamptz NOT NULL DEFAULT now() | When the file was uploaded |
| `created_at` / `updated_at` | timestamptz | |

### `medical_shares`
Records of secure sharing invitations. The account owner can share health data
with another person by email. The recipient receives a link with a scoped token.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | Which profile's data is being shared |
| `shared_with_email` | text NOT NULL | Recipient email |
| `resource_type` | text NOT NULL DEFAULT 'all' | 'all', 'documents', 'timeline', 'check_ins', 'goals' |
| `permissions` | text[] NOT NULL DEFAULT '{read}' | Array of 'read', 'write' |
| `share_token` | uuid NOT NULL DEFAULT gen_random_uuid() | Unique token for the share link |
| `expires_at` | timestamptz | Optional expiry |
| `status` | text NOT NULL DEFAULT 'pending' | 'pending', 'active', 'revoked' |
| `created_at` / `updated_at` | timestamptz | |

### `devices`
Wearable device connections (future feature — prepared now for schema stability).

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | |
| `device_type` | text NOT NULL | 'apple_health', 'google_fit', 'fitbit', 'garmin', 'other' |
| `device_name` | text | User-friendly device name |
| `sync_enabled` | boolean NOT NULL DEFAULT true | Whether automatic sync is on |
| `last_synced_at` | timestamptz | Last successful sync time |
| `metadata` | jsonb | Device-specific connection metadata |
| `created_at` / `updated_at` | timestamptz | |

### `ai_summaries`
Cached AI-generated health summaries. Storing the summary with a data hash allows
us to avoid re-calling OpenAI when the underlying data hasn't changed.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | |
| `summary_text` | text NOT NULL | The AI-generated summary |
| `period_start` | date NOT NULL | Start of the summary period |
| `period_end` | date NOT NULL | End of the summary period |
| `data_hash` | text NOT NULL | Hash of the underlying data (for cache invalidation) |
| `generated_at` | timestamptz NOT NULL DEFAULT now() | When the summary was generated |
| `created_at` | timestamptz | |

### `audit_logs`
Append-only log of sensitive operations (document access, sharing changes, data
exports). Used for compliance and security auditing.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | Which profile was affected |
| `actor_id` | uuid NOT NULL | Who performed the action (auth.users id) |
| `action` | text NOT NULL | 'document_upload', 'document_download', 'document_delete', 'share_created', 'share_revoked', 'data_export' |
| `resource_type` | text | What type of resource was affected |
| `resource_id` | uuid | Specific resource ID |
| `metadata` | jsonb | Additional context |
| `created_at` | timestamptz NOT NULL DEFAULT now() | When the action occurred |

**Note:** `audit_logs` has no UPDATE or DELETE policies — it is append-only by
design. Only SELECT and INSERT are granted.

## RLS Strategy

All tables follow the `user_owns_profile(profile_id)` pattern with four policies
each (SELECT/INSERT/UPDATE/DELETE), except `audit_logs` which has only SELECT
and INSERT (append-only).

All policies are `TO authenticated`. No anon/public access. Medical documents
are never publicly readable.
*/

-- ── Medical documents ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_path   text NOT NULL,
  mime_type   text NOT NULL,
  file_size   integer NOT NULL CHECK (file_size > 0),
  category    text NOT NULL DEFAULT 'other'
    CHECK (category IN ('lab_results', 'imaging', 'prescriptions', 'visit_notes', 'insurance', 'other')),
  description text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_docs_profile_id ON public.medical_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_medical_docs_category ON public.medical_documents(category);
CREATE INDEX IF NOT EXISTS idx_medical_docs_profile_category ON public.medical_documents(profile_id, category);

CREATE TRIGGER trg_medical_docs_updated_at
  BEFORE UPDATE ON public.medical_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_medical_documents" ON public.medical_documents;
CREATE POLICY "select_own_medical_documents"
  ON public.medical_documents FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_medical_documents" ON public.medical_documents;
CREATE POLICY "insert_own_medical_documents"
  ON public.medical_documents FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "update_own_medical_documents" ON public.medical_documents;
CREATE POLICY "update_own_medical_documents"
  ON public.medical_documents FOR UPDATE TO authenticated
  USING (public.user_owns_profile(profile_id))
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "delete_own_medical_documents" ON public.medical_documents;
CREATE POLICY "delete_own_medical_documents"
  ON public.medical_documents FOR DELETE TO authenticated
  USING (public.user_owns_profile(profile_id));

-- ── Medical shares ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_shares (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with_email text NOT NULL,
  resource_type     text NOT NULL DEFAULT 'all'
    CHECK (resource_type IN ('all', 'documents', 'timeline', 'check_ins', 'goals')),
  permissions       text[] NOT NULL DEFAULT '{read}'
    CHECK (array_length(permissions, 1) > 0),
  share_token       uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at        timestamptz,
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_shares_profile_id ON public.medical_shares(profile_id);
CREATE INDEX IF NOT EXISTS idx_medical_shares_status ON public.medical_shares(status);
CREATE INDEX IF NOT EXISTS idx_medical_shares_token ON public.medical_shares(share_token);

CREATE TRIGGER trg_medical_shares_updated_at
  BEFORE UPDATE ON public.medical_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.medical_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_medical_shares" ON public.medical_shares;
CREATE POLICY "select_own_medical_shares"
  ON public.medical_shares FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_medical_shares" ON public.medical_shares;
CREATE POLICY "insert_own_medical_shares"
  ON public.medical_shares FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "update_own_medical_shares" ON public.medical_shares;
CREATE POLICY "update_own_medical_shares"
  ON public.medical_shares FOR UPDATE TO authenticated
  USING (public.user_owns_profile(profile_id))
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "delete_own_medical_shares" ON public.medical_shares;
CREATE POLICY "delete_own_medical_shares"
  ON public.medical_shares FOR DELETE TO authenticated
  USING (public.user_owns_profile(profile_id));

-- ── Devices ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_type   text NOT NULL
    CHECK (device_type IN ('apple_health', 'google_fit', 'fitbit', 'garmin', 'other')),
  device_name   text,
  sync_enabled  boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_profile_id ON public.devices(profile_id);

CREATE TRIGGER trg_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_devices" ON public.devices;
CREATE POLICY "select_own_devices"
  ON public.devices FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_devices" ON public.devices;
CREATE POLICY "insert_own_devices"
  ON public.devices FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "update_own_devices" ON public.devices;
CREATE POLICY "update_own_devices"
  ON public.devices FOR UPDATE TO authenticated
  USING (public.user_owns_profile(profile_id))
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "delete_own_devices" ON public.devices;
CREATE POLICY "delete_own_devices"
  ON public.devices FOR DELETE TO authenticated
  USING (public.user_owns_profile(profile_id));

-- ── AI summaries ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary_text text NOT NULL,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  data_hash    text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_summaries_profile_id ON public.ai_summaries(profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_profile_period ON public.ai_summaries(profile_id, period_start DESC);

ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_summaries" ON public.ai_summaries;
CREATE POLICY "select_own_ai_summaries"
  ON public.ai_summaries FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_ai_summaries" ON public.ai_summaries;
CREATE POLICY "insert_own_ai_summaries"
  ON public.ai_summaries FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "update_own_ai_summaries" ON public.ai_summaries;
CREATE POLICY "update_own_ai_summaries"
  ON public.ai_summaries FOR UPDATE TO authenticated
  USING (public.user_owns_profile(profile_id))
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "delete_own_ai_summaries" ON public.ai_summaries;
CREATE POLICY "delete_own_ai_summaries"
  ON public.ai_summaries FOR DELETE TO authenticated
  USING (public.user_owns_profile(profile_id));

-- ── Audit logs (append-only: SELECT + INSERT only, no UPDATE/DELETE) ─
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id      uuid NOT NULL,
  action        text NOT NULL
    CHECK (action IN ('document_upload', 'document_download', 'document_delete',
                      'share_created', 'share_revoked', 'data_export')),
  resource_type text,
  resource_id   uuid,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_profile_id ON public.audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audit_logs" ON public.audit_logs;
CREATE POLICY "select_own_audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_audit_logs" ON public.audit_logs;
CREATE POLICY "insert_own_audit_logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));
