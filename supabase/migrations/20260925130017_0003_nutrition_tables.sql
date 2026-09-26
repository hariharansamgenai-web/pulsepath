/*
# Nutrition tracking tables: foods, meals, food_logs

## Purpose
Creates the nutrition-tracking schema. The design separates food items (a reusable
lookup of food names with nutritional data) from meal entries (a grouping of foods
eaten at a specific meal time) from individual food log entries (which foods were
logged in which meals and quantities).

This normalization avoids duplicating nutritional information: a food item is
defined once and referenced by many food_log entries with different quantities.

## New Tables

### `foods`
A user-created food database. Each food item belongs to a profile (the account
owner curates their own food list). Nutritional values are per 100g unless
`serving_size_g` is provided.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | Who owns this food entry |
| `name` | text NOT NULL | Food name |
| `calories_per_100g` | integer | Calories per 100g |
| `protein_g` | numeric | Protein per 100g |
| `carbs_g` | numeric | Carbs per 100g |
| `fat_g` | numeric | Fat per 100g |
| `serving_size_g` | numeric | Default serving size in grams |
| `created_at` / `updated_at` | timestamptz | |

### `meals`
A meal is a grouping of food entries for a specific meal occasion (e.g.
"breakfast on 2024-01-15").

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | |
| `date` | date NOT NULL | The meal date |
| `meal_type` | text NOT NULL | 'breakfast', 'lunch', 'dinner', 'snack' |
| `notes` | text | Free-form notes |
| `created_at` / `updated_at` | timestamptz | |

### `food_logs`
Individual food items logged within a meal, with the quantity consumed.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `meal_id` | uuid NOT NULL FK -> meals | Which meal this food entry belongs to |
| `food_id` | uuid NOT NULL FK -> foods | Which food was consumed |
| `quantity_g` | numeric NOT NULL | Grams consumed |
| `created_at` | timestamptz | |

**Note on RLS for food_logs:** Since `food_logs` references a `meal_id` (not
directly a `profile_id`), the RLS policies check ownership through the meal's
`profile_id` via a subquery: `user_owns_profile((SELECT profile_id FROM meals
WHERE id = meal_id))`.

## RLS Strategy

`foods` and `meals` follow the standard pattern: four policies each, scoped
through `user_owns_profile(profile_id)`.

`food_logs` checks ownership through the parent meal:
- SELECT: `user_owns_profile((SELECT profile_id FROM public.meals WHERE id = meal_id))`
- INSERT: WITH CHECK same predicate
- UPDATE: USING + WITH CHECK same predicate
- DELETE: USING same predicate

All policies are `TO authenticated`. No anon/public access.
*/

-- ── Foods ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foods (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              text NOT NULL,
  calories_per_100g integer CHECK (calories_per_100g IS NULL OR calories_per_100g >= 0),
  protein_g         numeric CHECK (protein_g IS NULL OR protein_g >= 0),
  carbs_g           numeric CHECK (carbs_g IS NULL OR carbs_g >= 0),
  fat_g             numeric CHECK (fat_g IS NULL OR fat_g >= 0),
  serving_size_g    numeric CHECK (serving_size_g IS NULL OR serving_size_g > 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foods_profile_id ON public.foods(profile_id);
CREATE INDEX IF NOT EXISTS idx_foods_profile_name ON public.foods(profile_id, name);

CREATE TRIGGER trg_foods_updated_at
  BEFORE UPDATE ON public.foods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_foods" ON public.foods;
CREATE POLICY "select_own_foods"
  ON public.foods FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_foods" ON public.foods;
CREATE POLICY "insert_own_foods"
  ON public.foods FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "update_own_foods" ON public.foods;
CREATE POLICY "update_own_foods"
  ON public.foods FOR UPDATE TO authenticated
  USING (public.user_owns_profile(profile_id))
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "delete_own_foods" ON public.foods;
CREATE POLICY "delete_own_foods"
  ON public.foods FOR DELETE TO authenticated
  USING (public.user_owns_profile(profile_id));

-- ── Meals ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        date NOT NULL,
  meal_type   text NOT NULL
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meals_profile_id ON public.meals(profile_id);
CREATE INDEX IF NOT EXISTS idx_meals_profile_date ON public.meals(profile_id, date DESC);

CREATE TRIGGER trg_meals_updated_at
  BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meals" ON public.meals;
CREATE POLICY "select_own_meals"
  ON public.meals FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_meals" ON public.meals;
CREATE POLICY "insert_own_meals"
  ON public.meals FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "update_own_meals" ON public.meals;
CREATE POLICY "update_own_meals"
  ON public.meals FOR UPDATE TO authenticated
  USING (public.user_owns_profile(profile_id))
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "delete_own_meals" ON public.meals;
CREATE POLICY "delete_own_meals"
  ON public.meals FOR DELETE TO authenticated
  USING (public.user_owns_profile(profile_id));

-- ── Food logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.food_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id     uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  food_id     uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  quantity_g  numeric NOT NULL CHECK (quantity_g > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_logs_meal_id ON public.food_logs(meal_id);
CREATE INDEX IF NOT EXISTS idx_food_logs_food_id ON public.food_logs(food_id);

ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_food_logs" ON public.food_logs;
CREATE POLICY "select_own_food_logs"
  ON public.food_logs FOR SELECT TO authenticated
  USING (public.user_owns_profile((SELECT profile_id FROM public.meals WHERE id = meal_id)));

DROP POLICY IF EXISTS "insert_own_food_logs" ON public.food_logs;
CREATE POLICY "insert_own_food_logs"
  ON public.food_logs FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile((SELECT profile_id FROM public.meals WHERE id = meal_id)));

DROP POLICY IF EXISTS "update_own_food_logs" ON public.food_logs;
CREATE POLICY "update_own_food_logs"
  ON public.food_logs FOR UPDATE TO authenticated
  USING (public.user_owns_profile((SELECT profile_id FROM public.meals WHERE id = meal_id)))
  WITH CHECK (public.user_owns_profile((SELECT profile_id FROM public.meals WHERE id = meal_id)));

DROP POLICY IF EXISTS "delete_own_food_logs" ON public.food_logs;
CREATE POLICY "delete_own_food_logs"
  ON public.food_logs FOR DELETE TO authenticated
  USING (public.user_owns_profile((SELECT profile_id FROM public.meals WHERE id = meal_id)));
