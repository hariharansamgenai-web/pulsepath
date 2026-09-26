import { useMemo, useState } from 'react';
import { Apple, ChevronLeft, ChevronRight, Pencil, Plus, Star, Trash2, Utensils } from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loading } from '@/components/feedback/Loading';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { FoodForm } from '@/components/nutrition/FoodForm';
import { AddFoodToMeal } from '@/components/nutrition/AddFoodToMeal';
import { NutritionBar } from '@/components/nutrition/NutritionBar';
import { useFoods } from '@/hooks/useFoods';
import { useMeals } from '@/hooks/useMeals';
import {
  addFoodLog,
  computeNutrition,
  dailyNutrition,
  deleteFoodLog,
  getOrCreateMeal,
  MEAL_LABELS,
  MEAL_ORDER,
  mealNutrition,
  updateFoodLog,
} from '@/lib/meals';
import { createFood, deleteFood, toggleFavorite } from '@/lib/foods';
import { addDays, longDate, todayISO } from '@/lib/health';
import type { Food, FoodLog, MealType, MealWithLogs } from '@/types';
import { AIFoodAnalyser } from '@/components/nutrition/AIFoodAnalyser';
import { getIndianTargets, type DietType, type SaltLevel, type OilLevel } from '@/lib/indianNutrition';
import type { GeminiFoodResult } from '@/lib/geminiNutrition';

type FoodDialog = { kind: 'create' } | { kind: 'edit'; food: Food } | { kind: 'delete'; food: Food } | null;

