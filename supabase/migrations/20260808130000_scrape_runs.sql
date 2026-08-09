-- Track cron-triggered lead scrape runs
CREATE TABLE IF NOT EXISTS public.scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sources TEXT[] NOT NULL DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}',
  leads_found INTEGER NOT NULL DEFAULT 0,
  estimates_created INTEGER NOT NULL DEFAULT 0,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  errors TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_user ON public.scrape_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_created ON public.scrape_runs(created_at DESC);

GRANT SELECT, INSERT ON public.scrape_runs TO authenticated;
GRANT ALL ON public.scrape_runs TO service_role;

ALTER TABLE public.scrape_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scrape runs" ON public.scrape_runs;
CREATE POLICY "Users can view own scrape runs" ON public.scrape_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
