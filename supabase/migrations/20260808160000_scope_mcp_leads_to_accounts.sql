-- MCP-created leads belong to the account whose access token created them.
-- Existing admin-created rows remain nullable for backwards compatibility.
ALTER TABLE public.job_leads
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_job_leads_user ON public.job_leads(user_id);

DROP POLICY IF EXISTS "Authenticated users can insert job leads" ON public.job_leads;
CREATE POLICY "Users can insert own job leads" ON public.job_leads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own job leads" ON public.job_leads;
CREATE POLICY "Users can view own job leads" ON public.job_leads
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update own job leads" ON public.job_leads;
CREATE POLICY "Users can update own job leads" ON public.job_leads
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete own job leads" ON public.job_leads;
CREATE POLICY "Users can delete own job leads" ON public.job_leads
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
