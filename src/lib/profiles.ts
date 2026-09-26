import { supabase } from '@/lib/supabase';
import type { Profile, ProfileInput, Relationship, Sex } from '@/types';

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  self: 'Me',
  spouse: 'Spouse / Partner',
  mother: 'Mother',
  father: 'Father',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  other: 'Other',
};

/** Options offered when creating a family profile ('self' exists already; 'parent' is legacy). */
export const FAMILY_RELATIONSHIPS: Relationship[] = ['spouse', 'mother', 'father', 'child', 'sibling', 'other'];

export const SEX_LABELS: Record<Sex, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function normalize(row: Record<string, unknown>): Profile {
  return {
    ...(row as unknown as Profile),
    height_cm: toNum(row.height_cm),
    weight_kg: toNum(row.weight_kg),
  };
}

/** All profiles the signed-in user owns: 'self' first, then oldest first. RLS limits rows to the owner. */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(normalize);
  return [...rows.filter((p) => p.relationship === 'self'), ...rows.filter((p) => p.relationship !== 'self')];
}

export async function createProfile(input: ProfileInput): Promise<Profile> {
  // owner_id defaults to auth.uid() in the database.
  const { data, error } = await supabase.from('profiles').insert(input).select('*').single();
  if (error) throw new Error(friendly(error.message));
  return normalize(data);
}

export async function updateProfile(id: string, input: Partial<ProfileInput> & { avatar_url?: string | null }): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(input).eq('id', id).select('*').single();
  if (error) throw new Error(friendly(error.message));
  return normalize(data);
}

/** Deletes the profile (its health records cascade in the database) and its avatar files. */
export async function deleteProfile(profile: Profile): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
  if (error) throw new Error(friendly(error.message));
  await removeAvatarFolder(profile.owner_id, profile.id);
}

export function validateAvatar(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size > AVATAR_MAX_BYTES) return 'The photo must be 2 MB or smaller.';
  return null;
}

/** Uploads a new avatar, points the profile at it and removes the previous file. Returns the updated profile. */
export async function setAvatar(profile: Profile, file: File): Promise<Profile> {
  const invalid = validateAvatar(file);
  if (invalid) throw new Error(invalid);

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${profile.owner_id}/${profile.id}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const previous = profile.avatar_url;
  const updated = await updateProfile(profile.id, { avatar_url: path });
  if (previous && previous !== path) {
    await supabase.storage.from('avatars').remove([previous]);
  }
  signedUrlCache.delete(previous ?? '');
  return updated;
}

export async function removeAvatar(profile: Profile): Promise<Profile> {
  const updated = await updateProfile(profile.id, { avatar_url: null });
  if (profile.avatar_url) {
    await supabase.storage.from('avatars').remove([profile.avatar_url]);
    signedUrlCache.delete(profile.avatar_url);
  }
  return updated;
}

async function removeAvatarFolder(ownerId: string, profileId: string) {
  const folder = `${ownerId}/${profileId}`;
  const { data } = await supabase.storage.from('avatars').list(folder);
  if (data && data.length > 0) {
    await supabase.storage.from('avatars').remove(data.map((f) => `${folder}/${f.name}`));
  }
}

// Signed URLs expire after an hour; cache them for 50 minutes.
const signedUrlCache = new Map<string, { url: string; expires: number }>();

export async function getAvatarUrl(path: string): Promise<string | null> {
  const hit = signedUrlCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 3600);
  if (error || !data) return null;
  signedUrlCache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export function ageFrom(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age >= 0 ? age : null;
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('uniq_profiles_one_self_per_owner')) return 'You already have your own profile.';
  if (m.includes('cannot be deleted')) return 'Your own profile can’t be deleted.';
  if (m.includes('relationship of your own profile')) return 'The relationship of your own profile can’t be changed.';
  if (m.includes('height_cm')) return 'Height must be between 30 and 250 cm.';
  if (m.includes('weight_kg')) return 'Weight must be between 1 and 400 kg.';
  if (m.includes('row-level security')) return 'You don’t have permission to change this profile.';
  return message;
}
