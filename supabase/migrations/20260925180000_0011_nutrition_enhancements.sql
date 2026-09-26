/*
# Phase 8 — Nutrition & food logging

## foods
- `fiber_g` (numeric, nullable, ≥ 0): grams of fiber per 100 g.
- `is_favorite` (boolean, default false): marks frequently-used foods for quick access.
*/

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS fiber_g numeric CHECK (fiber_g IS NULL OR fiber_g >= 0),
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
