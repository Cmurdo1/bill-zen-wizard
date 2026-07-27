
-- Profiles: subscription tracking + legacy columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles(stripe_customer_id);

-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.check_admin_access()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin') $$;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Invoice feedback
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS feedback_token UUID DEFAULT gen_random_uuid();

CREATE TABLE IF NOT EXISTS public.invoice_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  client_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.invoice_feedback TO authenticated;
GRANT INSERT ON public.invoice_feedback TO anon;
GRANT ALL ON public.invoice_feedback TO service_role;
ALTER TABLE public.invoice_feedback ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_invoice_feedback_invoice_id ON public.invoice_feedback(invoice_id);

DROP POLICY IF EXISTS "Owners view feedback" ON public.invoice_feedback;
CREATE POLICY "Owners view feedback" ON public.invoice_feedback
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.invoices i
            WHERE i.id = invoice_feedback.invoice_id AND i.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Anyone can submit feedback with valid token" ON public.invoice_feedback;
CREATE POLICY "Anyone can submit feedback with valid token" ON public.invoice_feedback
  FOR INSERT TO anon, authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.invoices i
            WHERE i.id = invoice_id AND i.feedback_token IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.validate_feedback_token(p_invoice_id UUID, p_token UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.invoices WHERE id = p_invoice_id AND feedback_token = p_token) $$;

-- Webhook logs & job leads
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'unknown',
  source TEXT NOT NULL DEFAULT 'unknown',
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'received',
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.webhook_logs;
CREATE POLICY "Admins can view webhook logs" ON public.webhook_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.job_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  budget_range TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.job_leads TO authenticated;
GRANT ALL ON public.job_leads TO service_role;
ALTER TABLE public.job_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view job leads" ON public.job_leads;
CREATE POLICY "Admins can view job leads" ON public.job_leads
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update job leads" ON public.job_leads;
CREATE POLICY "Admins can update job leads" ON public.job_leads
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can delete job leads" ON public.job_leads;
CREATE POLICY "Admins can delete job leads" ON public.job_leads
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_job_leads_updated_at ON public.job_leads;
CREATE TRIGGER update_job_leads_updated_at
  BEFORE UPDATE ON public.job_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin RPCs
CREATE OR REPLACE FUNCTION public.get_webhook_logs()
RETURNS SETOF public.webhook_logs
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.webhook_logs WHERE public.check_admin_access() ORDER BY created_at DESC LIMIT 50 $$;

CREATE OR REPLACE FUNCTION public.get_job_leads()
RETURNS SETOF public.job_leads
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.job_leads WHERE public.check_admin_access() ORDER BY created_at DESC LIMIT 20 $$;

CREATE OR REPLACE FUNCTION public.update_job_lead_status(lead_id UUID, new_status TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  IF NOT public.check_admin_access() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.job_leads SET status = new_status, updated_at = now() WHERE id = lead_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (id uuid, email text, business_name text, subscription_status text,
               subscription_end timestamptz, created_at timestamptz, invoice_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT au.id, au.email, p.business_name, p.subscription_status, p.subscription_end, au.created_at,
    (SELECT COUNT(*) FROM public.invoices i WHERE i.user_id = au.id)
  FROM auth.users au LEFT JOIN public.profiles p ON p.id = au.id
  WHERE public.check_admin_access()
  ORDER BY au.created_at DESC LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS TABLE (total_users bigint, total_invoices bigint, total_clients bigint,
               total_revenue_cents bigint, active_subscriptions bigint,
               invoices_this_month bigint, users_this_month bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (SELECT COUNT(*) FROM auth.users),
         (SELECT COUNT(*) FROM public.invoices),
         (SELECT COUNT(*) FROM public.clients),
         (SELECT COALESCE(SUM(total_cents),0) FROM public.invoices WHERE status='paid'),
         (SELECT COUNT(*) FROM public.profiles WHERE subscription_status='active'),
         (SELECT COUNT(*) FROM public.invoices WHERE created_at >= date_trunc('month', now())),
         (SELECT COUNT(*) FROM auth.users WHERE created_at >= date_trunc('month', now()))
  WHERE public.check_admin_access()
$$;

CREATE OR REPLACE FUNCTION public.get_all_feedback()
RETURNS TABLE (id uuid, invoice_id uuid, rating integer, comment text,
               client_name text, created_at timestamptz, invoice_number text, user_email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT f.id, f.invoice_id, f.rating, f.comment, f.client_name, f.created_at, i.invoice_number, au.email
  FROM public.invoice_feedback f
  JOIN public.invoices i ON i.id = f.invoice_id
  JOIN auth.users au ON au.id = i.user_id
  WHERE public.check_admin_access()
  ORDER BY f.created_at DESC LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.get_subscription_stats()
RETURNS TABLE (status text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(subscription_status,'none'), COUNT(*) FROM public.profiles
  WHERE public.check_admin_access() GROUP BY subscription_status ORDER BY 2 DESC
$$;

-- Safe profiles view (hides Stripe customer id)
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe WITH (security_invoker = on) AS
SELECT id, full_name, business_name, company_name, logo_url, email, phone,
       address_line1, address_line2, city, state, postal_code, country,
       brand_color, default_currency, default_payment_terms,
       invoice_prefix, estimate_prefix, tax_id,
       subscription_status, subscription_end, created_at, updated_at
FROM public.profiles;
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Storage policies for business-assets (owner-scoped by folder = user id)
DROP POLICY IF EXISTS "Users read own business assets" ON storage.objects;
CREATE POLICY "Users read own business assets" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users upload own business assets" ON storage.objects;
CREATE POLICY "Users upload own business assets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own business assets" ON storage.objects;
CREATE POLICY "Users update own business assets" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own business assets" ON storage.objects;
CREATE POLICY "Users delete own business assets" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text
  );