export function NutritionPage() {
  const { activeProfile } = useActiveProfile();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const { foods, reload: reloadFoods } = useFoods(activeProfile?.id);
  const { meals, loading, error, reload: reloadMeals } = useMeals(activeProfile?.id, 30);
  const [addingTo, setAddingTo] = useState<MealType | null>(null);
  const [foodDialog, setFoodDialog] = useState<FoodDialog>(null);
  const [editingLog, setEditingLog] = useState<{ log: FoodLog; qty: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dietType, setDietType] = useState<DietType>('veg');
  const indianTargets = getIndianTargets(dietType);

  const dayMeals = useMemo(() => meals.filter((m) => m.date === selectedDate), [meals, selectedDate]);
  const dayNutrition = useMemo(() => dailyNutrition(dayMeals), [dayMeals]);

  const mealsByType = useMemo(() => {
    const map = new Map<MealType, MealWithLogs>();
    for (const m of dayMeals) map.set(m.meal_type, m);
    return map;
  }, [dayMeals]);

  if (!activeProfile) return <Loading label="Loading profile" />;

  async function handleAIResult(
    result: GeminiFoodResult,
    portionG: number,
    _saltLevel: SaltLevel,
    _oilLevel: OilLevel,
    itemIndex = 0,
  ) {
    // Pick the specific dish from multi-dish results
    const item = result.items?.[itemIndex];
    const foodName = item?.dish ?? result.food_name;
    const weightG  = item?.weight_g ?? portionG;
    // Derive per-100g macros from the item's portion values
    const scale = weightG > 0 ? 100 / weightG : 1;
    const cal100  = item ? Math.round(item.calories  * scale) : result.calories_per_100g;
    const pro100  = item ? +(item.protein_g * scale).toFixed(2) : result.protein_g;
    const carb100 = item ? +(item.carbs_g   * scale).toFixed(2) : result.carbs_g;
    const fat100  = item ? +(item.fat_g     * scale).toFixed(2) : result.fat_g;
    const fib100  = item ? +(item.fiber_g   * scale).toFixed(2) : result.fiber_g;

    try {
      // 1. Create the food in the user's food library
      const food = await createFood(activeProfile!.id, {
        name:              foodName,
        calories_per_100g: cal100,
        protein_g:         pro100,
        carbs_g:           carb100,
        fat_g:             fat100,
        fiber_g:           fib100,
        serving_size_g:    portionG,
        is_favorite:       false,
      });
      // 2. Get or create the meal for the selected date (default: lunch)
      const meal = await getOrCreateMeal(activeProfile!.id, selectedDate, 'lunch');
      // 3. Add the food log
      await addFoodLog(meal.id, { food_id: food.id, quantity_g: portionG });
      // 4. Reload meals so the page reflects the new log
      await reloadMeals();
      await reloadFoods();
    } catch (e) {
      alert('Could not save food: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  const today = todayISO();
  function prevDay() { setSelectedDate((d) => addDays(d, -1)); }
  function nextDay() { if (selectedDate < today) setSelectedDate((d) => addDays(d, 1)); }

  async function handleDeleteLog(logId: string) {
    await deleteFoodLog(logId);
    await reloadMeals();
  }

  async function handleSaveLogQty() {
    if (!editingLog) return;
    const qty = Number(editingLog.qty);
    if (!qty || qty <= 0) return;
    await updateFoodLog(editingLog.log.id, qty);
    setEditingLog(null);
    await reloadMeals();
  }

  async function handleToggleFav(food: Food) {
    await toggleFavorite(food.id, !food.is_favorite);
    await reloadFoods();
  }

  async function handleDeleteFood(food: Food) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFood(food.id);
      setFoodDialog(null);
      await reloadFoods();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete food.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Nutrition</h2>
          <p className="mt-1 text-sm text-neutral-600">Log meals for {activeProfile.display_name}. Calorie values shown are estimates, not medical guidance.</p>
        </div>
        <Button onClick={() => setFoodDialog({ kind: 'create' })}>
          <Plus className="h-4 w-4" />
          New food
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={reloadMeals} />}

      {/* Date picker */}
      <div className="flex items-center gap-3">
        <button onClick={prevDay} className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100" aria-label="Previous day">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold text-neutral-900">
          {selectedDate === today ? 'Today' : longDate(selectedDate)}
        </p>
        <button onClick={nextDay} disabled={selectedDate >= today} className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30" aria-label="Next day">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Daily summary */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <CardHeader title="Daily summary" subtitle={selectedDate === today ? 'Today so far' : longDate(selectedDate)} />
          {/* Veg / Non-veg toggle — affects Indian daily targets */}
          <div className="flex gap-1.5">
            <button onClick={() => setDietType('veg')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all"
              style={{ background: dietType==='veg' ? '#dcfce7' : 'var(--bg-card-2,var(--bg-card))', color: dietType==='veg' ? '#166534' : 'var(--text-muted)', border: `1px solid ${dietType==='veg' ? '#86efac' : 'var(--border)'}` }}>
              🌿 Veg
            </button>
            <button onClick={() => setDietType('nonveg')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all"
              style={{ background: dietType==='nonveg' ? '#fee2e2' : 'var(--bg-card-2,var(--bg-card))', color: dietType==='nonveg' ? '#991b1b' : 'var(--text-muted)', border: `1px solid ${dietType==='nonveg' ? '#fca5a5' : 'var(--border)'}` }}>
              🍖 Non-veg
            </button>
          </div>
        </div>
        <NutritionBar summary={dayNutrition} targets={indianTargets} />
      </Card>

      {/* AI Food Analyser — Gemini-powered photo/text nutrition scanner */}
      <AIFoodAnalyser onUse={handleAIResult} />

      {/* Meals */}
      <div className="grid gap-4 lg:grid-cols-2">
        {MEAL_ORDER.map((type) => {
          const meal = mealsByType.get(type);
          const logs = meal?.food_logs ?? [];
          const nutrition = meal ? mealNutrition(meal) : null;

          return (
            <Card key={type} noPadding>
              <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
                <div className="flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-neutral-400" />
                  <p className="font-semibold text-neutral-900">{MEAL_LABELS[type]}</p>
                  {nutrition && nutrition.calories > 0 && (
                    <Badge variant="neutral">{nutrition.calories} kcal</Badge>
                  )}
                </div>
                <button
                  onClick={() => setAddingTo(addingTo === type ? null : type)}
                  className="rounded-md p-1.5 text-primary-700 hover:bg-primary-50"
                  aria-label={`Add food to ${MEAL_LABELS[type]}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {addingTo === type && (
                <div className="border-b border-neutral-100 px-5 py-3">
                  <AddFoodToMeal
                    profileId={activeProfile.id}
                    date={selectedDate}
                    mealType={type}
                    foods={foods}
                    onFoodAdded={async () => { setAddingTo(null); await reloadMeals(); }}
                    onCreateFood={() => { setAddingTo(null); setFoodDialog({ kind: 'create' }); }}
                  />
                </div>
              )}

              {loading && logs.length === 0 ? (
                <div className="p-4"><Loading label="" /></div>
              ) : logs.length === 0 ? (
                <p className="px-5 py-4 text-sm text-neutral-500">No food logged yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-50">
                  {logs.map((log) => {
                    const n = computeNutrition(log);
                    const isEditing = editingLog?.log.id === log.id;
                    return (
                      <li key={log.id} className="flex items-center gap-2 px-5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-900">{log.food?.name ?? 'Unknown food'}</p>
                          <p className="text-xs text-neutral-500">
                            {isEditing ? (
                              <span className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  className="w-16 rounded border border-primary-300 px-1 py-0.5 text-xs"
                                  value={editingLog.qty}
                                  onChange={(e) => setEditingLog({ log, qty: e.target.value })}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveLogQty()}
                                  autoFocus
                                />
                                g
                                <button onClick={handleSaveLogQty} className="ml-1 text-xs font-medium text-primary-700 hover:text-primary-800">Save</button>
                                <button onClick={() => setEditingLog(null)} className="text-xs text-neutral-500 hover:text-neutral-700">Cancel</button>
                              </span>
                            ) : (
                              <>{log.quantity_g} g · {n.calories} kcal · P {n.protein_g} · C {n.carbs_g} · F {n.fat_g}</>
                            )}
                          </p>
                        </div>
                        {!isEditing && (
                          <div className="flex shrink-0 gap-1">
                            <button onClick={() => setEditingLog({ log, qty: log.quantity_g.toString() })} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Edit quantity">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeleteLog(log.id)} className="rounded p-1 text-neutral-400 hover:bg-error-50 hover:text-error-600" aria-label="Remove food">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {/* Food library */}
      <Card noPadding>
        <div className="border-b border-neutral-200 px-5 py-4">
          <CardHeader title="Your food library" subtitle={`${foods.length} food${foods.length !== 1 ? 's' : ''}`} action={<Apple className="h-4 w-4 text-neutral-400" />} />
        </div>
        {foods.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Apple className="h-6 w-6" />}
              title="No foods yet"
              description="Create your first food to start logging meals."
              action={<Button onClick={() => setFoodDialog({ kind: 'create' })}><Plus className="h-4 w-4" />New food</Button>}
            />
          </div>
        ) : (
          <ul className="max-h-80 divide-y divide-neutral-50 overflow-y-auto">
            {foods.map((f) => (
              <li key={f.id} className="flex items-center gap-2 px-5 py-2.5">
                <button onClick={() => handleToggleFav(f)} className="shrink-0" aria-label={f.is_favorite ? 'Remove from favorites' : 'Add to favorites'}>
                  <Star className={f.is_favorite ? 'h-4 w-4 fill-warning-400 text-warning-400' : 'h-4 w-4 text-neutral-300 hover:text-warning-400'} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{f.name}</p>
                  <p className="text-xs text-neutral-500">
                    {f.calories_per_100g ?? '?'} kcal · P {f.protein_g ?? '?'} · C {f.carbs_g ?? '?'} · F {f.fat_g ?? '?'}
                    {f.serving_size_g && ` · ${f.serving_size_g} g serving`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setFoodDialog({ kind: 'edit', food: f })} className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={`Edit ${f.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => { setDeleteError(null); setFoodDialog({ kind: 'delete', food: f }); }} className="rounded p-1.5 text-neutral-400 hover:bg-error-50 hover:text-error-600" aria-label={`Delete ${f.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Food dialogs */}
      <Modal open={foodDialog?.kind === 'create'} onClose={() => setFoodDialog(null)} title="New food" size="lg">
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <FoodForm profileId={activeProfile.id} onSaved={async () => { setFoodDialog(null); await reloadFoods(); }} onCancel={() => setFoodDialog(null)} />
        </div>
      </Modal>

      <Modal open={foodDialog?.kind === 'edit'} onClose={() => setFoodDialog(null)} title="Edit food" size="lg">
        {foodDialog?.kind === 'edit' && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <FoodForm profileId={activeProfile.id} food={foodDialog.food} onSaved={async () => { setFoodDialog(null); await reloadFoods(); await reloadMeals(); }} onCancel={() => setFoodDialog(null)} />
          </div>
        )}
      </Modal>

      <Modal
        open={foodDialog?.kind === 'delete'}
        onClose={() => setFoodDialog(null)}
        title="Delete this food?"
        size="sm"
        footer={foodDialog?.kind === 'delete' ? (
          <>
            <Button variant="ghost" onClick={() => setFoodDialog(null)}>Keep it</Button>
            <Button variant="danger" loading={deleting} onClick={() => handleDeleteFood(foodDialog.food)}>Delete</Button>
          </>
        ) : undefined}
      >
        {foodDialog?.kind === 'delete' && (
          <>
            <p className="text-sm text-neutral-700">"{foodDialog.food.name}" will be permanently removed. Any meal logs using this food will also be removed.</p>
            {deleteError && <p className="mt-3 text-sm text-error-600">{deleteError}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}
