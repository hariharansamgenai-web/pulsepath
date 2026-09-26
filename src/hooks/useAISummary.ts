/**
 * useAISummary — calls Gemini 2.0 Flash directly from the browser.
 * No Edge Function required. The API key is a Gemini key (not OpenAI).
 *
 * Security: Gemini Flash is used for structured health summaries only.
 * The prompt hard-blocks diagnosis, medication advice, and medical decisions.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { todayISO, addDays } from '@/lib/health';


export interface SummaryResult {
  summary: string;
  period_days: number;
  period_start: string;
  period_end: string;
  disclaimer: string;
}

const SYSTEM_PROMPT = `You are a supportive health coach for a patient managing Type 2 Diabetes.
You will receive aggregated health statistics from their health tracking app.
Write a warm, plain-language summary of their health patterns over the period.

STRICT RULES — never violate these:
- NEVER diagnose any condition.
- NEVER recommend or comment on medications or dosages.
- NEVER make medical decisions or treatment suggestions.
- NEVER reference specific lab values as diagnostic thresholds.
- ALWAYS end with: "This is an informational summary only — not medical advice. Please consult your healthcare provider for medical decisions."

FORMAT:
- 3 to 5 short paragraphs
- Plain English, no medical jargon
- Start with what went well, then patterns to watch, then one actionable habit tip
- Keep it under 250 words`;

export function useAISummary() {
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(profileId: string, days: number) {
    setLoading(true);
    setError(null);

    try {
      // ── 1. Fetch aggregated stats from Supabase ──────────────────────
      const today = todayISO();
      const since = addDays(today, -days);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to generate a summary.');

      const [{ data: checkIns }, { data: activities }, { data: goals }] = await Promise.all([
        supabase.from('daily_checkins').select(
          'date,glucose_fasting,glucose_post_meal,meds_taken,steps,water_ml,sleep_hours,weight_kg'
        ).eq('profile_id', profileId).gte('date', since).lte('date', today).order('date'),
        supabase.from('activities').select('date,activity_type,duration_min,calories_burned')
          .eq('profile_id', profileId).gte('date', since).lte('date', today),
        supabase.from('goals').select('title,category,target_value,unit,status')
          .eq('profile_id', profileId).eq('status', 'active'),
      ]);

      if (!checkIns?.length) {
        throw new Error('No check-in data found for this period. Log some check-ins first, then try again.');
      }

      // ── 2. Aggregate stats ───────────────────────────────────────────
      const n = checkIns.length;
      const fastingVals = checkIns.filter(c => c.glucose_fasting != null).map(c => c.glucose_fasting as number);
      const postVals    = checkIns.filter(c => c.glucose_post_meal != null).map(c => c.glucose_post_meal as number);
      const stepVals    = checkIns.filter(c => c.steps != null).map(c => c.steps as number);
      const waterVals   = checkIns.filter(c => c.water_ml != null).map(c => c.water_ml as number);
      const sleepVals   = checkIns.filter(c => c.sleep_hours != null).map(c => c.sleep_hours as number);
      const medsDays    = checkIns.filter(c => c.meds_taken === true).length;
      const weights     = checkIns.filter(c => c.weight_kg != null).map(c => c.weight_kg as number);
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

      const stats = {
        period_days: days,
        days_logged: n,
        medication_adherence_pct: n > 0 ? Math.round((medsDays / n) * 100) : null,
        avg_fasting_glucose:   fastingVals.length ? Math.round(avg(fastingVals)!) : null,
        avg_postmeal_glucose:  postVals.length    ? Math.round(avg(postVals)!) : null,
        avg_steps:             stepVals.length    ? Math.round(avg(stepVals)!) : null,
        avg_water_ml:          waterVals.length   ? Math.round(avg(waterVals)!) : null,
        avg_sleep_hours:       sleepVals.length   ? (avg(sleepVals)!).toFixed(1) : null,
        weight_start:          weights.length > 0 ? weights[0] : null,
        weight_end:            weights.length > 0 ? weights[weights.length - 1] : null,
        total_activities:      activities?.length ?? 0,
        total_exercise_min:    activities?.reduce((s, a) => s + (a.duration_min ?? 0), 0) ?? 0,
        active_goals:          goals?.map(g => `${g.title} (${g.target_value} ${g.unit})`).join(', ') ?? 'none',
      };

      // ── 3. Call Gemini ───────────────────────────────────────────────
      const userPrompt = `Here are the aggregated health stats for the past ${days} days:
Days logged: ${stats.days_logged} of ${days}
Medication taken: ${stats.medication_adherence_pct != null ? stats.medication_adherence_pct + '%' : 'not recorded'}
Average fasting blood sugar: ${stats.avg_fasting_glucose != null ? stats.avg_fasting_glucose + ' mg/dL' : 'not recorded'}
Average post-meal blood sugar: ${stats.avg_postmeal_glucose != null ? stats.avg_postmeal_glucose + ' mg/dL' : 'not recorded'}
Average daily steps: ${stats.avg_steps != null ? stats.avg_steps.toLocaleString() : 'not recorded'}
Average water intake: ${stats.avg_water_ml != null ? (stats.avg_water_ml / 1000).toFixed(1) + ' L/day' : 'not recorded'}
Average sleep: ${stats.avg_sleep_hours != null ? stats.avg_sleep_hours + ' hours/night' : 'not recorded'}
Weight: ${stats.weight_start != null ? stats.weight_start + ' kg → ' + stats.weight_end + ' kg' : 'not recorded'}
Exercise sessions: ${stats.total_activities} (${stats.total_exercise_min} minutes total)
Active goals: ${stats.active_goals}

Write the health pattern summary now.`;

      const geminiBody = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.4 },
      };

      const { data: proxyData, error: fnError } = await supabase.functions.invoke('gemini-proxy', {
        body: { model: 'gemini-2.0-flash', body: geminiBody },
      });

      if (fnError) throw new Error(fnError.message ?? 'Could not reach AI service.');
      if (proxyData?.error) throw new Error(String(proxyData.error));

      const data = proxyData;
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) throw new Error('Gemini returned an empty response. Please try again.');

      const disclaimer = 'This is an informational summary only — not medical advice. Please consult your healthcare provider for medical decisions.';

      setResult({
        summary: text.includes(disclaimer) ? text : text + '\n\n' + disclaimer,
        period_days: days,
        period_start: since,
        period_end: today,
        disclaimer,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return {
    result,
    loading,
    error,
    generate,
    reset: () => { setResult(null); setError(null); },
  };
}
