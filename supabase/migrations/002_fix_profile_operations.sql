-- ============================================================
-- Migration 002: Fix Profile Operations
-- Creates SECURITY DEFINER functions that bypass RLS
-- Updates trigger to read ALL registration metadata
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. SECURITY DEFINER function: Create or update profile (bypasses RLS)
-- This is used by API routes where no user session exists yet
CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_auth_user_id UUID,
  p_email TEXT DEFAULT '',
  p_full_name TEXT DEFAULT '',
  p_whatsapp_number TEXT DEFAULT NULL,
  p_mobile_number TEXT DEFAULT NULL,
  p_area TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_pincode TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT 'email',
  p_profile_completed BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  v_profile JSONB;
BEGIN
  INSERT INTO public.profiles (auth_user_id, email, full_name, whatsapp_number, mobile_number, area, city, pincode, avatar_url, provider, profile_completed)
  VALUES (p_auth_user_id, p_email, p_full_name, p_whatsapp_number, p_mobile_number, p_area, p_city, p_pincode, p_avatar_url, p_provider, p_profile_completed)
  ON CONFLICT (auth_user_id) DO UPDATE SET
    full_name = COALESCE(NULLIF(p_full_name, ''), profiles.full_name),
    email = COALESCE(NULLIF(p_email, ''), profiles.email),
    whatsapp_number = COALESCE(p_whatsapp_number, profiles.whatsapp_number),
    mobile_number = COALESCE(p_mobile_number, profiles.mobile_number),
    area = COALESCE(p_area, profiles.area),
    city = COALESCE(p_city, profiles.city),
    pincode = COALESCE(p_pincode, profiles.pincode),
    avatar_url = COALESCE(p_avatar_url, profiles.avatar_url),
    provider = COALESCE(NULLIF(p_provider, ''), profiles.provider),
    profile_completed = p_profile_completed,
    updated_at = now()
  RETURNING row_to_json(profiles.*) INTO v_profile;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. SECURITY DEFINER function: Get profile by auth_user_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_profile_by_auth_id(p_auth_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile JSONB;
BEGIN
  SELECT row_to_json(profiles.*) INTO v_profile
  FROM public.profiles
  WHERE auth_user_id = p_auth_user_id;
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. SECURITY DEFINER function: Get profile by email (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_profile_by_email_fn(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_profile JSONB;
BEGIN
  SELECT row_to_json(profiles.*) INTO v_profile
  FROM public.profiles
  WHERE email = LOWER(p_email);
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update trigger to read ALL registration metadata from user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (auth_user_id, email, full_name, whatsapp_number, mobile_number, area, city, pincode, provider, avatar_url, profile_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'name', '')),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp_number', NULL),
    COALESCE(NEW.raw_user_meta_data->>'mobile_number', NULL),
    COALESCE(NEW.raw_user_meta_data->>'area', NULL),
    COALESCE(NEW.raw_user_meta_data->>'city', NULL),
    COALESCE(NEW.raw_user_meta_data->>'pincode', NULL),
    COALESCE(NEW.raw_user_meta_data->>'provider', 'email'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'provider', 'email') = 'google' THEN false
      ELSE true
    END
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    full_name = COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      profiles.full_name
    ),
    whatsapp_number = COALESCE(NEW.raw_user_meta_data->>'whatsapp_number', profiles.whatsapp_number),
    mobile_number = COALESCE(NEW.raw_user_meta_data->>'mobile_number', profiles.mobile_number),
    area = COALESCE(NEW.raw_user_meta_data->>'area', profiles.area),
    city = COALESCE(NEW.raw_user_meta_data->>'city', profiles.city),
    pincode = COALESCE(NEW.raw_user_meta_data->>'pincode', profiles.pincode),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.upsert_profile TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_by_auth_id TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_by_email_fn TO authenticated, anon;
