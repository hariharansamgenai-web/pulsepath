import { useState, type FormEvent } from 'react';
import { Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import type { Food, MealType } from '@/types';
import { addFoodLog, getOrCreateMeal } from '@/lib/meals';
import { MEAL_LABELS } from '@/lib/meals';

interface AddFoodToMealProps {
  profileId: string;
  date: string;
  mealType: MealType;
  foods: Food[];
  onFoodAdded: () => void;
  onCreateFood: () => void;
}

export function AddFoodToMeal({ profileId, date, mealType, foods, onFoodAdded, onCreateFood }: AddFoodToMealProps) {
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = search.toLowerCase();
  const filtered: Food[] = search.length === 0
    ? foods.filter((f) => f.is_favorite).slice(0, 8)
    : foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 10);

  function selectFood(food: Food) {
    setSelectedFood(food);
    setSearch(food.name);
    setQuantity(food.serving_size_g?.toString() ?? '100');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedFood) { setError('Pick a food first.'); return; }
    const qty = Number(quantity);
    if (!qty || qty <= 0) { setError('Quantity must be greater than 0.'); return; }

    setSaving(true);
    setError(null);
    try {
      const meal = await getOrCreateMeal(profileId, date, mealType);
      await addFoodLog(meal.id, { food_id: selectedFood.id, quantity_g: qty });
      setSearch('');
      setSelectedFood(null);
      setQuantity('');
      onFoodAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log food.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <p className="text-sm font-semibold text-neutral-700">Add to {MEAL_LABELS[mealType]}</p>

      <div className="relative">
        <Input
          name="food-search"
          placeholder="Search your foods…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedFood(null); }}
        />
        {!selectedFood && (search.length > 0 || foods.some((f) => f.is_favorite)) && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
            {filtered.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => selectFood(f)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                {f.is_favorite && <Star className="h-3.5 w-3.5 fill-warning-400 text-warning-400" />}
                <span className="flex-1 truncate font-medium text-neutral-900">{f.name}</span>
                {f.calories_per_100g !== null && (
                  <Badge variant="neutral">{f.calories_per_100g} kcal/100g</Badge>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-neutral-500">No matches.</p>
            )}
            <button
              type="button"
              onClick={onCreateFood}
              className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Create a new food
            </button>
          </div>
        )}
      </div>

      {selectedFood && (
        <div className="flex items-end gap-3">
          <div className="w-28">
            <Input
              label="Quantity (g)"
              name="quantity"
              type="number"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" loading={saving}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-error-600">{error}</p>}
    </form>
  );
}
