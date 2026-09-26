/*
# Health tracking tables: goals, activities, daily_checkins, achievements

## Purpose
Creates the core health-tracking tables that belong to a profile. Each table has
a `profile_id` foreign key to `profiles(id)`, and RLS policies that scope access
through the `user_owns_profile()` helper function.

## New Tables

### `goals`
Health goals tied to a profile (e.g. "walk 10,000 steps daily", "lose 5 kg").

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | Which profile this goal belongs to |
| `title` | text NOT NULL | Goal title |
| `category` | text NOT NULL | 'exercise', 'nutrition', 'sleep', 'weight', 'mental_health', 'other' |
| `target_value` | numeric | Target value (nullable for qualitative goals) |
| `current_value` | numeric DEFAULT 0 | Current progress |
| `unit` | text | Unit of measurement (e.g. 'steps', 'kg', 'hours') |
| `status` | text NOT NULL DEFAULT 'active' | 'active', 'completed', 'abandoned' |
| `target_date` | date | Optional deadline |
| `created_at` / `updated_at` | timestamptz | Auto-maintained |

### `activities`
Exercise and physical activity logs.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | |
| `date` | date NOT NULL | When the activity occurred |
| `activity_type` | text NOT NULL | 'walking', 'running', 'cycling', 'swimming', 'strength', 'yoga', 'sports', 'other' |
| `duration_min` | integer NOT NULL | Duration in minutes |
| `intensity` | text | 'low', 'moderate', 'high' |
| `calories_burned` | integer | Estimated calories burned |
| `distance_km` | numeric | Distance in kilometers |
| `notes` | text | Free-form notes |
| `created_at` / `updated_at` | timestamptz | |

### `daily_checkins`
Daily health check-ins recording mood, energy, sleep, and notes.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | |
| `date` | date NOT NULL | The check-in date |
| `mood` | text | 'great', 'good', 'okay', 'low', 'poor' |
| `energy_level` | smallint | 1-10 scale |
| `sleep_hours` | numeric | Hours slept |
| `stress_level` | smallint | 1-10 scale |
| `notes` | text | Free-form notes |
| `created_at` / `updated_at` | timestamptz | |

**Unique constraint:** one check-in per profile per date.

### `achievements`
Milestone/badge records for gamification.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL FK -> profiles | |
| `name` | text NOT NULL | Achievement name |
| `description` | text | What the user did to earn it |
| `category` | text NOT NULL | 'exercise', 'nutrition', 'sleep', 'streak', 'goal', 'other' |
| `earned_at` | timestamptz NOT NULL DEFAULT now() | When the achievement was earned |

## RLS Strategy

All four tables use the same pattern:
- SELECT: `user_owns_profile(profile_id)` — user can see data for profiles they own
- INSERT: `user_owns_profile(profile_id)` WITH CHECK — user can only insert data for their own profiles
- UPDATE: USING + WITH CHECK both `user_owns_profile(profile_id)` — can update only their own data, cannot reassign to another profile
- DELETE: `user_owns_profile(profile_id)` — can delete only their own data

All policies are `TO authenticated`. No anon/public access.
*/

