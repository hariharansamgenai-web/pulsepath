import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createFood, updateFood } from '@/lib/foods';
import type { Food, FoodInput } from '@/types';

interface FormState {
  name: string;
  calories_per_100g: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  serving_size_g: string;
  is_favorite: boolean;
}

function fromFood(f: Food | null): FormState {
  return {
    name: f?.name ?? '',
    calories_per_100g: f?.calories_per_100g?.toString() ?? '',
    protein_g: f?.protein_g?.toString() ?? '',
    carbs_g: f?.carbs_g?.toString() ?? '',
    fat_g: f?.fat_g?.toString() ?? '',
    fiber_g: f?.fiber_g?.toString() ?? '',
    serving_size_g: f?.serving_size_g?.toString() ?? '',
    is_favorite: f?.is_favorite ?? false,
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

function num(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

interface FoodFormProps {
  profileId: string;
  food?: Food | null;
  onSaved: (food: Food) => void;
  onCancel?: () => void;
}

export function FoodForm({ profileId, food, onSaved, onCancel }: FoodFormProps) {
  const [form, setForm] = useState<FormState>(() => fromFood(food ?? null));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => { setForm(fromFood(food ?? null)); setErrors({}); setSaveError(null); }, [food]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    if (!form.name.trim()) errs.name = 'Give the food a name.';
    const cal = num(form.calories_per_100g);
    if (cal !== null && cal < 0) errs.calories_per_100g = 'Cannot be negative.';
    const srv = num(form.serving_size_g);
    if (srv !== null && srv <= 0) errs.serving_size_g = 'Must be greater than 0.';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const input: FoodInput = {
        name: form.name.trim(),
        calories_per_100g: num(form.calories_per_100g),
        protein_g: num(form.protein_g),
        carbs_g: num(form.carbs_g),
        fat_g: num(form.fat_g),
        fiber_g: num(form.fiber_g),
        serving_size_g: num(form.serving_size_g),
        is_favorite: form.is_favorite,
      };
      const saved = food ? await updateFood(food.id, input) : await createFood(profileId, input);
      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save food.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Input label="Food name" name="name" placeholder="e.g. Brown rice" value={form.name} error={errors.name} onChange={(e) => set('name', e.target.value)} />

      <p className="text-xs font-medium text-neutral-600">Nutrition per 100 g (all optional — fill what you know)</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Calories" name="calories_per_100g" type="number" inputMode="numeric" placeholder="kcal" value={form.calories_per_100g} error={errors.calories_per_100g} onChange={(e) => set('calories_per_100g', e.target.value)} />
        <Input label="Protein (g)" name="protein_g" type="number" inputMode="decimal" step="0.1" value={form.protein_g} onChange={(e) => set('protein_g', e.target.value)} />
        <Input label="Carbs (g)" name="carbs_g" type="number" inputMode="decimal" step="0.1" value={form.carbs_g} onChange={(e) => set('carbs_g', e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Fat (g)" name="fat_g" type="number" inputMode="decimal" step="0.1" value={form.fat_g} onChange={(e) => set('fat_g', e.target.value)} />
        <Input label="Fiber (g)" name="fiber_g" type="number" inputMode="decimal" step="0.1" value={form.fiber_g} onChange={(e) => set('fiber_g', e.target.value)} />
        <Input label="Serving size (g)" name="serving_size_g" type="number" inputMode="decimal" step="1" placeholder="e.g. 150" value={form.serving_size_g} error={errors.serving_size_g} onChange={(e) => set('serving_size_g', e.target.value)} helperText="Default quantity when logging" />
      </div>

      <label className="flex items-center gap-2.5">
        <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" checked={form.is_favorite} onChange={(e) => set('is_favorite', e.target.checked)} />
        <span className="text-sm font-medium text-neutral-800">Save as a favorite for quick access</span>
      </label>

      {saveError && <p role="alert" className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{saveError}</p>}

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={saving}>{food ? 'Save changes' : 'Add food'}</Button>
      </div>
    </form>
  );
}
