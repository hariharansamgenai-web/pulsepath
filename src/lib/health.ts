import type { DailyCheckIn, HealthAlert } from '@/types';

// Common adult targets for Type 2 Diabetes; kept in one place so the whole app
// can be re-scoped per user later without hunting through code.
export const GLUCOSE = {
  LOW: 70,
  FASTING_MIN: 80,
  FASTING_MAX: 130,
  POST_MEAL_MAX: 180,
  VERY_HIGH: 250,
} as const;

export const STEP_GOAL = 7000;
export const WATER_GOAL_ML = 2000;
export const SLEEP_GOAL_HOURS = 7;

// ---------- Dates (local, YYYY-MM-DD) ---------------------------------------
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const todayISO = () => toISODate(new Date());

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}
export function daysBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
}
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
export function dateRange(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}
export function inWindow<T extends { date: string }>(rows: T[], end: string, days: number): T[] {
  const start = addDays(end, -(days - 1));
  return rows.filter((c) => c.date >= start && c.date <= end);
}

// ---------- Aggregates -------------------------------------------------------
function avg(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length;
}

export interface PeriodStats {
  loggedDays: number;
  avgFasting: number | null;
  avgPostMeal: number | null;
  timeInRange: number | null; // % readings between LOW and POST_MEAL_MAX
  adherence: number | null;   // % of days meds_taken = true (of days answered)
  avgSleep: number | null;
  avgSteps: number | null;
  avgWater: number | null;
  latestWeight: number | null;
  weightChange: number | null; // latest - first
  lows: number;
  highs: number;
}

export function computeStats(rows: DailyCheckIn[]): PeriodStats {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const readings = sorted
    .flatMap((c) => [c.glucose_fasting, c.glucose_post_meal])
    .filter((v): v is number => typeof v === 'number');
  const medDays = sorted.filter((c) => c.meds_taken !== null);
  const weights = sorted.map((c) => c.weight_kg).filter((v): v is number => typeof v === 'number');
  const latestWeight = weights.length ? weights[weights.length - 1] : null;
  return {
    loggedDays: sorted.length,
    avgFasting: avg(sorted.map((c) => c.glucose_fasting)),
    avgPostMeal: avg(sorted.map((c) => c.glucose_post_meal)),
    timeInRange:
      readings.length > 0
        ? (readings.filter((r) => r >= GLUCOSE.LOW && r <= GLUCOSE.POST_MEAL_MAX).length / readings.length) * 100
        : null,
    adherence: medDays.length > 0 ? (medDays.filter((c) => c.meds_taken).length / medDays.length) * 100 : null,
    avgSleep: avg(sorted.map((c) => c.sleep_hours)),
    avgSteps: avg(sorted.map((c) => c.steps)),
    avgWater: avg(sorted.map((c) => c.water_ml)),
    latestWeight,
    weightChange: latestWeight !== null && weights.length >= 2 ? latestWeight - weights[0] : null,
    lows: readings.filter((r) => r < GLUCOSE.LOW).length,
    highs: readings.filter((r) => r >= GLUCOSE.VERY_HIGH).length,
  };
}

export function loggingStreak(rows: DailyCheckIn[], today = todayISO()): number {
  const dates = new Set(rows.map((c) => c.date));
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export type ReadingStatus = 'low' | 'in_range' | 'high' | 'very_high';

export function readingStatus(value: number, kind: 'fasting' | 'post_meal'): ReadingStatus {
  if (value < GLUCOSE.LOW) return 'low';
  if (value >= GLUCOSE.VERY_HIGH) return 'very_high';
  const max = kind === 'fasting' ? GLUCOSE.FASTING_MAX : GLUCOSE.POST_MEAL_MAX;
  return value > max ? 'high' : 'in_range';
}

// ---------- Early-warning alerts --------------------------------------------
export function evaluateAlerts(rows: DailyCheckIn[], today = todayISO()): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted.filter((c) => daysBetween(c.date, today) <= 2);

  for (const c of recent) {
    const values = [c.glucose_fasting, c.glucose_post_meal].filter((v): v is number => typeof v === 'number');
    const low = values.find((v) => v < GLUCOSE.LOW);
    if (low !== undefined) {
      alerts.push({
        id: `low-${c.date}`,
        severity: 'critical',
        title: `Low blood sugar: ${low} mg/dL`,
        detail: `Recorded ${longDate(c.date)}. Below ${GLUCOSE.LOW} mg/dL is outside the target range.`,
        action: 'Talk to your doctor if you feel unwell or this happens again.',
        date: c.date,
      });
      break;
    }
  }
  for (const c of recent) {
    const values = [c.glucose_fasting, c.glucose_post_meal].filter((v): v is number => typeof v === 'number');
    const high = values.find((v) => v >= GLUCOSE.VERY_HIGH);
    if (high !== undefined) {
      alerts.push({
        id: `very-high-${c.date}`,
        severity: 'critical',
        title: `Very high blood sugar: ${high} mg/dL`,
        detail: `Recorded ${longDate(c.date)}. Readings at or above ${GLUCOSE.VERY_HIGH} mg/dL need attention.`,
        action: 'Talk to your doctor today if it stays high or you feel unwell.',
        date: c.date,
      });
      break;
    }
  }

  const lastThree = sorted.filter((c) => daysBetween(c.date, today) <= 4).slice(0, 3);
  const consecutiveHigh =
    lastThree.length === 3 &&
    daysBetween(lastThree[2].date, lastThree[0].date) === 2 &&
    lastThree.every((c) => (c.glucose_fasting ?? 0) > GLUCOSE.FASTING_MAX);
  if (consecutiveHigh) {
    const values = lastThree.map((c) => c.glucose_fasting).reverse().join(', ');
    alerts.push({
      id: `fasting-trend-${lastThree[0].date}`,
      severity: 'warning',
      title: 'Fasting sugar above target 3 days running',
      detail: `Last three mornings: ${values} mg/dL (target ${GLUCOSE.FASTING_MIN}–${GLUCOSE.FASTING_MAX}).`,
      action: 'Talk to your doctor if this continues this week.',
      date: lastThree[0].date,
    });
  }

  const missed = lastThree.filter((c) => c.meds_taken === false);
  if (lastThree.length >= 2 && missed.length >= 2) {
    alerts.push({
      id: `meds-${lastThree[0].date}`,
      severity: 'warning',
      title: `Medication missed on ${missed.length} of the last ${lastThree.length} days`,
      detail: `Missed on ${missed.map((c) => longDate(c.date)).join(' and ')}.`,
      action: 'Set a daily reminder at the same time as a fixed habit, such as breakfast.',
      date: lastThree[0].date,
    });
  }

  return alerts;
}