-- ── Goals ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  category      text NOT NULL
    CHECK (category IN ('exercise', 'nutrition', 'sleep', 'weight', 'mental_health', 'other')),
  target_value  numeric,
  current_value numeric DEFAULT 0,
  unit          text,
  status        text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  target_date   date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_profile_id ON public.goals(profile_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON public.goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_profile_status ON public.goals(profile_id, status);

CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_goals" ON public.goals;
CREATE POLICY "select_own_goals"
  ON public.goals FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_goals" ON public.goals;
CREATE POLICY "insert_own_goals"
  ON public.goals FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "update_own_goals" ON public.goals;
CREATE POLICY "update_own_goals"
  ON public.goals FOR UPDATE TO authenticated
  USING (public.user_owns_profile(profile_id))
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "delete_own_goals" ON public.goals;
CREATE POLICY "delete_own_goals"
  ON public.goals FOR DELETE TO authenticated
  USING (public.user_owns_profile(profile_id));

-- ── Activities ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date            date NOT NULL,
  activity_type   text NOT NULL
    CHECK (activity_type IN ('walking', 'running', 'cycling', 'swimming', 'strength', 'yoga', 'sports', 'other')),
  duration_min    integer NOT NULL CHECK (duration_min > 0),
  intensity       text CHECK (intensity IS NULL OR intensity IN ('low', 'moderate', 'high')),
  calories_burned integer CHECK (calories_burned IS NULL OR calories_burned >= 0),
  distance_km     numeric CHECK (distance_km IS NULL OR distance_km >= 0),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_profile_id ON public.activities(profile_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON public.activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_profile_date ON public.activities(profile_id, date DESC);

CREATE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activities" ON public.activities;
CREATE POLICY "select_own_activities"
  ON public.activities FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_activities" ON public.activities;
CREATE POLICY "insert_own_activities"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "update_own_activities" ON public.activities;
CREATE POLICY "update_own_activities"
  ON public.activities FOR UPDATE TO authenticated
  USING (public.user_owns_profile(profile_id))
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "delete_own_activities" ON public.activities;
CREATE POLICY "delete_own_activities"
  ON public.activities FOR DELETE TO authenticated
  USING (public.user_owns_profile(profile_id));

-- ── Daily check-ins ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date          date NOT NULL,
  mood          text CHECK (mood IS NULL OR mood IN ('great', 'good', 'okay', 'low', 'poor')),
  energy_level  smallint CHECK (energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 10)),
  sleep_hours   numeric CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24)),
  stress_level  smallint CHECK (stress_level IS NULL OR (stress_level >= 1 AND stress_level <= 10)),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_checkins_profile_id ON public.daily_checkins(profile_id);
CREATE INDEX IF NOT EXISTS idx_checkins_profile_date ON public.daily_checkins(profile_id, date DESC);

CREATE TRIGGER trg_checkins_updated_at
  BEFORE UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_checkins" ON public.daily_checkins;
CREATE POLICY "select_own_checkins"
  ON public.daily_checkins FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_checkins" ON public.daily_checkins;
CREATE POLICY "insert_own_checkins"
  ON public.daily_checkins FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "update_own_checkins" ON public.daily_checkins;
CREATE POLICY "update_own_checkins"
  ON public.daily_checkins FOR UPDATE TO authenticated
  USING (public.user_owns_profile(profile_id))
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "delete_own_checkins" ON public.daily_checkins;
CREATE POLICY "delete_own_checkins"
  ON public.daily_checkins FOR DELETE TO authenticated
  USING (public.user_owns_profile(profile_id));

-- ── Achievements ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  category    text NOT NULL
    CHECK (category IN ('exercise', 'nutrition', 'sleep', 'streak', 'goal', 'other')),
  earned_at   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_profile_id ON public.achievements(profile_id);
CREATE INDEX IF NOT EXISTS idx_achievements_profile_earned ON public.achievements(profile_id, earned_at DESC);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_achievements" ON public.achievements;
CREATE POLICY "select_own_achievements"
  ON public.achievements FOR SELECT TO authenticated
  USING (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "insert_own_achievements" ON public.achievements;
CREATE POLICY "insert_own_achievements"
  ON public.achievements FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "update_own_achievements" ON public.achievements;
CREATE POLICY "update_own_achievements"
  ON public.achievements FOR UPDATE TO authenticated
  USING (public.user_owns_profile(profile_id))
  WITH CHECK (public.user_owns_profile(profile_id));

DROP POLICY IF EXISTS "delete_own_achievements" ON public.achievements;
CREATE POLICY "delete_own_achievements"
  ON public.achievements FOR DELETE TO authenticated
  USING (public.user_owns_profile(profile_id));
