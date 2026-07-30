-- 1. Protect billing columns on profiles
CREATE OR REPLACE FUNCTION public.protect_subscription_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND auth.uid() IS NOT NULL THEN
    NEW.subscription_status := OLD.subscription_status;
    NEW.subscription_end := OLD.subscription_end;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_subscription_columns ON public.profiles;
CREATE TRIGGER protect_subscription_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_subscription_columns();

-- 2. Leads: remove permissive always-true policies
DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;

-- 3. Storage: remove overly permissive business-assets / email-assets policies
DROP POLICY IF EXISTS "Business assets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own logos" ON storage.objects;
DROP POLICY IF EXISTS "Email assets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload email assets" ON storage.objects;

CREATE POLICY "Users update own business assets check"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Service role manages email assets"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'email-assets')
WITH CHECK (bucket_id = 'email-assets');

-- 4. Revoke unnecessary anon execute on security definer functions
REVOKE ALL ON FUNCTION public.generate_invoice_number() FROM anon, authenticated, PUBLIC;