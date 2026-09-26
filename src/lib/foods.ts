import { supabase } from '@/lib/supabase';
import type { Food, FoodInput } from '@/types';

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function normalize(row: Record<string, unknown>): Food {
  return {
    ...(row as unknown as Food),
    calories_per_100g: toNum(row.calories_per_100g),
    protein_g: toNum(row.protein_g),
    carbs_g: toNum(row.carbs_g),
    fat_g: toNum(row.fat_g),
    fiber_g: toNum(row.fiber_g),
    serving_size_g: toNum(row.serving_size_g),
  };
}

export async function listFoods(profileId: string): Promise<Food[]> {
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('profile_id', profileId)
    .order('is_favorite', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalize);
}

export async function createFood(profileId: string, input: FoodInput): Promise<Food> {
  const { data, error } = await supabase
    .from('foods')
    .insert({ ...input, profile_id: profileId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function updateFood(id: string, input: FoodInput): Promise<Food> {
  const { data, error } = await supabase.from('foods').update(input).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function deleteFood(id: string): Promise<void> {
  const { error } = await supabase.from('foods').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function toggleFavorite(id: string, is_favorite: boolean): Promise<Food> {
  const { data, error } = await supabase.from('foods').update({ is_favorite }).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return normalize(data);
}