// ---------- Coach insights (descriptive, never diagnostic) ------------------
export interface Insight {
  tone: 'positive' | 'watch';
  text: string;
}

export function findInsights(week: DailyCheckIn[], previous: DailyCheckIn[] = []): Insight[] {
  const out: Insight[] = [];
  const all = new Map([...previous, ...week].map((c) => [c.date, c]));

  const afterMissed: number[] = [];
  const afterTaken: number[] = [];
  for (const c of week) {
    const prev = all.get(addDays(c.date, -1));
    if (!prev || prev.meds_taken === null || c.glucose_fasting === null) continue;
    (prev.meds_taken ? afterTaken : afterMissed).push(c.glucose_fasting);
  }
  const missedAvg = avg(afterMissed);
  const takenAvg = avg(afterTaken);
  if (missedAvg !== null && takenAvg !== null && missedAvg - takenAvg >= 10) {
    out.push({
      tone: 'watch',
      text: `Mornings after a missed dose, fasting sugar averaged ${Math.round(missedAvg)} mg/dL vs ${Math.round(takenAvg)} after taking it.`,
    });
  }

  const activeAvg = avg(week.filter((c) => (c.steps ?? 0) >= STEP_GOAL).map((c) => c.glucose_post_meal));
  const lazyAvg = avg(week.filter((c) => c.steps !== null && c.steps < STEP_GOAL).map((c) => c.glucose_post_meal));
  if (activeAvg !== null && lazyAvg !== null && lazyAvg - activeAvg >= 15) {
    out.push({
      tone: 'positive',
      text: `On days with ${STEP_GOAL.toLocaleString()}+ steps, after-meal sugar was ${Math.round(lazyAvg - activeAvg)} mg/dL lower.`,
    });
  }

  const now = computeStats(week);
  const before = computeStats(previous);
  if (now.avgFasting !== null && before.avgFasting !== null) {
    const diff = now.avgFasting - before.avgFasting;
    if (Math.abs(diff) >= 5) {
      out.push({
        tone: diff < 0 ? 'positive' : 'watch',
        text: `Average fasting sugar ${diff < 0 ? 'fell' : 'rose'} ${Math.abs(Math.round(diff))} mg/dL compared with the week before.`,
      });
    }
  }
  if (now.adherence !== null && now.adherence >= 90) {
    out.push({ tone: 'positive', text: `Medication taken on ${Math.round(now.adherence)}% of days.` });
  }
  if (now.loggedDays >= 5) {
    out.push({ tone: 'positive', text: `Logged ${now.loggedDays} of 7 days. Consistent logging makes the patterns reliable.` });
  }
  return out;
}

// ---------- Demo data --------------------------------------------------------
function seededRandom(seed: number) {
  let t = seed;
  return () => {
    t = (t * 9301 + 49297) % 233280;
    return t / 233280;
  };
}

export function generateDemoCheckIns(end = addDays(todayISO(), -1)): Omit<import('@/types').CheckInInput, never>[] {
  const rand = seededRandom(42);
  const days = dateRange(end, 14);
  return days.map((date, i) => {
    const fromEnd = days.length - 1 - i;
    const missed = fromEnd === 1 || fromEnd === 2 || i === 4;
    const rising = fromEnd <= 2;
    const steps = Math.round(4000 + rand() * 6500);
    const sleep = Math.round((5.2 + rand() * 2.6) * 2) / 2;
    let fasting = 108 + rand() * 18;
    if (rising) fasting = 134 + rand() * 10;
    if (sleep < 6) fasting += 8;
    let postMeal = 150 + rand() * 25;
    if (steps >= STEP_GOAL) postMeal -= 22;
    if (rising) postMeal += 18;
    return {
      date,
      mood: rising ? 'okay' : 'good',
      energy_level: rising ? 5 : 7,
      sleep_hours: sleep,
      sleep_quality: sleep >= 7 ? 4 : 3,
      weight_kg: Math.round((78 + rand() * 0.6) * 10) / 10,
      water_ml: 1500 + Math.round(rand() * 1200 / 250) * 250,
      meds_taken: !missed,
      glucose_fasting: Math.round(fasting),
      glucose_post_meal: Math.round(postMeal),
      steps,
      notes: missed && fromEnd <= 2 ? 'Travelling, forgot evening tablet' : null,
    };
  });
}
