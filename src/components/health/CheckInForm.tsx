import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Droplet, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { saveCheckIn } from '@/lib/checkins';
import { GLUCOSE, todayISO } from '@/lib/health';
import { cn } from '@/lib/utils';
import type { CheckInInput, DailyCheckIn, Mood } from '@/types';

const MOODS: { value: Mood; label: string }[] = [
  { value: 'great', label: 'Great' },
  { value: 'good', label: 'Good' },
  { value: 'okay', label: 'Okay' },
  { value: 'low', label: 'Low' },
  { value: 'poor', label: 'Poor' },
];

const SLEEP_QUALITY = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
];

const WATER_STEP_ML = 250; // one glass

interface FormState {
  date: string;
  meds_taken: boolean | null;
  glucose_fasting: string;
  glucose_post_meal: string;
  steps: string;
  weight_kg: string;
  sleep_hours: string;
  sleep_quality: number | null;
  water_ml: number;
  mood: Mood | null;
  energy_level: number | null;
  notes: string;
}

function fromCheckIn(c: DailyCheckIn | null, date: string): FormState {
  return {
    date: c?.date ?? date,
    meds_taken: c?.meds_taken ?? null,
    glucose_fasting: c?.glucose_fasting?.toString() ?? '',
    glucose_post_meal: c?.glucose_post_meal?.toString() ?? '',
    steps: c?.steps?.toString() ?? '',
    weight_kg: c?.weight_kg?.toString() ?? '',
    sleep_hours: c?.sleep_hours?.toString() ?? '',
    sleep_quality: c?.sleep_quality ?? null,
    water_ml: c?.water_ml ?? 0,
    mood: c?.mood ?? null,
    energy_level: c?.energy_level ?? null,
    notes: c?.notes ?? '',
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

function parseNum(v: string, min: number, max: number, label: string, errs: Errors, key: keyof FormState) {
  if (v.trim() === '') return null;
  const n = Number(v);
  if (Number.isNaN(n) || n < min || n > max) {
    errs[key] = `${label} must be between ${min} and ${max}.`;
    return null;
  }
  return n;
}

interface CheckInFormProps {
  profileId: string;
  existing: DailyCheckIn | null;
  onSaved: (checkIn: DailyCheckIn) => void;
  onDateChange?: (date: string) => void;
  onCancel?: () => void;
}

export function CheckInForm({ profileId, existing, onSaved, onDateChange, onCancel }: CheckInFormProps) {
  const [form, setForm] = useState<FormState>(() => fromCheckIn(existing, todayISO()));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setForm((f) => fromCheckIn(existing, existing?.date ?? f.date));
    setErrors({});
    setSaveError(null);
  }, [existing]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    const input: CheckInInput = {
      date: form.date,
      meds_taken: form.meds_taken,
      glucose_fasting: parseNum(form.glucose_fasting, 20, 600, 'Fasting sugar', errs, 'glucose_fasting'),
      glucose_post_meal: parseNum(form.glucose_post_meal, 20, 600, 'After-meal sugar', errs, 'glucose_post_meal'),
      steps: parseNum(form.steps, 0, 100000, 'Steps', errs, 'steps'),
      weight_kg: parseNum(form.weight_kg, 1, 400, 'Weight', errs, 'weight_kg'),
      sleep_hours: parseNum(form.sleep_hours, 0, 24, 'Sleep', errs, 'sleep_hours'),
      sleep_quality: form.sleep_quality,
      water_ml: form.water_ml || null,
      mood: form.mood,
      energy_level: form.energy_level,
      notes: form.notes.trim() || null,
    };
    if (!form.date) errs.date = 'Choose a date.';
    if (form.date > todayISO()) errs.date = 'You can’t log a future date.';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      onSaved(await saveCheckIn(profileId, input));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the check-in.');
    } finally {
      setSaving(false);
    }
  }

  const waterGlasses = Math.round(form.water_ml / WATER_STEP_ML);

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Date"
          type="date"
          name="date"
          value={form.date}
          max={todayISO()}
          error={errors.date}
          onChange={(e) => {
            set('date', e.target.value);
            onDateChange?.(e.target.value);
          }}
        />
        <Field label="Took my diabetes medication" error={errors.meds_taken}>
          <div className="grid grid-cols-2 gap-2">
            {[{ v: true, label: 'Yes' }, { v: false, label: 'Missed' }].map((o) => (
              <Choice key={o.label} selected={form.meds_taken === o.v} onClick={() => set('meds_taken', form.meds_taken === o.v ? null : o.v)} tone={o.v ? 'good' : 'watch'}>
                {o.label}
              </Choice>
            ))}
          </div>
        </Field>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-neutral-900">Blood sugar (mg/dL)</legend>
        <Input
          label="Fasting (morning)"
          name="glucose_fasting"
          type="number"
          inputMode="decimal"
          placeholder="e.g. 118"
          value={form.glucose_fasting}
          error={errors.glucose_fasting}
          helperText={`Target ${GLUCOSE.FASTING_MIN}–${GLUCOSE.FASTING_MAX}`}
          onChange={(e) => set('glucose_fasting', e.target.value)}
        />
        <Input
          label="2 hours after a meal"
          name="glucose_post_meal"
          type="number"
          inputMode="decimal"
          placeholder="e.g. 160"
          value={form.glucose_post_meal}
          error={errors.glucose_post_meal}
          helperText={`Target under ${GLUCOSE.POST_MEAL_MAX}`}
          onChange={(e) => set('glucose_post_meal', e.target.value)}
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-neutral-900">Body & activity</legend>
        <Input label="Weight (kg)" name="weight_kg" type="number" inputMode="decimal" step="0.1" placeholder="e.g. 78.4" value={form.weight_kg} error={errors.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} />
        <Input label="Steps" name="steps" type="number" inputMode="numeric" placeholder="e.g. 6500" value={form.steps} error={errors.steps} onChange={(e) => set('steps', e.target.value)} />
        <Field label="Water (glasses)">
          <div className="flex items-center gap-2">
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40" aria-label="One less glass" disabled={waterGlasses === 0} onClick={() => set('water_ml', Math.max(0, form.water_ml - WATER_STEP_ML))}>
              <Minus className="h-4 w-4" />
            </button>
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2">
              <Droplet className="h-4 w-4 text-primary-600" />
              <span className="text-lg font-semibold tabular-nums">{waterGlasses}</span>
              <span className="text-xs text-neutral-500">({form.water_ml} ml)</span>
            </div>
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40" aria-label="One more glass" disabled={waterGlasses >= 20} onClick={() => set('water_ml', Math.min(20 * WATER_STEP_ML, form.water_ml + WATER_STEP_ML))}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-neutral-900">Sleep</legend>
        <Input label="Sleep last night (hours)" name="sleep_hours" type="number" inputMode="decimal" step="0.5" placeholder="e.g. 7" value={form.sleep_hours} error={errors.sleep_hours} onChange={(e) => set('sleep_hours', e.target.value)} />
        <Field label="Sleep quality">
          <div className="grid grid-cols-5 gap-2">
            {SLEEP_QUALITY.map((q) => (
              <Choice key={q.value} selected={form.sleep_quality === q.value} onClick={() => set('sleep_quality', form.sleep_quality === q.value ? null : q.value)}>
                {q.label}
              </Choice>
            ))}
          </div>
        </Field>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mood">
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <Choice key={m.value} selected={form.mood === m.value} onClick={() => set('mood', form.mood === m.value ? null : m.value)}>
                {m.label}
              </Choice>
            ))}
          </div>
        </Field>
        <Field label="Energy (1 = drained, 10 = full)">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <Choice key={n} selected={form.energy_level === n} onClick={() => set('energy_level', form.energy_level === n ? null : n)}>
                {n}
              </Choice>
            ))}
          </div>
        </Field>
      </div>

      <Textarea label="Notes" name="notes" rows={2} placeholder="Anything unusual: travel, illness, a big meal, a late dose" value={form.notes} onChange={(e) => set('notes', e.target.value)} />

      {saveError && <p role="alert" className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{saveError}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={saving}>
          {existing ? 'Update check-in' : 'Save check-in'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-sm font-medium text-neutral-700">{label}</p>
      {children}
      {error && <p className="mt-1.5 text-sm text-error-600">{error}</p>}
    </div>
  );
}

function Choice({ selected, onClick, tone, children }: { selected: boolean; onClick: () => void; tone?: 'good' | 'watch'; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'h-10 min-w-[3rem] rounded-lg border px-3 text-sm font-medium transition-colors',
        !selected && 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
        selected && tone === 'watch' && 'border-warning-500 bg-warning-50 text-warning-800',
        selected && tone !== 'watch' && 'border-primary-500 bg-primary-50 text-primary-800'
      )}
    >
      {children}
    </button>
  );
}
