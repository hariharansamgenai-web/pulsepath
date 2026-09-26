# RLS Test Plan — Row Level Security Verification

## Overview

This document describes the test plan for verifying that Row Level Security (RLS)
policies correctly isolate user data in the Personal Health Manager database.

## Architecture Summary

All health data tables use a `profile_id` foreign key to the `profiles` table.
The `profiles` table has an `owner_id` column that references `auth.users(id)`.
A SECURITY DEFINER helper function `user_owns_profile(profile_uuid)` checks
whether the current authenticated user owns a given profile.

Every health-data table has four RLS policies (SELECT, INSERT, UPDATE, DELETE),
each scoped to `TO authenticated` and using `user_owns_profile(profile_id)` for
ownership verification. The `audit_logs` table is append-only (SELECT + INSERT
only, no UPDATE or DELETE policies).

## Test Strategy

RLS policies cannot be tested through `execute_sql` (which bypasses RLS with a
privileged role). The correct approach is to test through the Supabase client
using authenticated sessions, or to simulate authenticated sessions in SQL
using `set_config('request.jwt.claims', ...)` and `set role`.

### Test Setup

Two test users are required:
- **User A**: Creates profile A, logs health data under profile A
- **User B**: Creates profile B, logs health data under profile B

Both users should have similar data so that cross-user access attempts have
realistic targets.

### Test Cases

#### 1. User A cannot read User B's data (SELECT isolation)

**What to test**: User A queries each health-data table and should only see
rows where `profile_id` belongs to a profile owned by User A.

**Tables to test**: profiles, goals, activities, daily_checkins, achievements,
foods, meals, food_logs, medical_documents, medical_shares, devices,
ai_summaries, audit_logs

**Expected result**: User A sees 0 rows from User B's profiles on every table.

**How to verify**: Sign in as User A → query each table → confirm the count
matches only User A's data. Sign in as User B → query each table → confirm
the count matches only User B's data.

#### 2. User A cannot insert data under User B's profile (INSERT isolation)

**What to test**: User A attempts to insert a row into each health-data table
with `profile_id` set to a profile owned by User B.

**Expected result**: Every insert is rejected by the RLS policy's WITH CHECK
constraint. The `user_owns_profile()` function returns false for User B's
profile when called by User A.

**How to verify**: Sign in as User A → attempt to insert a goal/activity/
check-in/document/etc. with User B's `profile_id` → confirm the insert fails
with a row-level security violation error.

#### 3. User A cannot update User B's data (UPDATE isolation)

**What to test**: User A attempts to update rows owned by User B.

**Expected result**: The UPDATE policy's USING clause (`user_owns_profile`)
returns false for User B's rows, so the update affects 0 rows. Additionally,
User A cannot reassign their own row's `profile_id` to User B's profile
(WITH CHECK prevents this).

**How to verify**: Sign in as User A → attempt to update a goal created by
User B → confirm 0 rows are affected. Also attempt to update User A's own
goal but change `profile_id` to User B's profile → confirm the update fails.

#### 4. User A cannot delete User B's data (DELETE isolation)

**What to test**: User A attempts to delete rows owned by User B.

**Expected result**: The DELETE policy's USING clause returns false for User
B's rows, so the delete affects 0 rows.

**How to verify**: Sign in as User A → attempt to delete a goal/check-in/
document created by User B → confirm 0 rows are affected.

#### 5. User A cannot access User B's medical documents (document-specific)

**What to test**: User A attempts to SELECT, INSERT, UPDATE, and DELETE rows
in `medical_documents` where `profile_id` belongs to User B. Additionally,
User A should not be able to download files from User B's storage paths.

**Expected result**: All operations are blocked by RLS. User A sees 0 medical
documents belonging to User B. Storage bucket policies (to be implemented in
a later phase) will further restrict file-level access.

**How to verify**: Sign in as User A → query `medical_documents` → confirm
only User A's documents are visible → attempt to insert/update/delete with
User B's `profile_id` → confirm all operations fail.

#### 6. Unauthenticated users cannot access any health data

**What to test**: Without signing in, attempt to query any health-data table
using the anon key.

**Expected result**: All queries return 0 rows or errors. All policies are
scoped to `TO authenticated`, so the `anon` role has no access.

**How to verify**: Use the Supabase client with only the anon key (no sign-in)
→ query each table → confirm 0 rows returned.

#### 7. Audit logs are append-only

**What to test**: An authenticated user attempts to UPDATE or DELETE a row in
`audit_logs`.

**Expected result**: Both operations fail. The `audit_logs` table has no
UPDATE or DELETE policies, so even the profile owner cannot modify or remove
audit entries after they are created.

**How to verify**: Sign in as User A → insert an audit log entry → attempt to
UPDATE the entry → confirm it fails → attempt to DELETE the entry → confirm
it fails.

#### 8. user_owns_profile function is not directly callable via REST API

**What to test**: Attempt to call `user_owns_profile()` via the Supabase REST
API (`/rest/v1/rpc/user_owns_profile`).

**Expected result**: The call is rejected. EXECUTE has been revoked from
`anon`, `authenticated`, and `PUBLIC`. The function is only used internally
by RLS policy predicates.

**How to verify**: Sign in as any user → attempt to call the RPC → confirm
it returns a permission error.

## Automated Test Execution

The following SQL script can be run via `execute_sql` to verify the schema
structure (table names, RLS enablement, policy names). This does NOT test
RLS enforcement (which requires authenticated sessions) but validates that
the policies exist and are correctly scoped.

```sql
-- Verify all tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify policy count per table
SELECT tablename, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Expected: every table except audit_logs has 4 policies.
-- audit_logs should have 2 (SELECT + INSERT only).
```

## Running the Isolation Tests

To run the full isolation tests, you need two authenticated Supabase sessions.
This can be done in the application by:

1. Register User A (email: usera@test.com, password: testtest123)
2. Create a profile for User A
3. Log some health data (a goal, a check-in, a document) under User A's profile
4. Sign out
5. Register User B (email: userb@test.com, password: testtest123)
6. Create a profile for User B
7. Log some health data under User B's profile
8. While signed in as User B, attempt to query User A's profile_id — confirm 0 rows
9. Sign out, sign in as User A, attempt to query User B's data — confirm 0 rows

## Test Results

| Test | Description | Status |
|---|---|---|
| 1 | User A cannot read User B's data | Pending app implementation |
| 2 | User A cannot insert under User B's profile | Pending app implementation |
| 3 | User A cannot update User B's data | Pending app implementation |
| 4 | User A cannot delete User B's data | Pending app implementation |
| 5 | User A cannot access User B's medical documents | Pending app implementation |
| 6 | Unauthenticated users cannot access health data | Pending app implementation |
| 7 | Audit logs are append-only | Pending app implementation |
| 8 | user_owns_profile not callable via REST | Verified via security advisor |

Tests 1-7 require the application's auth flow to be fully implemented (Phase 3)
before they can be executed end-to-end. The schema and RLS policies are in place
and verified via the Supabase security advisor (zero findings). Test 8 is
already verified — the security advisor confirmed the function is not callable
by anon or authenticated roles.
