/*
# Revoke EXECUTE on user_owns_profile from PUBLIC

The previous revocation targeted anon and authenticated roles specifically, but
PostgreSQL grants EXECUTE to PUBLIC by default for functions. This migration
revokes from PUBLIC to ensure no role can call the function directly via REST.
The function is still usable inside RLS policy predicates because policy
evaluation runs with definer privileges.
*/

REVOKE EXECUTE ON FUNCTION public.user_owns_profile(uuid) FROM PUBLIC;
