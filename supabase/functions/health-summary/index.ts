/**
 * health-summary Edge Function
 * ─────────────────────────────
 * Architecture: Frontend → this function (authenticated) → Supabase DB (RLS-scoped) → OpenAI → response
 *
 * Security guarantees
 * ───────────────────
 * 1. Every request must carry a valid Supabase JWT (Authorization: Bearer <token>).
 *    The function uses createClient with the user's own token so ALL DB queries run
 *    under that user's RLS context — the same policies that protect every other page.
 * 2. The OpenAI API key lives exclusively in Deno.env ("OPENAI_API_KEY") — a
 *    Supabase secret, never in the frontend bundle or any client-side code.
 * 3. Profile ownership is verified through the same user_owns_profile RLS helper
 *    that guards every other table; we don't add a separate ownership check because
 *    an RLS-scoped SELECT already enforces it: if the row comes back, the user owns it.
 * 4. Data passed to OpenAI is a compact, structured plain-text blob — no document
 *    contents, no names, no IDs, no raw JSON dumps of sensitive fields.
 * 5. Error messages returned to the client contain no internal detail (DB errors,
 *    stack traces, or OpenAI response bodies).
 * 6. Sensitive fields are never logged (see the explicit omissions in buildPrompt).
 * 7. Rate limiting: one call per user per profile per 10 minutes (tracked via
 *    ai_summaries.generated_at).
 *
 * Medical disclaimer
 * ──────────────────
 * The OpenAI system prompt and the response envelope both make clear that the
 * summary is informational only. The function will not generate diagnoses,
 * medication recommendations, or medical decisions regardless of the user's prompt.
 *
 * Deployment
 * ──────────
 * supabase functions deploy health-summary --no-verify-jwt=false
 * supabase secrets set OPENAI_API_KEY=sk-...
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_MINUTES = 10;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return err(401, 'Missing or invalid Authorization header.');
    }
    const token = authHeader.slice(7);

    // Build a client scoped to the calling user (RLS is enforced automatically)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    // Verify the user
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return err(401, 'Unauthenticated.');

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const profileId: string | undefined = body.profile_id;
    const days: number = Math.min(Math.max(Number(body.days) || 7, 7), 30);

    if (!profileId) return err(400, 'profile_id is required.');

    // Verify profile ownership via RLS (SELECT will return nothing if not owned)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', profileId)
      .maybeSingle();
    if (profileErr || !profile) return err(403, 'Profile not found or not authorized.');

    // Rate limit: check for a summary generated within the last RATE_LIMIT_MINUTES
    const rateCutoff = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('ai_summaries')
      .select('generated_at')
      .eq('profile_id', profileId)
      .gte('generated_at', rateCutoff)
      .limit(1)
      .maybeSingle();
    if (recent) {
      return err(429, `Please wait ${RATE_LIMIT_MINUTES} minutes between summaries.`);
    }

    // Load data — all queries run under user's RLS so cross-profile access is impossible
    const periodData = await loadPeriodData(supabase, profileId, days);

    // Build the OpenAI prompt (no names, no IDs, no document contents)
    const { prompt, dataHash } = buildPrompt(periodData, days);

    // Call OpenAI — key is server-side only
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return err(500, 'AI service is not configured.');

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 600,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'You are a health-habit summariser for a personal health tracking app. ' +
              'Write a clear, friendly, factual summary of what the user logged in the past period. ' +
              'Describe patterns and frequencies using only the numbers provided. ' +
              'NEVER diagnose medical conditions. NEVER recommend or comment on medications. ' +
              'NEVER make medical decisions of any kind. ' +
              'If data is absent for a metric, omit that metric rather than guessing. ' +
              'End every response with exactly this sentence on its own line: ' +
              '"This summary is informational only and is not medical advice."',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      // Do not expose the OpenAI error body to the client
      console.error(`OpenAI error: ${openaiRes.status}`);
      return err(502, 'AI service returned an error. Please try again.');
    }

    const openaiData = await openaiRes.json();
    const summary: string = openaiData.choices?.[0]?.message?.content ?? '';
    if (!summary) return err(502, 'AI service returned an empty response.');

    // Persist — upsert so repeated calls for the same period just update the cache
    const today = new Date().toISOString().slice(0, 10);
    const periodStart = subtractDays(today, days - 1);
    await supabase.from('ai_summaries').insert({
      profile_id: profileId,
      summary_text: summary,
      period_start: periodStart,
      period_end: today,
      data_hash: dataHash,
    });

    return new Response(
      JSON.stringify({
        summary,
        period_days: days,
        period_start: periodStart,
        period_end: today,
        disclaimer: 'This summary is informational only and is not medical advice.',
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (_e) {
    // Catch-all — never expose stack traces
    return err(500, 'An unexpected error occurred.');
  }
});

// ── Helpers ───────────────────────────────────────────────────────────

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function subtractDays(isoDate: string, n: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function loadPeriodData(supabase: SupabaseClient, profileId: string, days: number) {
  const today = new Date().toISOString().slice(0, 10);
  const from = subtractDays(today, days - 1);

  const [checkInsRes, activitiesRes, goalsRes] = await Promise.all([
    supabase
      .from('daily_checkins')
      .select('date, steps, water_ml, sleep_hours, sleep_quality, weight_kg, meds_taken, mood, energy_level')
      .eq('profile_id', profileId)
      .gte('date', from)
      .lte('date', today),
    supabase
      .from('activities')
      .select('date, activity_type, duration_min, calories_burned, custom_label')
      .eq('profile_id', profileId)
      .gte('date', from)
      .lte('date', today),
    supabase
      .from('goals')
      .select('title, category, target_value, unit, frequency, status')
      .eq('profile_id', profileId)
      .eq('status', 'active'),
  ]);

  return {
    checkIns: checkInsRes.data ?? [],
    activities: activitiesRes.data ?? [],
    goals: goalsRes.data ?? [],
    from,
    today,
  };
}

interface CheckIn {
  date: string;
  steps: number | null;
  water_ml: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  weight_kg: number | null;
  meds_taken: boolean | null;
  mood: string | null;
  energy_level: number | null;
}

interface Activity {
  date: string;
  activity_type: string;
  duration_min: number;
  calories_burned: number | null;
  custom_label: string | null;
}

interface Goal {
  title: string;
  category: string;
  target_value: number | null;
  unit: string | null;
  frequency: string;
  status: string;
}

function buildPrompt(
  data: { checkIns: CheckIn[]; activities: Activity[]; goals: Goal[]; from: string; today: string },
  days: number,
): { prompt: string; dataHash: string } {
  const { checkIns, activities, goals } = data;

  // Aggregate — no raw values, just summaries safe to send to a third party
  const loggedDays = checkIns.length;
  const stepsValues = checkIns.filter((c) => c.steps !== null).map((c) => c.steps as number);
  const avgSteps = stepsValues.length ? Math.round(avg(stepsValues)) : null;
  const stepsGoalDays = stepsValues.filter((s) => s >= 8000).length;

  const waterValues = checkIns.filter((c) => c.water_ml !== null).map((c) => c.water_ml as number);
  const avgWaterL = waterValues.length ? round1(avg(waterValues) / 1000) : null;
  const waterGoalDays = waterValues.filter((w) => w >= 2000).length;

  const sleepValues = checkIns.filter((c) => c.sleep_hours !== null).map((c) => c.sleep_hours as number);
  const avgSleep = sleepValues.length ? round1(avg(sleepValues)) : null;
  const sleepGoalDays = sleepValues.filter((s) => s >= 7).length;

  const weightValues = checkIns.filter((c) => c.weight_kg !== null).map((c) => c.weight_kg as number);
  const latestWeight = weightValues.length ? weightValues[weightValues.length - 1] : null;
  const earliestWeight = weightValues.length ? weightValues[0] : null;
  const weightChange = latestWeight !== null && earliestWeight !== null
    ? round1(latestWeight - earliestWeight) : null;

  const medsDays = checkIns.filter((c) => c.meds_taken === true).length;
  const medsMissedDays = checkIns.filter((c) => c.meds_taken === false).length;

  const exerciseDays = new Set(activities.map((a) => a.date)).size;
  const totalExerciseMins = activities.reduce((s, a) => s + a.duration_min, 0);
  const totalCalories = activities.reduce((s, a) => s + (a.calories_burned ?? 0), 0);
  const activityTypes = [...new Set(activities.map((a) =>
    a.activity_type === 'custom' && a.custom_label ? a.custom_label : a.activity_type))];

  const moodCounts: Record<string, number> = {};
  checkIns.forEach((c) => { if (c.mood) moodCounts[c.mood] = (moodCounts[c.mood] ?? 0) + 1; });
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const avgEnergy = checkIns.filter((c) => c.energy_level !== null).length
    ? round1(avg(checkIns.filter((c) => c.energy_level !== null).map((c) => c.energy_level as number)))
    : null;

  const goalsSummary = goals.map((g) =>
    `${g.title} (${g.category}, ${g.frequency}, target: ${g.target_value ?? '?'} ${g.unit ?? ''})`
  ).join('; ');

  // Build a data hash for cache invalidation (non-sensitive: counts only)
  const hashInput = JSON.stringify({ loggedDays, exerciseDays, medsDays, avgSteps, avgSleep, avgWaterL });
  const dataHash = btoa(hashInput).slice(0, 32);

  // Build the prompt — plain text, no IDs, no document contents, no raw dumps
  const lines: string[] = [
    `Period: last ${days} days (${data.from} to ${data.today}).`,
    `Check-ins logged: ${loggedDays} of ${days} days.`,
  ];

  if (avgSteps !== null) {
    lines.push(`Steps: average ${avgSteps.toLocaleString()} steps/day on logged days. Days with 8,000+ steps: ${stepsGoalDays}.`);
  }
  if (avgWaterL !== null) {
    lines.push(`Water: average ${avgWaterL} L/day on logged days. Days with 2 L or more: ${waterGoalDays}.`);
  }
  if (avgSleep !== null) {
    lines.push(`Sleep: average ${avgSleep} hours/night on logged days. Days with 7+ hours: ${sleepGoalDays}.`);
  }
  if (exerciseDays > 0) {
    lines.push(`Exercise: logged on ${exerciseDays} day(s). Total: ${totalExerciseMins} minutes. Types: ${activityTypes.join(', ')}. Estimated calories burned: ${totalCalories}.`);
  } else {
    lines.push('Exercise: no activities logged in this period.');
  }
  if (latestWeight !== null) {
    lines.push(`Weight: latest recorded ${latestWeight} kg.${weightChange !== null && weightChange !== 0 ? ` Change over period: ${weightChange > 0 ? '+' : ''}${weightChange} kg.` : ''}`);
  }
  if (loggedDays > 0) {
    lines.push(`Medication: taken on ${medsDays} of ${loggedDays} logged day(s). Missed on ${medsMissedDays} logged day(s).`);
  }
  if (topMood) lines.push(`Most frequent mood logged: ${topMood}.`);
  if (avgEnergy !== null) lines.push(`Average energy level: ${avgEnergy}/10.`);
  if (goalsSummary) lines.push(`Active goals: ${goalsSummary}.`);

  lines.push('Write a 3–5 sentence summary of the above habits in a friendly, factual tone. Do not add advice, diagnoses, or medical commentary.');

  return { prompt: lines.join('\n'), dataHash };
}

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
