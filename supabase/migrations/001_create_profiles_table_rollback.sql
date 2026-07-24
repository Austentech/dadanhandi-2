-- ============================================================
-- Rollback Migration
-- Reverses the profiles table creation
-- ============================================================

-- Remove triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;

-- Remove functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Remove RLS policies
DROP POLICY IF EXISTS "Deny profile deletion" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Disable RLS
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Remove indexes
DROP INDEX IF EXISTS public.profiles_created_at_idx;
DROP INDEX IF EXISTS public.profiles_whatsapp_number_idx;
DROP INDEX IF EXISTS public.profiles_profile_completed_idx;
DROP INDEX IF EXISTS public.profiles_provider_idx;
DROP INDEX IF EXISTS public.profiles_email_idx;
DROP INDEX IF EXISTS public.profiles_auth_user_id_idx;

-- Remove constraints
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_auth_user_id_key;

-- Drop table
DROP TABLE IF EXISTS public.profiles;
