/*
# Auto-create profile on user signup

## Purpose
When a new user registers via Supabase Auth, a corresponding row in the
`profiles` table must be created automatically. This trigger fires after a
new row is inserted into `auth.users` and creates a `profiles` row with:

- `owner_id` set to the new user's ID
- `display_name` derived from the user's email (the part before @), since
  email/password signup doesn't collect a display name. The user can update
  this later from the Profile page.
- `relationship` = 'self' (the account owner's own profile)

## New Functions

### `handle_new_user()`
A SECURITY DEFINER trigger function that reads the new user's ID and email
from the `NEW` record (the inserted `auth.users` row) and inserts a
`profiles` row. It runs as the table owner so it can write to `profiles`
regardless of the calling role's permissions.

## Security
- The function is SECURITY DEFINER (runs with owner privileges).
- EXECUTE is revoked from PUBLIC, anon, and authenticated — the function
  is only callable by the trigger, not via the REST API.
- `search_path` is pinned to `public` (security advisor compliance).
*/
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (owner_id, display_name, relationship)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      split_part(NEW.email, '@', 1)
    ),
    'self'
  );
  RETURN NEW;
END;
$$;

-- Revoke direct execution from all non-superuser roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
