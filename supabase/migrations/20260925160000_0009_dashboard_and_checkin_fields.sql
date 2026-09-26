/*
# Phase 5 — Daily check-in and dashboard fields

## daily_checkins
Adds the Phase 5 fields (weight, water, sleep quality) and the diabetes coach
fields (medication, blood sugar readings, steps). Existing RLS policies
already cover the new columns.

- `weight_kg`         numeric   1..400
- `sleep_quality`     smallint  1..5
- `water_ml`          integer   0..10000  (glasses × 250 ml)
- `meds_taken`        boolean               null = not asked, true = taken, false = missed
- `glucose_fasting`   numeric   20..600 mg/dL
- `glucose_post_meal` numeric   20..600 mg/dL
- `steps`             integer   0..100000

## goals: current_value from real data
Cache the goal's current progress in an existing column so the Dashboard can
show progress without recomputing.
*/

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS weight_kg numeric
    CHECK (weight_kg IS NULL OR (weight_kg >= 1 AND weight_kg <= 400)),
  ADD COLUMN IF NOT EXISTS sleep_quality smallint
    CHECK (sleep_quality IS NULL OR (sleep_quality BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS water_ml integer
    CHECK (water_ml IS NULL OR (water_ml BETWEEN 0 AND 10000)),
  ADD COLUMN IF NOT EXISTS meds_taken boolean,
  ADD COLUMN IF NOT EXISTS glucose_fasting numeric
    CHECK (glucose_fasting IS NULL OR (glucose_fasting BETWEEN 20 AND 600)),
  ADD COLUMN IF NOT EXISTS glucose_post_meal numeric
    CHECK (glucose_post_meal IS NULL OR (glucose_post_meal BETWEEN 20 AND 600)),
  ADD COLUMN IF NOT EXISTS steps integer
    CHECK (steps IS NULL OR (steps BETWEEN 0 AND 100000));
