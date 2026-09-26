import { supabase } from '@/lib/supabase';
import type { FoodLog, FoodLogInput, Meal, MealType, MealWithLogs } from '@/types';

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------
export async function listMeals(profileId: string, from: string, to: string): Promise<MealWithLogs[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*, food_logs(*, food:foods(*))')
    .eq('profile_id', profileId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeMeal);
}

export async function getOrCreateMeal(
  profileId: string,
  date: string,
  mealType: MealType,
): Promise<Meal> {
  // Try to find an existing meal for this date + type
  const { data: existing } = await supabase
    .from('meals')
    .select('*')
    .eq('profile_id', profileId)
    .eq('date', date)
    .eq('meal_type', mealType)
    .maybeSingle();
  if (existing) return existing as Meal;
  // Create one
  const { data, error } = await supabase
    .from('meals')
    .insert({ profile_id: profileId, date, meal_type: mealType })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Meal;
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Food logs
// ---------------------------------------------------------------------------
export async function addFoodLog(mealId: string, input: FoodLogInput): Promise<FoodLog> {
  const { data, error } = await supabase
    .from('food_logs')
    .insert({ meal_id: mealId, ...input })
    .select('*, food:foods(*)')
    .single();
  if (error) throw new Error(error.message);
  return normalizeFoodLog(data);
}

export async function updateFoodLog(id: string, quantity_g: number): Promise<FoodLog> {
  const { data, error } = await supabase
    .from('food_logs')
    .update({ quantity_g })
    .eq('id', id)
    .select('*, food:foods(*)')
    .single();
  if (error) throw new Error(error.message);
  return normalizeFoodLog(data);
}

export async function deleteFoodLog(id: string): Promise<void> {
  const { error } = await supabase.from('food_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Daily nutrition summary
// ---------------------------------------------------------------------------
export interface NutritionSummary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export const EMPTY_SUMMARY: NutritionSummary = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

export function computeNutrition(log: FoodLog): NutritionSummary {
  const food = log.food;
  if (!food) return EMPTY_SUMMARY;
  const factor = log.quantity_g / 100;
  return {
    calories: Math.round((food.calories_per_100g ?? 0) * factor),
    protein_g: round1((food.protein_g ?? 0) * factor),
    carbs_g: round1((food.carbs_g ?? 0) * factor),
    fat_g: round1((food.fat_g ?? 0) * factor),
    fiber_g: round1((food.fiber_g ?? 0) * factor),
  };
}

export function mealNutrition(meal: MealWithLogs): NutritionSummary {
  return meal.food_logs.reduce<NutritionSummary>(
    (sum, log) => {
      const n = computeNutrition(log);
      return {
        calories: sum.calories + n.calories,
        protein_g: round1(sum.protein_g + n.protein_g),
        carbs_g: round1(sum.carbs_g + n.carbs_g),
        fat_g: round1(sum.fat_g + n.fat_g),
        fiber_g: round1(sum.fiber_g + n.fiber_g),
      };
    },
    { ...EMPTY_SUMMARY },
  );
}

export function dailyNutrition(meals: MealWithLogs[]): NutritionSummary {
  return meals.reduce<NutritionSummary>(
    (sum, m) => {
      const n = mealNutrition(m);
      return {
        calories: sum.calories + n.calories,
        protein_g: round1(sum.protein_g + n.protein_g),
        carbs_g: round1(sum.carbs_g + n.carbs_g),
        fat_g: round1(sum.fat_g + n.fat_g),
        fiber_g: round1(sum.fiber_g + n.fiber_g),
      };
    },
    { ...EMPTY_SUMMARY },
  );
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------
function normalizeFoodLog(row: Record<string, unknown>): FoodLog {
  const r = row as unknown as FoodLog;
  return { ...r, quantity_g: Number(r.quantity_g) };
}

function normalizeMeal(row: Record<string, unknown>): MealWithLogs {
  const r = row as unknown as MealWithLogs;
  return {
    ...r,
    food_logs: (r.food_logs ?? []).map((fl) => normalizeFoodLog(fl as unknown as Record<string, unknown>)),
  };
}
