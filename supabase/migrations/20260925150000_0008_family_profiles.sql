/*
# Phase 4 — Family profile management

## 1. Fix: RLS helper permission (critical)
Migrations 0005/0006 revoked EXECUTE on `user_owns_profile(uuid)` from
`authenticated`. Postgres checks EXECUTE for the *querying* role when an RLS
policy calls a function, so every query on every health table failed with
"permission denied for function user_owns_profile". EXECUTE is granted back to
`authenticated` only. This is safe: the function returns true only for
profiles the caller owns, so calling it directly reveals nothing new.
`anon` stays revoked.

## 2. Profile fields
- `height_cm` (30–250) and `weight_kg` (1–400), nullable.
- `relationship` now also allows 'mother' and 'father' ('parent' kept for
  backward compatibility).

## 3. Self-profile rules
- At most one 'self' profile per owner (partial unique index).
- A user cannot delete their own 'self' profile, or change a profile's
  relationship to or from 'self'. Enforced by trigger for API calls
  (auth.uid() is set). Account deletion by an admin/service role
  (auth.uid() is null) still cascades normally.
- `owner_id` cannot be changed.

## 4. Avatars (private storage)
- Private bucket `avatars`, 2 MB limit, JPEG/PNG/WebP only.
- Object path: `{owner_id}/{profile_id}/{file}`.
- Policies: authenticated users can read/write/delete only objects under
  their own `{auth.uid()}/` folder. No public access; the app uses
  short-lived signed URLs.
*/

-- 1 ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.user_owns_profile(uuid) TO authenticated;

-- 2 ─────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm numeric
    CHECK (height_cm IS NULL OR (height_cm >= 30 AND height_cm <= 250)),
  ADD COLUMN IF NOT EXISTS weight_kg numeric
    CHECK (weight_kg IS NULL OR (weight_kg >= 1 AND weight_kg <= 400));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_relationship_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_relationship_check
  CHECK (relationship IN ('self', 'spouse', 'mother', 'father', 'parent', 'child', 'sibling', 'other'));

-- 3 ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_one_self_per_owner
  ON public.profiles (owner_id)
  WHERE relationship = 'self';

CREATE OR REPLACE FUNCTION public.protect_self_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.relationship = 'self' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Your own profile cannot be deleted'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.owner_id <> OLD.owner_id THEN
    RAISE EXCEPTION 'Profile owner cannot be changed'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (OLD.relationship = 'self') <> (NEW.relationship = 'self') AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'The relationship of your own profile cannot be changed'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_self_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_protect_self ON public.profiles;
CREATE TRIGGER trg_profiles_protect_self
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_self_profile();

-- 4 ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;
CREATE POLICY "avatars_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
