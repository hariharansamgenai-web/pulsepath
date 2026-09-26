import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ACTIVITY_LABELS, ACTIVITY_TYPES, createActivity, updateActivity } from '@/lib/activities';
import { todayISO } from '@/lib/health';
import { cn } from '@/lib/utils';
import type { Activity, ActivityInput, ActivityType, ExerciseIntensity } from '@/types';

const INTENSITIES: { value: ExerciseIntensity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
];

interface FormState {
  activity_type: ActivityType | '';
  custom_label: string;
  date: string;
  start_time: string;
  duration_min: string;
  distance_km: string;
  calories_burned: string;
  intensity: ExerciseIntensity | null;
  notes: string;
}

function fromActivity(a: Activity | null): FormState {
  return {
    activity_type: a?.activity_type ?? '',
    custom_label: a?.custom_label ?? '',
    date: a?.date ?? todayISO(),
    start_time: a?.start_time?.slice(0, 5) ?? '',
    duration_min: a?.duration_min?.toString() ?? '',
    distance_km: a?.distance_km?.toString() ?? '',
    calories_burned: a?.calories_burned?.toString() ?? '',
    intensity: a?.intensity ?? null,
    notes: a?.notes ?? '',
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

interface ActivityFormProps {
  profileId: string;
  activity?: Activity | null;
  onSaved: (activity: Activity) => void;
  onCancel?: () => void;
}

export function ActivityForm({ profileId, activity, onSaved, onCancel }: ActivityFormProps) {
  const [form, setForm] = useState<FormState>(() => fromActivity(activity ?? null));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setForm(fromActivity(activity ?? null));
    setErrors({});
    setSaveError(null);
  }, [activity]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    if (!form.activity_type) errs.activity_type = 'Choose an activity type.';
    if (form.activity_type === 'custom' && !form.custom_label.trim()) errs.custom_label = 'Name the activity.';
    if (!form.date) errs.date = 'Choose a date.';
    else if (form.date > todayISO()) errs.date = 'You can’t log a future date.';
    const duration = Number(form.duration_min);
    if (!form.duration_min.trim() || Number.isNaN(duration) || duration <= 0) errs.duration_min = 'Enter a duration greater than 0.';
    const distance = form.distance_km.trim() === '' ? null : Number(form.distance_km);
    if (distance !== null && (Number.isNaN(distance) || distance < 0)) errs.distance_km = 'Distance can’t be negative.';
    const calories = form.calories_burned.trim() === '' ? null : Number(form.calories_burned);
    if (calories !== null && (Number.isNaN(calories) || calories < 0)) errs.calories_burned = 'Calories can’t be negative.';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const input: ActivityInput = {
        activity_type: form.activity_type as ActivityType,
        custom_label: form.activity_type === 'custom' ? form.custom_label.trim() : null,
        date: form.date,
        start_time: form.start_time || null,
        duration_min: duration,
        distance_km: distance,
        calories_burned: calories,
        intensity: form.intensity,
        notes: form.notes.trim() || null,
      };
      const saved = activity ? await updateActivity(activity.id, input) : await createActivity(profileId, input);
      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the activity.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Activity type"
          name="activity_type"
          value={form.activity_type}
          placeholder="Choose…"
          error={errors.activity_type}
          options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABELS[t] }))}
          onChange={(e) => set('activity_type', e.target.value as ActivityType)}
        />
        {form.activity_type === 'custom' && (
          <Input label="Activity name" name="custom_label" placeholder="e.g. Badminton" value={form.custom_label} error={errors.custom_label} onChange={(e) => set('custom_label', e.target.value)} />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Date" name="date" type="date" max={todayISO()} value={form.date} error={errors.date} onChange={(e) => set('date', e.target.value)} />
        <Input label="Start time" name="start_time" type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} helperText="Optional" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Duration (minutes)" name="duration_min" type="number" inputMode="numeric" placeholder="e.g. 30" value={form.duration_min} error={errors.duration_min} onChange={(e) => set('duration_min', e.target.value)} />
        <Input label="Distance (km)" name="distance_km" type="number" inputMode="decimal" step="0.1" placeholder="Optional" value={form.distance_km} error={errors.distance_km} onChange={(e) => set('distance_km', e.target.value)} />
        <Input label="Calories" name="calories_burned" type="number" inputMode="numeric" placeholder="Optional" value={form.calories_burned} error={errors.calories_burned} onChange={(e) => set('calories_burned', e.target.value)} />
      </div>

      <Field label="Intensity">
        <div className="grid grid-cols-3 gap-2">
          {INTENSITIES.map((i) => (
            <Choice key={i.value} selected={form.intensity === i.value} onClick={() => set('intensity', form.intensity === i.value ? null : i.value)}>
              {i.label}
            </Choice>
          ))}
        </div>
      </Field>

      <Textarea label="Notes" name="notes" rows={2} placeholder="Route, how it felt, anything worth remembering" value={form.notes} onChange={(e) => set('notes', e.target.value)} />

      {saveError && <p role="alert" className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{saveError}</p>}

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" loading={saving}>{activity ? 'Save changes' : 'Log activity'}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-sm font-medium text-neutral-700">{label}</p>
      {children}
    </div>
  );
}
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn('h-10 rounded-lg border text-sm font-medium transition-colors', selected ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50')}
    >
      {children}
    </button>
  );
}
