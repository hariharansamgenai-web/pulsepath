-- ============================================================================
-- Phase 4 profile isolation tests
-- Run in the Supabase SQL Editor (or psql) AFTER all migrations.
-- Everything runs in one transaction and is ROLLED BACK: no data is kept.
-- Each check prints "PASS ..."; the first failure stops the script with "FAIL ...".
-- ============================================================================
BEGIN;

-- Two throwaway users (the signup trigger creates their 'self' profiles)
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000aa', 'rls-test-a@example.invalid'),
  ('00000000-0000-0000-0000-0000000000bb', 'rls-test-b@example.invalid');

-- Seed a check-in for user B (as admin), and remember B's profile id
CREATE TEMP TABLE _ids AS
  SELECT id AS b_self FROM public.profiles
  WHERE owner_id = '00000000-0000-0000-0000-0000000000bb' AND relationship = 'self';
GRANT SELECT ON _ids TO authenticated;
INSERT INTO public.daily_checkins (profile_id, date, mood) SELECT b_self, current_date, 'good' FROM _ids;

-- Act as user A
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}', true);

DO $$
DECLARE
  a uuid := '00000000-0000-0000-0000-0000000000aa';
  b uuid := '00000000-0000-0000-0000-0000000000bb';
  b_self uuid := (SELECT _ids.b_self FROM _ids);
  a_self uuid;
  kid uuid;
  n int;
BEGIN
  SELECT id INTO a_self FROM public.profiles WHERE owner_id = a AND relationship = 'self';
  IF a_self IS NULL THEN RAISE EXCEPTION 'FAIL 1: signup did not create A''s self profile'; END IF;
  RAISE NOTICE 'PASS 1: A has a self profile';

  SELECT count(*) INTO n FROM public.profiles WHERE owner_id = b OR id = b_self;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 2: A can see B''s profiles'; END IF;
  RAISE NOTICE 'PASS 2: A cannot see B''s profiles';

  UPDATE public.profiles SET display_name = 'hacked' WHERE id = b_self;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 3: A updated B''s profile'; END IF;
  RAISE NOTICE 'PASS 3: A cannot edit B''s profile';

  DELETE FROM public.profiles WHERE id = b_self;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 4: A deleted B''s profile'; END IF;
  RAISE NOTICE 'PASS 4: A cannot delete B''s profile';

  BEGIN
    INSERT INTO public.profiles (owner_id, display_name, relationship) VALUES (b, 'planted', 'child');
    RAISE EXCEPTION 'FAIL 5: A created a profile owned by B';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 5: A cannot create profiles for B';
  END;

  INSERT INTO public.profiles (display_name, relationship, height_cm, weight_kg)
    VALUES ('Test child', 'child', 120, 25) RETURNING id INTO kid;
  RAISE NOTICE 'PASS 6: A can create a family profile';

  INSERT INTO public.daily_checkins (profile_id, date, mood) VALUES (kid, current_date, 'good');
  INSERT INTO public.daily_checkins (profile_id, date, mood) VALUES (a_self, current_date, 'okay');
  RAISE NOTICE 'PASS 7: A can log check-ins for own profiles (RLS helper permission works)';

  SELECT count(*) INTO n FROM public.daily_checkins WHERE profile_id = kid;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 8: child profile shows % check-ins, expected 1', n; END IF;
  RAISE NOTICE 'PASS 8: check-ins are separated per profile';

  BEGIN
    INSERT INTO public.daily_checkins (profile_id, date, mood) VALUES (b_self, current_date - 1, 'poor');
    RAISE EXCEPTION 'FAIL 9: A wrote a check-in into B''s profile';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 9: A cannot write into B''s profile';
  END;

  SELECT count(*) INTO n FROM public.daily_checkins WHERE profile_id = b_self;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 10: A can read B''s check-ins'; END IF;
  RAISE NOTICE 'PASS 10: A cannot read B''s check-ins';

  BEGIN
    DELETE FROM public.profiles WHERE id = a_self;
    RAISE EXCEPTION 'FAIL 11: A deleted own self profile';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 11: self profile cannot be deleted';
  END;

  BEGIN
    INSERT INTO public.profiles (display_name, relationship) VALUES ('Second me', 'self');
    RAISE EXCEPTION 'FAIL 12: A created a second self profile';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS 12: only one self profile per account';
  END;

  BEGIN
    UPDATE public.profiles SET relationship = 'self' WHERE id = kid;
    RAISE EXCEPTION 'FAIL 13: A turned a family profile into self';
  EXCEPTION WHEN check_violation OR unique_violation THEN
    RAISE NOTICE 'PASS 13: relationship cannot be switched to/from self';
  END;

  DELETE FROM public.profiles WHERE id = kid;
  SELECT count(*) INTO n FROM public.daily_checkins WHERE profile_id = kid;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 14: deleted profile left check-ins behind'; END IF;
  RAISE NOTICE 'PASS 14: deleting a family profile removes its records';

  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', b || '/x/avatar.png');
    RAISE EXCEPTION 'FAIL 15: A uploaded into B''s avatar folder';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 15: A cannot write to B''s avatar folder';
  END;

  INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', a || '/x/avatar.png');
  RAISE NOTICE 'PASS 16: A can write to own avatar folder';

  RAISE NOTICE 'ALL 16 CHECKS PASSED';
END $$;

ROLLBACK;
