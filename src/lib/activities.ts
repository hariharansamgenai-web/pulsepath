import { supabase } from '@/lib/supabase';
import type { Activity, ActivityInput, ActivityType } from '@/types';

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  walking: 'Walking',
  running: 'Running',
  cycling: 'Cycling',
  gym: 'Gym',
  swimming: 'Swimming',
  yoga: 'Yoga',
  sports: 'Sports',
  custom: 'Custom activity',
  strength: 'Strength', // legacy value, kept selectable when editing old rows
  other: 'Other',
};

/** Order offered when creating an activity ('strength' is legacy-only, see ACTIVITY_LABELS). */
export const ACTIVITY_TYPES: ActivityType[] = ['walking', 'running', 'cycling', 'gym', 'swimming', 'yoga', 'sports', 'custom', 'other'];

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function normalize(row: Record<string, unknown>): Activity {
  return {
    ...(row as unknown as Activity),
    duration_min: Number(row.duration_min),
    distance_km: toNum(row.distance_km),
    calories_burned: toNum(row.calories_burned),
  };
}

export async function listActivities(profileId: string, from: string, to: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('profile_id', profileId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalize);
}

export async function createActivity(profileId: string, input: ActivityInput): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .insert({ ...input, profile_id: profileId })
    .select('*')
    .single();
  if (error) throw new Error(friendly(error.message));
  return normalize(data);
}

export async function updateActivity(id: string, input: ActivityInput): Promise<Activity> {
  const { data, error } = await supabase.from('activities').update(input).eq('id', id).select('*').single();
  if (error) throw new Error(friendly(error.message));
  return normalize(data);
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('activities_custom_label_check')) return 'Name the custom activity.';
  if (m.includes('duration_min')) return 'Duration must be a positive number of minutes.';
  if (m.includes('distance_km')) return 'Distance can’t be negative.';
  if (m.includes('calories_burned')) return 'Calories can’t be negative.';
  return message;
}
