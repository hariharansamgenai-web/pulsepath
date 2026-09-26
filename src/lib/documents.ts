import { supabase } from '@/lib/supabase';
import type { DocumentCategory, MedicalDocument, MedicalDocumentInput } from '@/types';

export const BUCKET = 'medical-documents';

export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'] as const;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const SIGNED_URL_EXPIRES_SECONDS = 60; // short-lived; re-requested per action

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  lab_report: 'Lab Report',
  prescription: 'Prescription',
  scan: 'Scan / Imaging',
  doctor_note: 'Doctor Note',
  discharge_summary: 'Discharge Summary',
  other: 'Other',
  // legacy
  lab_results: 'Lab Results',
  imaging: 'Imaging',
  prescriptions: 'Prescriptions',
  visit_notes: 'Visit Notes',
  insurance: 'Insurance',
};

export const PRIMARY_CATEGORIES: DocumentCategory[] = [
  'lab_report', 'prescription', 'scan', 'doctor_note', 'discharge_summary', 'other',
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type as never)) {
    return `Unsupported file type. Upload PDF, JPG, JPEG, or PNG only.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large. Maximum size is 10 MB.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Storage path — always owner-scoped so storage RLS can verify at the bucket level
// ---------------------------------------------------------------------------
function storagePath(userId: string, profileId: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const ts = Date.now();
  return `${userId}/${profileId}/${ts}_${safe}.${ext}`.replace(/\.([^.]+)\.([^.]+)$/, '.$2');
}

// ---------------------------------------------------------------------------
// Upload — validates client-side, then uploads to private bucket
// ---------------------------------------------------------------------------
export async function uploadDocument(
  userId: string,
  profileId: string,
  file: File,
  meta: MedicalDocumentInput,
): Promise<MedicalDocument> {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  const path = storagePath(userId, profileId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const docName = meta.document_name?.trim() || file.name.replace(/\.[^.]+$/, '');

  const { data, error: dbError } = await supabase
    .from('medical_documents')
    .insert({
      profile_id: profileId,
      file_name: file.name,
      file_path: path,
      mime_type: file.type,
      file_size: file.size,
      category: meta.category,
      document_name: docName,
      document_date: meta.document_date || null,
      doctor: meta.doctor?.trim() || null,
      hospital_clinic: meta.hospital_clinic?.trim() || null,
      notes: meta.notes?.trim() || null,
    })
    .select('*')
    .single();

  if (dbError) {
    // Best-effort cleanup if the DB insert fails
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(`Could not save document record: ${dbError.message}`);
  }

  return data as MedicalDocument;
}

// ---------------------------------------------------------------------------
// List / query
// ---------------------------------------------------------------------------
export async function listDocuments(
  profileId: string,
  opts?: { category?: DocumentCategory; search?: string },
): Promise<MedicalDocument[]> {
  let q = supabase
    .from('medical_documents')
    .select('*')
    .eq('profile_id', profileId)
    .order('document_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (opts?.category) q = q.eq('category', opts.category);
  if (opts?.search) q = q.ilike('document_name', `%${opts.search}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MedicalDocument[];
}

// ---------------------------------------------------------------------------
// Update metadata (rename, notes, category, etc.)
// ---------------------------------------------------------------------------
export async function updateDocument(
  id: string,
  profileId: string,
  input: Partial<MedicalDocumentInput>,
): Promise<MedicalDocument> {
  // profileId in the WHERE clause means the DB RLS would block cross-profile
  // updates even if the application code somehow passed the wrong id.
  const { data, error } = await supabase
    .from('medical_documents')
    .update(input)
    .eq('id', id)
    .eq('profile_id', profileId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as MedicalDocument;
}

// ---------------------------------------------------------------------------
// Delete — removes DB row first, then the storage object
// ---------------------------------------------------------------------------
export async function deleteDocument(doc: MedicalDocument): Promise<void> {
  const { error: dbError } = await supabase
    .from('medical_documents')
    .delete()
    .eq('id', doc.id)
    .eq('profile_id', doc.profile_id);
  if (dbError) throw new Error(dbError.message);

  // Storage delete is best-effort — object will be orphaned but not user-accessible
  await supabase.storage.from(BUCKET).remove([doc.file_path]);
}

// ---------------------------------------------------------------------------
// Signed URL — short-lived, re-requested per action (view or download)
// NEVER stored in the browser. Profile ownership verified at DB level before
// this is called, so the storage path cannot be guessed by another user.
// ---------------------------------------------------------------------------
export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRES_SECONDS);
  if (error || !data?.signedUrl) throw new Error('Could not generate a download link.');
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
