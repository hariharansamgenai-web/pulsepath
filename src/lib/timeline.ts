import { listCheckIns } from '@/lib/checkins';
import { listActivities, ACTIVITY_LABELS } from '@/lib/activities';
import { listGoals, GOAL_CATEGORY_LABELS } from '@/lib/goals';
import { longDate } from '@/lib/health';
import type { Activity, DailyCheckIn, Goal } from '@/types';

// ---------------------------------------------------------------------------
// Unified timeline event
// ---------------------------------------------------------------------------
export type TimelineEventType =
  | 'check_in'
  | 'exercise'
  | 'goal_created'
  | 'goal_completed'
  | 'goal_abandoned'
  | 'weight'
  | 'nutrition'
  | 'document'
  | 'achievement';

export interface TimelineEvent {
  id: string;
  date: string;
  type: TimelineEventType;
  title: string;
  detail: string | null;
  badges: string[];
  /** Original row for drill-down if needed. */
  source: DailyCheckIn | Activity | Goal | null;
}

// ---------------------------------------------------------------------------
// Build timeline from real data
// ---------------------------------------------------------------------------
export async function loadTimeline(
  profileId: string,
  from: string,
  to: string
): Promise<TimelineEvent[]> {
  const [checkIns, activities, goals] = await Promise.all([
    listCheckIns(profileId, from, to),
    listActivities(profileId, from, to),
    listGoals(profileId),
  ]);

  const events: TimelineEvent[] = [];

  // Check-ins
  for (const c of checkIns) {
    const badges: string[] = [];
    if (c.glucose_fasting !== null) badges.push(`Fasting ${c.glucose_fasting}`);
    if (c.glucose_post_meal !== null) badges.push(`Post-meal ${c.glucose_post_meal}`);
    if (c.meds_taken === true) badges.push('Meds taken');
    if (c.meds_taken === false) badges.push('Missed meds');
    if (c.steps !== null) badges.push(`${c.steps.toLocaleString()} steps`);
    if (c.water_ml !== null) badges.push(`${c.water_ml} ml water`);

    const parts: string[] = [];
    if (c.mood) parts.push(`Mood: ${c.mood}`);
    if (c.sleep_hours !== null) parts.push(`Sleep: ${c.sleep_hours} h`);
    if (c.energy_level !== null) parts.push(`Energy: ${c.energy_level}/10`);

    events.push({
      id: `ci-${c.id}`,
      date: c.date,
      type: 'check_in',
      title: 'Daily check-in',
      detail: parts.length > 0 ? parts.join(' · ') : c.notes,
      badges,
      source: c,
    });

    // Weight as a separate event so the weight chart can pick it up
    if (c.weight_kg !== null) {
      events.push({
        id: `wt-${c.id}`,
        date: c.date,
        type: 'weight',
        title: `Weight: ${c.weight_kg} kg`,
        detail: null,
        badges: [`${c.weight_kg} kg`],
        source: c,
      });
    }
  }

  // Activities
  for (const a of activities) {
    const name =
      a.activity_type === 'custom'
        ? a.custom_label ?? 'Custom activity'
        : ACTIVITY_LABELS[a.activity_type];
    const badges: string[] = [`${a.duration_min} min`];
    if (a.distance_km !== null) badges.push(`${a.distance_km} km`);
    if (a.calories_burned !== null) badges.push(`${a.calories_burned} kcal`);
    if (a.intensity) badges.push(a.intensity);

    events.push({
      id: `act-${a.id}`,
      date: a.date,
      type: 'exercise',
      title: name,
      detail: a.notes,
      badges,
      source: a,
    });
  }

  // Goals (created / completed / abandoned within the date range)
  for (const g of goals) {
    if (g.start_date >= from && g.start_date <= to) {
      events.push({
        id: `gc-${g.id}`,
        date: g.start_date,
        type: 'goal_created',
        title: `Goal created: ${g.title}`,
        detail: `${GOAL_CATEGORY_LABELS[g.category]}, ${g.frequency === 'daily' ? 'daily' : 'weekly'} target${g.target_value ? ` ${g.target_value} ${g.unit ?? ''}` : ''}`,
        badges: [GOAL_CATEGORY_LABELS[g.category]],
        source: g,
      });
    }
    if (g.status === 'completed' && g.updated_at) {
      const completedDate = g.updated_at.slice(0, 10);
      if (completedDate >= from && completedDate <= to) {
        events.push({
          id: `gd-${g.id}`,
          date: completedDate,
          type: 'goal_completed',
          title: `Goal completed: ${g.title}`,
          detail: null,
          badges: ['Completed'],
          source: g,
        });
      }
    }
    if (g.status === 'abandoned' && g.updated_at) {
      const abandonedDate = g.updated_at.slice(0, 10);
      if (abandonedDate >= from && abandonedDate <= to) {
        events.push({
          id: `ga-${g.id}`,
          date: abandonedDate,
          type: 'goal_abandoned',
          title: `Goal abandoned: ${g.title}`,
          detail: null,
          badges: ['Abandoned'],
          source: g,
        });
      }
    }
  }

  // Sort newest first
  events.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return events;
}

// ---------------------------------------------------------------------------
// Chart data helpers (all from real stored data only)
// ---------------------------------------------------------------------------
export interface ChartPoint {
  date: string;
  label: string;
  value: number;
}

export function weightChartData(checkIns: DailyCheckIn[]): ChartPoint[] {
  return checkIns
    .filter((c) => c.weight_kg !== null)
    .map((c) => ({ date: c.date, label: longDate(c.date), value: c.weight_kg! }));
}

export function exerciseChartData(activities: Activity[]): ChartPoint[] {
  const byDate = new Map<string, number>();
  for (const a of activities) {
    byDate.set(a.date, (byDate.get(a.date) ?? 0) + a.duration_min);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, mins]) => ({ date, label: longDate(date), value: mins }));
}

export function waterChartData(checkIns: DailyCheckIn[]): ChartPoint[] {
  return checkIns
    .filter((c) => c.water_ml !== null)
    .map((c) => ({ date: c.date, label: longDate(c.date), value: c.water_ml! }));
}

export function sleepChartData(checkIns: DailyCheckIn[]): ChartPoint[] {
  return checkIns
    .filter((c) => c.sleep_hours !== null)
    .map((c) => ({ date: c.date, label: longDate(c.date), value: c.sleep_hours! }));
}

export function caloriesChartData(activities: Activity[]): ChartPoint[] {
  const byDate = new Map<string, number>();
  for (const a of activities) {
    if (a.calories_burned !== null) {
      byDate.set(a.date, (byDate.get(a.date) ?? 0) + a.calories_burned);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, kcal]) => ({ date, label: longDate(date), value: kcal }));
}
