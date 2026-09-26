import { supabase } from '@/lib/supabase';
import type {
  MedicalShare,
  MedicalShareWithDocuments,
  ShareResourceType,
  ShareStatus,
} from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CreateShareInput {
  profile_id: string;
  shared_with_email: string;
  resource_type: ShareResourceType;
  label: string | null;
  expires_at: string | null;      // ISO date string or null = never expires
  document_ids?: string[];        // only meaningful when resource_type === 'documents'
}

export const RESOURCE_TYPE_LABELS: Record<ShareResourceType, string> = {
  all:        'All health data',
  documents:  'Medical documents',
  timeline:   'Health timeline',
  check_ins:  'Daily check-ins',
  goals:      'Goals',
};

export const STATUS_LABELS: Record<ShareStatus, string> = {
  pending: 'Pending',
  active:  'Active',
  revoked: 'Revoked',
  expired: 'Expired',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isShareValid(share: MedicalShare, now = new Date()): boolean {
  if (share.status !== 'active') return false;
  if (share.expires_at && new Date(share.expires_at) < now) return false;
  return true;
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export async function listShares(
  profileId: string,
): Promise<MedicalShareWithDocuments[]> {
  const { data, error } = await supabase
    .from('medical_shares')
    .select('*, share_documents(*)')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MedicalShareWithDocuments[];
}

export async function createShare(input: CreateShareInput): Promise<MedicalShare> {
  const token = generateToken();
  const { data, error } = await supabase
    .from('medical_shares')
    .insert({
      profile_id:        input.profile_id,
      shared_with_email: input.shared_with_email.trim().toLowerCase(),
      resource_type:     input.resource_type,
      label:             input.label?.trim() || null,
      expires_at:        input.expires_at || null,
      share_token:       token,
      status:            'active',
      permissions:       ['read'],
      access_count:      0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const share = data as MedicalShare;

  // If specific documents were chosen, insert junction rows
  if (input.resource_type === 'documents' && input.document_ids?.length) {
    const rows = input.document_ids.map((doc_id) => ({
      share_id:    share.id,
      document_id: doc_id,
    }));
    const { error: jErr } = await supabase.from('share_documents').insert(rows);
    if (jErr) throw new Error(jErr.message);
  }

  return share;
}

export async function revokeShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('medical_shares')
    .update({ status: 'revoked' })
    .eq('id', shareId);
  if (error) throw new Error(error.message);
}

export async function deleteShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('medical_shares')
    .delete()
    .eq('id', shareId);
  if (error) throw new Error(error.message);
}
