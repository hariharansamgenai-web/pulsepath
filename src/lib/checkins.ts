import { supabase } from '@/lib/supabase';
import type { CheckInInput, DailyCheckIn } from '@/types';
import { generateDemoCheckIns } from '@/lib/health';

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function normalize(row: Record<string, unknown>): DailyCheckIn {
  return {
    ...(row as unknown as DailyCheckIn),
    glucose_fasting: toNum(row.glucose_fasting),
    glucose_post_meal: toNum(row.glucose_post_meal),
    sleep_hours: toNum(row.sleep_hours),
    weight_kg: toNum(row.weight_kg),
    water_ml: toNum(row.water_ml),
    steps: toNum(row.steps),
    energy_level: toNum(row.energy_level),
    stress_level: toNum(row.stress_level),
    sleep_quality: toNum(row.sleep_quality),
  };
}

/** Check-ins for a profile, oldest first. RLS keeps rows to profiles the user owns. */
export async function listCheckIns(profileId: string, from: string, to: string): Promise<DailyCheckIn[]> {
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('profile_id', profileId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalize);
}

/** Upsert the profile's check-in for that date (one per day per profile is enforced by the DB). */
export async function saveCheckIn(profileId: string, input: CheckInInput): Promise<DailyCheckIn> {
  const { data, error } = await supabase
    .from('daily_checkins')
    .upsert({ ...input, profile_id: profileId }, { onConflict: 'profile_id,date' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function deleteCheckIn(id: string): Promise<void> {
  const { error } = await supabase.from('daily_checkins').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Inserts up to 14 days of synthetic check-ins for a profile that has none. */
export async function loadDemoData(profileId: string): Promise<number> {
  const demo = generateDemoCheckIns();
  const existing = await listCheckIns(profileId, demo[0].date, demo[demo.length - 1].date);
  const taken = new Set(existing.map((c) => c.date));
  const rows = demo.filter((d) => !taken.has(d.date)).map((d) => ({ ...d, profile_id: profileId }));
  if (rows.length === 0) return 0;
  const { error } = await supabase.from('daily_checkins').insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
