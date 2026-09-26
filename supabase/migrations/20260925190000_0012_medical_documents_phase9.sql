/*
# Phase 9 — Medical Document Repository

## medical_documents schema changes

### New columns
| Column | Type | Description |
|---|---|---|
| `document_name` | text | User-facing document name (separate from file_name) |
| `document_date` | date | Date of the document (e.g., report date, prescription date) |
| `doctor` | text | Attending doctor's name |
| `hospital_clinic` | text | Issuing hospital or clinic |
| `notes` | text | User's own notes about the document |

### `category` — expanded CHECK
The existing schema used: lab_results, imaging, prescriptions, visit_notes, insurance, other.
Phase 9 adds: lab_report, prescription, scan, doctor_note, discharge_summary.
Old values are kept so existing rows stay valid.

### RLS: unchanged
All four policies already scope through user_owns_profile(profile_id).

## Storage bucket: medical-documents
- Private (no public access).
- Every object path is prefixed with the owner's user-id:
    {user_id}/{profile_id}/{filename}
- Storage policies:
  SELECT: authenticated users can only read objects where path starts with their user_id.
  INSERT: authenticated users can only write objects where path starts with their user_id.
  UPDATE/DELETE: same scope.

This means even if User B guesses User A's document path or ID, they cannot:
  1. Obtain a signed URL (the application checks profile ownership at the DB layer before
     calling storage.createSignedUrl).
  2. Read the object directly (storage policy rejects path prefixes that don't match
     their JWT sub).

Signed URLs have a 60-second TTL; the client must re-request for every view or download.
They are never stored or returned to the browser in a persistent form.
*/

-- ── Expand category CHECK ─────────────────────────────────────────────
ALTER TABLE public.medical_documents
  DROP CONSTRAINT IF EXISTS medical_documents_category_check;

ALTER TABLE public.medical_documents
  ADD CONSTRAINT medical_documents_category_check
  CHECK (category IN (
    -- Phase 9 display names
    'lab_report', 'prescription', 'scan', 'doctor_note', 'discharge_summary', 'other',
    -- Legacy values from migration 0004 (kept for backward compatibility)
    'lab_results', 'imaging', 'prescriptions', 'visit_notes', 'insurance'
  ));

-- ── New metadata columns ───────────────────────────────────────────────
ALTER TABLE public.medical_documents
  ADD COLUMN IF NOT EXISTS document_name text,
  ADD COLUMN IF NOT EXISTS document_date date,
  ADD COLUMN IF NOT EXISTS doctor        text,
  ADD COLUMN IF NOT EXISTS hospital_clinic text,
  ADD COLUMN IF NOT EXISTS notes         text;

-- Back-fill document_name from file_name for existing rows
UPDATE public.medical_documents
  SET document_name = regexp_replace(file_name, '\.[^.]+$', '')
  WHERE document_name IS NULL;

-- ── Storage bucket ─────────────────────────────────────────────────────
-- Run once; safe to re-run (INSERT ... ON CONFLICT DO NOTHING).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-documents',
  'medical-documents',
  false,                                      -- PRIVATE — no public access
  10485760,                                   -- 10 MB per file
  ARRAY['application/pdf','image/jpeg','image/jpg','image/png']
) ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS policies ───────────────────────────────────────────────
-- Pattern: objects are stored at {user_id}/{profile_id}/{uuid-filename}
-- The leading segment of the path is the owner's auth.uid().

DROP POLICY IF EXISTS "medical_docs_select" ON storage.objects;
CREATE POLICY "medical_docs_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "medical_docs_insert" ON storage.objects;
CREATE POLICY "medical_docs_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'medical-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "medical_docs_update" ON storage.objects;
CREATE POLICY "medical_docs_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "medical_docs_delete" ON storage.objects;
CREATE POLICY "medical_docs_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
