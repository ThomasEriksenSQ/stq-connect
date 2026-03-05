

## Problem

The user `thomas@stacq.no` (id: `877c63e8-a70c-4b78-9258-3dc8b1bf3c20`) has no row in the `profiles` table. This means their name won't appear as owner on any contacts they own.

The `handle_new_user` trigger exists but apparently wasn't active when this user was created, so the profile was never auto-generated.

## Plan

1. **Insert missing profile row** via SQL:
   ```sql
   INSERT INTO public.profiles (id, full_name)
   VALUES ('877c63e8-a70c-4b78-9258-3dc8b1bf3c20', 'Thomas')
   ON CONFLICT (id) DO NOTHING;
   ```
   You may want to provide the correct full name — I'll use the name you specify, or default to the email prefix.

2. **Verify the trigger exists** so future signups auto-create profiles. The `handle_new_user` function exists but the trigger listing shows no triggers. I'll create the trigger if missing:
   ```sql
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```

No code changes needed — this is purely a database data + trigger fix.

