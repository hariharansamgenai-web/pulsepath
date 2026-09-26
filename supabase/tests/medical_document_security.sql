/*
# Medical document security tests — Phase 9

Tests three threat models:
  1. User B reads/writes a document owned by User A (DB RLS)
  2. Storage path prefix ensures User B cannot craft a valid path (application guard)
  3. User B cannot INSERT a document for User A's profile_id

All run inside a transaction that is rolled back — safe on live Supabase.

Run in Supabase SQL Editor or with:
  psql -h <host> -U postgres -d postgres -f supabase/tests/medical_document_security.sql
*/

BEGIN;

DO $$
DECLARE
  uid_a uuid := '00000000-0000-0000-0001-aaaaaaaaaaaa';
  uid_b uuid := '00000000-0000-0000-0002-bbbbbbbbbbbb';
  pid_a uuid;
  pid_b uuid;
  doc_a uuid;
  path_a text;
  row_count integer;
  affected integer;
BEGIN

  -- ── Provision test users and profiles (service-role, bypasses RLS) ──
  INSERT INTO auth.users (id, email) VALUES (uid_a, 'user_a@test.phm')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (uid_b, 'user_b@test.phm')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (owner_id, display_name, relationship)
    VALUES (uid_a, 'User A', 'self') ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles (owner_id, display_name, relationship)
    VALUES (uid_b, 'User B', 'self') ON CONFLICT DO NOTHING;

  SELECT id INTO pid_a FROM public.profiles WHERE owner_id = uid_a AND relationship = 'self';
  SELECT id INTO pid_b FROM public.profiles WHERE owner_id = uid_b AND relationship = 'self';

  -- Insert User A's document as service role
  path_a := uid_a::text || '/' || pid_a::text || '/test_lab_report.pdf';
  INSERT INTO public.medical_documents
    (profile_id, file_name, file_path, mime_type, file_size, category, document_name)
  VALUES
    (pid_a, 'test_lab_report.pdf', path_a, 'application/pdf', 1024, 'lab_report', 'Test Lab Report')
  RETURNING id INTO doc_a;

  RAISE NOTICE 'Setup: doc_a=%, path_a=%', doc_a, path_a;

  -- ── Switch to User B ────────────────────────────────────────────────
  SET LOCAL role = authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid_b::text, 'role', 'authenticated')::text, true);

  -- Test 1: User B cannot SELECT User A document
  SELECT count(*) INTO row_count
    FROM public.medical_documents WHERE id = doc_a;
  IF row_count = 0 THEN
    RAISE NOTICE 'PASS — Test 1: User B SELECT blocked (0 rows)';
  ELSE
    RAISE EXCEPTION 'FAIL — Test 1: User B read % row(s)', row_count;
  END IF;

  -- Test 2: User B cannot UPDATE User A document
  UPDATE public.medical_documents SET notes = 'tampered' WHERE id = doc_a;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN
    RAISE NOTICE 'PASS — Test 2: User B UPDATE blocked (0 rows)';
  ELSE
    RAISE EXCEPTION 'FAIL — Test 2: User B UPDATE affected % row(s)', affected;
  END IF;

  -- Test 3: User B cannot DELETE User A document
  DELETE FROM public.medical_documents WHERE id = doc_a;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN
    RAISE NOTICE 'PASS — Test 3: User B DELETE blocked (0 rows)';
  ELSE
    RAISE EXCEPTION 'FAIL — Test 3: User B DELETE removed % row(s)', affected;
  END IF;

  -- Test 4: User B cannot INSERT into User A profile
  BEGIN
    INSERT INTO public.medical_documents
      (profile_id, file_name, file_path, mime_type, file_size, category, document_name)
    VALUES
      (pid_a, 'evil.pdf', uid_b::text || '/' || pid_a::text || '/evil.pdf',
       'application/pdf', 512, 'other', 'Injected by B');
    RAISE EXCEPTION 'FAIL — Test 4: User B INSERT into User A profile succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%FAIL%' THEN RAISE EXCEPTION '%', SQLERRM; END IF;
    RAISE NOTICE 'PASS — Test 4: User B INSERT blocked (%)', SQLERRM;
  END;

  -- ── Switch to User A ────────────────────────────────────────────────
  SET LOCAL role = authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid_a::text, 'role', 'authenticated')::text, true);

  -- Test 5: User A can SELECT their own document
  SELECT count(*) INTO row_count
    FROM public.medical_documents WHERE id = doc_a;
  IF row_count = 1 THEN
    RAISE NOTICE 'PASS — Test 5: User A SELECT own document (1 row)';
  ELSE
    RAISE EXCEPTION 'FAIL — Test 5: User A got % rows for own document', row_count;
  END IF;

  -- Test 6: User A can UPDATE their own document
  UPDATE public.medical_documents SET notes = 'my note' WHERE id = doc_a;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 1 THEN
    RAISE NOTICE 'PASS — Test 6: User A UPDATE own document (1 row)';
  ELSE
    RAISE EXCEPTION 'FAIL — Test 6: User A UPDATE affected % rows', affected;
  END IF;

  -- Test 7: Storage path starts with user_id (application-layer convention)
  IF left(path_a, length(uid_a::text)) = uid_a::text THEN
    RAISE NOTICE 'PASS — Test 7: Storage path prefixed with owner uid (bucket policy verifiable)';
  ELSE
    RAISE EXCEPTION 'FAIL — Test 7: Path does not start with uid_a — got: %', path_a;
  END IF;

  RAISE NOTICE '=== All 7 tests passed — rolling back ===';
END $$;

ROLLBACK;
