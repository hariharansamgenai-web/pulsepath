/*
# Phase 6 — Activity tracking & goals

## activities
- `activity_type` gains 'gym' and 'custom' (the prompt's "Gym" and "Custom
  activity" have no match in the original 8-value CHECK, which had
  'strength' instead of 'gym' and no free-text option). 'strength' is kept
  for backward compatibility.
- `custom_label` (text): the user's own name for the activity, required
  when `activity_type = 'custom'`, enforced by CHECK.
- `start_time` (time, nullable): clock time the activity started.

## goals
- `frequency` ('daily' | 'weekly'), NOT NULL default 'daily': the window
  progress is measured over (e.g. "8,000 steps/day" vs "5 workouts/week").
- `start_date` (date, NOT NULL default current_date): when the goal began;
  progress is only computed from this date forward.
- `reminder_enabled` (boolean) + `reminder_time` (time, nullable).
- `target_date` is renamed in the app layer to "end date"; the column is
  unchanged (nullable = ongoing goal).

Progress itself is never stored — the app computes it live from
`daily_checkins` and `activities` between `start_date` (or the current
period) and today, so it always reflects real logged data. `current_value`
stays in the schema for compatibility but the app does not read or write it.
*/

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type IN ('walking', 'running', 'cycling', 'swimming', 'strength', 'gym', 'yoga', 'sports', 'custom', 'other'));

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS custom_label text;

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_custom_label_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_custom_label_check
  CHECK (activity_type <> 'custom' OR (custom_label IS NOT NULL AND length(trim(custom_label)) > 0));

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_time time;

ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_frequency_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_frequency_check
  CHECK (frequency IN ('daily', 'weekly'));

ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_dates_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_dates_check
  CHECK (target_date IS NULL OR target_date >= start_date);
