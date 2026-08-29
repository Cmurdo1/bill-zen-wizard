-- Fix new-user signups on the legacy live database.
--
-- The deployed legacy `profiles` table stores the display name in
-- `business_name` and has no `full_name` / `company_name` columns. The
-- previous version of this trigger INSERTed into `full_name` / `company_name`,
-- so every new auth.users row failed with "column ... does not exist" and
-- signups (both the UI and the admin API) 500'd.
--
-- This version adapts at runtime: on the new schema it fills
-- full_name/company_name as before; on the legacy schema it fills
-- business_name. Safe to apply to either database.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  has_full_name boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'full_name'
  ) INTO has_full_name;

  IF has_full_name THEN
    INSERT INTO public.profiles (id, full_name, company_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
      NEW.raw_user_meta_data->>'company_name',
      NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  ELSE
    INSERT INTO public.profiles (id, business_name, email)
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'business_name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name'
      ),
      NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  END IF;
  RETURN NEW;
END; $$;
