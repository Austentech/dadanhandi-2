-- ============================================================
-- Dadan Handi Mutton Hotel - Database Migration
-- Profiles Table + RLS Policies + Auto-create Trigger
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  whatsapp_number TEXT,
  mobile_number TEXT,
  area TEXT,
  city TEXT,
  pincode TEXT,
  avatar_url TEXT,
  provider TEXT NOT NULL DEFAULT 'email',
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create unique constraint on auth_user_id
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_auth_user_id_key UNIQUE (auth_user_id);

-- 3. Create unique constraint on email
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS profiles_auth_user_id_idx ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_provider_idx ON public.profiles(provider);
CREATE INDEX IF NOT EXISTS profiles_profile_completed_idx ON public.profiles(profile_completed);
CREATE INDEX IF NOT EXISTS profiles_whatsapp_number_idx ON public.profiles(whatsapp_number);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles(created_at);

-- 5. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies

-- Policy: Users can SELECT their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Policy: Users can UPDATE their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Policy: Users can INSERT their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

-- Policy: Deny DELETE for all users (no one can delete profiles)
CREATE POLICY "Deny profile deletion"
  ON public.profiles
  FOR DELETE
  USING (false);

-- 7. Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 9. Create a function to auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (auth_user_id, email, full_name, provider, avatar_url, profile_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'name', '')),
    COALESCE(NEW.raw_user_meta_data->>'provider', 'email'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'provider', 'email') = 'google' THEN false
      ELSE true
    END
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create trigger for auto profile creation on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 11. Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
