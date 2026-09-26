/*
# Fix security advisor findings: function search_path and EXECUTE grants

## Purpose
Remediates three security advisor warnings:
1. `set_updated_at()` had a mutable search_path — now pinned to `public`.
2. `user_owns_profile()` was callable by the `anon` role via the REST API —
   EXECUTE revoked from `anon`.
3. `user_owns_profile()` was callable by the `authenticated` role via the REST
   API — EXECUTE revoked from `authenticated`.

The `user_owns_profile` function is intended for internal use only (called from
RLS policy predicates). RLS policies evaluate with the table owner's privileges
when a SECURITY DEFINER function is invoked, so revoking direct EXECUTE from
`anon` and `authenticated` does not break the policies — they still call the
function successfully because the policy evaluation path uses the definer's
rights. Direct RPC calls from the REST API are now blocked, preventing a user
from probing whether they own arbitrary profile UUIDs.
*/

-- Fix 1: Pin search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix 2 & 3: Revoke direct EXECUTE on user_owns_profile from anon and authenticated
-- The function is only used inside RLS policy predicates, not called directly.
REVOKE EXECUTE ON FUNCTION public.user_owns_profile(uuid) FROM anon, authenticated;
