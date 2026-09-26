/*
# Phase 10 — Secure Medical Document Sharing

## Design

The existing `medical_shares` table treats sharing as profile-scoped
(`resource_type IN ('all', 'documents', ...)`). Phase 10 requires
document-level granularity: a share grants access to exactly the documents
the owner selected — never the whole profile.

### New table: `share_documents`
A junction table that maps a share to one or more specific medical documents.
Each row = one document included in that share.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| share_id | uuid FK → medical_shares.id | Cascade delete |
| document_id | uuid FK → medical_documents.id | Cascade delete |
| created_at | timestamptz | |

Uniqueness: (share_id, document_id) — no duplicates per share.

### Extensions to `medical_shares`
- `label` (text, nullable): human-friendly name, e.g. "For Dr. Priya – HbA1c".
- `access_count` (integer, default 0): incremented (via the application layer)
  each time the share link is successfully accessed.
- `last_accessed_at` (timestamptz, nullable): timestamp of most recent access.

### Extensions to `audit_logs` action CHECK
Adds `share_accessed` and `share_expired` to the allowed values.

## RLS on `share_documents`
- SELECT / INSERT / DELETE all gate through the parent share's `profile_id`:
  `user_owns_profile((SELECT profile_id FROM medical_shares WHERE id = share_id))`.
- No UPDATE policy — rows are immutable; delete + re-insert to change document
  selection.

## Share-access path (implemented in the app, no public bucket)
1. A recipient clicks the share link: `/share/{token}`.
2. The app verifies `medical_shares` where `share_token = token` and
   `status = 'active'` and (`expires_at IS NULL` or `expires_at > now()`).
3. The app loads the associated `share_documents` to get the document IDs.
4. For each document, the app calls a Supabase Edge Function (or server-side
   route) that verifies the token, issues a one-time signed URL, and records
   the access in `audit_logs`. The storage bucket remains private at all times.
5. If the share is expired, the app marks status = 'expired' and logs the
   attempt.

## Audit log events added
- `share_accessed`: token used to view a shared document.
- `share_expired`: an attempt to use an expired share link.

Both events are recorded by the application layer alongside every
`share_created` and `share_revoked`.
*/

-- ── Expand audit_logs action CHECK ────────────────────────────────────
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'document_upload', 'document_download', 'document_delete',
    'share_created', 'share_accessed', 'share_revoked', 'share_expired',
    'data_export'
  ));

-- ── Extend medical_shares ─────────────────────────────────────────────
ALTER TABLE public.medical_shares
  ADD COLUMN IF NOT EXISTS label            text,
  ADD COLUMN IF NOT EXISTS access_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz;

-- Add 'expired' status (the existing CHECK uses IN, we drop and recreate)
ALTER TABLE public.medical_shares DROP CONSTRAINT IF EXISTS medical_shares_status_check;
ALTER TABLE public.medical_shares ADD CONSTRAINT medical_shares_status_check
  CHECK (status IN ('pending', 'active', 'revoked', 'expired'));

-- ── share_documents junction table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.share_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id    uuid NOT NULL REFERENCES public.medical_shares(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (share_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_share_documents_share_id ON public.share_documents(share_id);
CREATE INDEX IF NOT EXISTS idx_share_documents_doc_id ON public.share_documents(document_id);

ALTER TABLE public.share_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_share_documents" ON public.share_documents;
CREATE POLICY "select_own_share_documents"
  ON public.share_documents FOR SELECT TO authenticated
  USING (
    public.user_owns_profile(
      (SELECT profile_id FROM public.medical_shares WHERE id = share_id)
    )
  );

DROP POLICY IF EXISTS "insert_own_share_documents" ON public.share_documents;
CREATE POLICY "insert_own_share_documents"
  ON public.share_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.user_owns_profile(
      (SELECT profile_id FROM public.medical_shares WHERE id = share_id)
    )
  );

DROP POLICY IF EXISTS "delete_own_share_documents" ON public.share_documents;
CREATE POLICY "delete_own_share_documents"
  ON public.share_documents FOR DELETE TO authenticated
  USING (
    public.user_owns_profile(
      (SELECT profile_id FROM public.medical_shares WHERE id = share_id)
    )
  );
