import { supabase } from '@/lib/supabase';
import type { Activity, DailyCheckIn, Goal, GoalCategory, GoalInput, GoalStatus } from '@/types';
import { addDays, todayISO } from '@/lib/health';

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  exercise: 'Exercise',
  nutrition: 'Nutrition',
  sleep: 'Sleep',
  weight: 'Weight',
  mental_health: 'Mental health',
  other: 'Other',
};

/** Ready-made examples the form can prefill from. */
export const GOAL_PRESETS: { label: string; goal: GoalInput }[] = [
  { label: '8,000 steps/day', goal: preset('Daily steps', 'exercise', 8000, 'steps', 'daily') },
  { label: '30 minutes exercise/day', goal: preset('Daily exercise', 'exercise', 30, 'minutes', 'daily') },
  { label: '3 L water/day', goal: preset('Daily water', 'nutrition', 3, 'L', 'daily') },
  { label: '7 hours sleep/day', goal: preset('Nightly sleep', 'sleep', 7, 'hours', 'daily') },
  { label: '5 workouts/week', goal: preset('Weekly workouts', 'exercise', 5, 'workouts', 'weekly') },
];

function preset(title: string, category: GoalCategory, target: number, unit: string, frequency: 'daily' | 'weekly'): GoalInput {
  return { title, category, target_value: target, unit, frequency, start_date: todayISO(), target_date: null, reminder_enabled: false, reminder_time: null };
}

export async function listGoals(profileId: string, status?: GoalStatus): Promise<Goal[]> {
  let q = supabase.from('goals').select('*').eq('profile_id', profileId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalize);
}

export async function createGoal(profileId: string, input: GoalInput): Promise<Goal> {
  const { data, error } = await supabase.from('goals').insert({ ...input, profile_id: profileId }).select('*').single();
  if (error) throw new Error(friendly(error.message));
  return normalize(data);
}

export async function updateGoal(id: string, input: Partial<GoalInput>): Promise<Goal> {
  const { data, error } = await supabase.from('goals').update(input).eq('id', id).select('*').single();
  if (error) throw new Error(friendly(error.message));
  return normalize(data);
}

export async function setGoalStatus(id: string, status: GoalStatus): Promise<Goal> {
  const { data, error } = await supabase.from('goals').update({ status }).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

function normalize(row: Record<string, unknown>): Goal {
  return {
    ...(row as unknown as Goal),
    target_value: row.target_value === null ? null : Number(row.target_value),
    current_value: row.current_value === null ? null : Number(row.current_value),
  };
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('goals_frequency_check')) return 'Choose daily or weekly.';
  if (m.includes('goals_dates_check')) return 'The end date can’t be before the start date.';
  return message;
}

// ---------------------------------------------------------------------------
// Live progress — computed from real check-ins and activities only.
// No value here is ever simulated, estimated, or carried over from a cache.
// ---------------------------------------------------------------------------

export interface GoalProgress {
  /** null when the goal's unit can't be matched to a logged metric, or nothing has been logged yet for a gauge metric. */
  value: number | null;
  target: number | null;
  percent: number | null;
  /** What the progress is measured against, e.g. "today" or "last 7 days". */
  periodLabel: string;
  /** False when the unit has no automatic match (progress must be tracked manually / not shown). */
  measurable: boolean;
}

/**
 * Whether `unit` contains any of `keywords` as a whole word (not as a
 * substring of a longer word — "sessions" must not match "session" inside
 * "sessions of mindfulness" being treated the same as literal "l" matching
 * inside "mindfulness"). Word boundaries are non-letter characters.
 */
function unitMatches(unit: string, ...keywords: string[]): boolean {
  const tokens = unit.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return keywords.some((k) => tokens.includes(k));
}

function sum(values: (number | null)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}
function avg(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Computes a goal's current progress against its target, from the given check-ins and activities. */
export function computeGoalProgress(goal: Goal, checkIns: DailyCheckIn[], activities: Activity[], today = todayISO()): GoalProgress {
  const unit = goal.unit ?? '';
  const periodStart = goal.frequency === 'daily' ? today : addDays(today, -6);
  const periodLabel = goal.frequency === 'daily' ? 'today' : 'last 7 days';
  const inPeriod = <T extends { date: string }>(rows: T[]) => rows.filter((r) => r.date >= periodStart && r.date <= today && r.date >= goal.start_date);

  const checkInsInPeriod = inPeriod(checkIns);
  const activitiesInPeriod = inPeriod(activities);

  let value: number | null = null;
  let measurable = true;

  if (unitMatches(unit, 'step', 'steps')) {
    value = sum(checkInsInPeriod.map((c) => c.steps));
  } else if (unitMatches(unit, 'ml')) {
    value = sum(checkInsInPeriod.map((c) => c.water_ml));
  } else if (unitMatches(unit, 'l', 'liter', 'liters', 'litre', 'litres')) {
    value = sum(checkInsInPeriod.map((c) => c.water_ml)) / 1000;
  } else if (unitMatches(unit, 'hour', 'hours', 'hr', 'hrs') && goal.category === 'sleep') {
    value = avg(checkInsInPeriod.map((c) => c.sleep_hours).filter((v): v is number => v !== null));
  } else if (unitMatches(unit, 'kg', 'kgs') && goal.category === 'weight') {
    const withWeight = [...checkInsInPeriod].filter((c) => c.weight_kg !== null);
    value = withWeight.length ? withWeight[withWeight.length - 1].weight_kg : null;
  } else if (unitMatches(unit, 'minute', 'minutes', 'min', 'mins') && goal.category === 'exercise') {
    value = sum(activitiesInPeriod.map((a) => a.duration_min));
  } else if (unitMatches(unit, 'workout', 'workouts', 'session', 'sessions', 'time', 'times') && goal.category === 'exercise') {
    value = activitiesInPeriod.length;
  } else {
    measurable = false;
  }

  const target = goal.target_value;
  const percent = measurable && value !== null && target !== null && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : null;

  return { value, target, percent, periodLabel, measurable };
}
