/*
# Profiles table and shared database infrastructure

## Purpose
This migration creates the foundational infrastructure for the Personal Health Manager:
a reusable updated_at trigger function, the `profiles` table that all health data will
belong to, and a profile-ownership helper function used by RLS policies on all
health-data tables.

## New Functions

### `set_updated_at()`
A trigger function that automatically sets `updated_at = now()` on any row update.
Reusable across all tables that have an `updated_at` column.

### `user_owns_profile(profile_uuid uuid)`
A SECURITY DEFINER helper that checks whether the current authenticated user
(`auth.uid()`) owns the specified profile. Returns true if the profile's
`owner_id` matches `auth.uid()`. This function is the backbone of RLS policies
on all health-data tables — instead of repeating the ownership join in every
policy, policies call this function. It runs as the table owner (definer) so
it can read the profiles table during INSERT (when the row doesn't exist yet
to join against).

## New Tables

### `profiles`
The core entity representing a health profile. Each authenticated user (account
owner) has their own profile, and can later create family-member profiles. All
health records belong to a profile via a foreign key.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique profile identifier |
| `owner_id` | uuid NOT NULL | The authenticated user who owns this profile (FK -> auth.users) |
| `display_name` | text NOT NULL | Display name |
| `relationship` | text NOT NULL DEFAULT 'self' | Relationship to account owner |
| `date_of_birth` | date | Date of birth (nullable) |
| `sex` | text | Biological sex (nullable, CHECK-constrained) |
| `avatar_url` | text | Optional avatar image URL |
| `created_at` | timestamptz DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz DEFAULT now() | Last update timestamp (auto-maintained) |

## Security (RLS)

RLS is enabled on `profiles`. Four policies (SELECT/INSERT/UPDATE/DELETE), each
scoped `TO authenticated` using `auth.uid() = owner_id`. The `owner_id` column
defaults to `auth.uid()` so inserts that omit it still satisfy the INSERT
policy's WITH CHECK. No public/anon access is granted.
*/

-- ── Reusable updated_at trigger function ──────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Profiles table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  relationship text NOT NULL DEFAULT 'self'
    CHECK (relationship IN ('self', 'spouse', 'child', 'parent', 'sibling', 'other')),
  date_of_birth date,
  sex          text
    CHECK (sex IS NULL OR sex IN ('male', 'female', 'other', 'prefer_not_to_say')),
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON public.profiles(owner_id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ── Profile-ownership helper (used by RLS on all health tables) ──────
-- Created AFTER the profiles table so the table reference resolves.
CREATE OR REPLACE FUNCTION public.user_owns_profile(profile_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = profile_uuid
    AND owner_id = auth.uid()
  );
$$;

-- ── Row Level Security ───────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profiles" ON public.profiles;
CREATE POLICY "select_own_profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "insert_own_profiles" ON public.profiles;
CREATE POLICY "insert_own_profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_own_profiles" ON public.profiles;
CREATE POLICY "update_own_profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "delete_own_profiles" ON public.profiles;
CREATE POLICY "delete_own_profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);
