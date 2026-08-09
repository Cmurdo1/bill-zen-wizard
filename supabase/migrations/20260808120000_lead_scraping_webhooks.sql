-- Track auto-generated estimates created in response to scraped leads.
-- Each row links a job_lead (from scraping) to the estimate that was
-- auto-created and sent to the lead.
CREATE TABLE IF NOT EXISTS public.lead_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.job_leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id UUID,
  estimate_number TEXT,
  client_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','estimate_sent','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_responses_lead ON public.lead_responses(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_responses_user ON public.lead_responses(user_id);

GRANT SELECT, INSERT, UPDATE ON public.lead_responses TO authenticated;
GRANT ALL ON public.lead_responses TO service_role;

ALTER TABLE public.lead_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own lead responses" ON public.lead_responses;
CREATE POLICY "Users can view own lead responses" ON public.lead_responses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own lead responses" ON public.lead_responses;
CREATE POLICY "Users can insert own lead responses" ON public.lead_responses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to insert job_leads (previously only admins).
-- This enables the webhook to accept scraped leads from any authenticated user.
DROP POLICY IF EXISTS "Authenticated users can insert job leads" ON public.job_leads;
CREATE POLICY "Authenticated users can insert job leads" ON public.job_leads
  FOR INSERT TO authenticated WITH CHECK (true);
