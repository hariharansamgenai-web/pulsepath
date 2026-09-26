import { useEffect, useState, type FormEvent } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { GOAL_CATEGORY_LABELS, GOAL_PRESETS, createGoal, updateGoal } from '@/lib/goals';
import { todayISO } from '@/lib/health';
import type { Goal, GoalCategory, GoalFrequency, GoalInput } from '@/types';

const CATEGORIES: GoalCategory[] = ['exercise', 'nutrition', 'sleep', 'weight', 'mental_health', 'other'];

interface FormState {
  title: string;
  category: GoalCategory | '';
  target_value: string;
  unit: string;
  frequency: GoalFrequency;
  start_date: string;
  target_date: string;
  reminder_enabled: boolean;
  reminder_time: string;
}

function fromGoal(g: Goal | null): FormState {
  return {
    title: g?.title ?? '',
    category: g?.category ?? '',
    target_value: g?.target_value?.toString() ?? '',
    unit: g?.unit ?? '',
    frequency: g?.frequency ?? 'daily',
    start_date: g?.start_date ?? todayISO(),
    target_date: g?.target_date ?? '',
    reminder_enabled: g?.reminder_enabled ?? false,
    reminder_time: g?.reminder_time?.slice(0, 5) ?? '07:00',
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

interface GoalFormProps {
  profileId: string;
  goal?: Goal | null;
  onSaved: (goal: Goal) => void;
  onCancel?: () => void;
}

export function GoalForm({ profileId, goal, onSaved, onCancel }: GoalFormProps) {
  const [form, setForm] = useState<FormState>(() => fromGoal(goal ?? null));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setForm(fromGoal(goal ?? null));
    setErrors({});
    setSaveError(null);
  }, [goal]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyPreset(index: number) {
    const p = GOAL_PRESETS[index].goal;
    setForm({
      title: p.title,
      category: p.category,
      target_value: p.target_value?.toString() ?? '',
      unit: p.unit ?? '',
      frequency: p.frequency,
      start_date: todayISO(),
      target_date: '',
      reminder_enabled: false,
      reminder_time: '07:00',
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    const title = form.title.trim();
    if (!title) errs.title = 'Give the goal a name.';
    if (!form.category) errs.category = 'Choose a category.';
    const target = form.target_value.trim() === '' ? null : Number(form.target_value);
    if (target !== null && (Number.isNaN(target) || target <= 0)) errs.target_value = 'Target must be greater than 0.';
    if (!form.unit.trim()) errs.unit = 'Add a unit, e.g. steps, minutes, L, hours.';
    if (!form.start_date) errs.start_date = 'Choose a start date.';
    if (form.target_date && form.target_date < form.start_date) errs.target_date = 'End date can’t be before the start date.';
    if (form.reminder_enabled && !form.reminder_time) errs.reminder_time = 'Set a reminder time.';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const input: GoalInput = {
        title,
        category: form.category as GoalCategory,
        target_value: target,
        unit: form.unit.trim(),
        frequency: form.frequency,
        start_date: form.start_date,
        target_date: form.target_date || null,
        reminder_enabled: form.reminder_enabled,
        reminder_time: form.reminder_enabled ? form.reminder_time : null,
      };
      const saved = goal ? await updateGoal(goal.id, input) : await createGoal(profileId, input);
      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the goal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {!goal && (
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">Quick start</p>
          <div className="flex flex-wrap gap-2">
            {GOAL_PRESETS.map((p, i) => (
              <button key={p.label} type="button" onClick={() => applyPreset(i)} className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-800">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Input label="Goal name" name="title" placeholder="e.g. Daily steps" value={form.title} error={errors.title} onChange={(e) => set('title', e.target.value)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Category" name="category" value={form.category} placeholder="Choose…" error={errors.category} options={CATEGORIES.map((c) => ({ value: c, label: GOAL_CATEGORY_LABELS[c] }))} onChange={(e) => set('category', e.target.value as GoalCategory)} />
        <Select
          label="Frequency"
          name="frequency"
          value={form.frequency}
          options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]}
          onChange={(e) => set('frequency', e.target.value as GoalFrequency)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Target" name="target_value" type="number" inputMode="decimal" placeholder="e.g. 8000" value={form.target_value} error={errors.target_value} onChange={(e) => set('target_value', e.target.value)} />
        <Input label="Unit" name="unit" placeholder="steps, minutes, L, hours, workouts…" value={form.unit} error={errors.unit} onChange={(e) => set('unit', e.target.value)} helperText="Progress is calculated automatically for steps, minutes, L/ml, hours and workouts." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Start date" name="start_date" type="date" value={form.start_date} error={errors.start_date} onChange={(e) => set('start_date', e.target.value)} />
        <Input label="End date" name="target_date" type="date" min={form.start_date} value={form.target_date} error={errors.target_date} onChange={(e) => set('target_date', e.target.value)} helperText="Optional — leave blank for an ongoing goal" />
      </div>

      <div className="rounded-lg border border-neutral-200 p-4">
        <label className="flex items-center gap-2.5">
          <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" checked={form.reminder_enabled} onChange={(e) => set('reminder_enabled', e.target.checked)} />
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-800">
            <Bell className="h-4 w-4" />
            Remind me
          </span>
        </label>
        {form.reminder_enabled && (
          <div className="mt-3 max-w-[10rem]">
            <Input label="Reminder time" name="reminder_time" type="time" value={form.reminder_time} error={errors.reminder_time} onChange={(e) => set('reminder_time', e.target.value)} />
          </div>
        )}
      </div>

      {saveError && <p role="alert" className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{saveError}</p>}

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={saving}>{goal ? 'Save changes' : 'Create goal'}</Button>
      </div>
    </form>
  );
}
