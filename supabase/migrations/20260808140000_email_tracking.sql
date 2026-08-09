-- Email open & click tracking for lead responses.
-- Each lead email gets a unique tracking ID embedded as a 1×1 pixel
-- for open detection, and links are wrapped with click redirect URLs.

CREATE TABLE IF NOT EXISTS public.email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_response_id UUID REFERENCES public.lead_responses(id) ON DELETE CASCADE,
  tracking_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click')),
  url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tracking_tid ON public.email_tracking(tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_response ON public.email_tracking(lead_response_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event ON public.email_tracking(event_type, created_at);

GRANT SELECT, INSERT ON public.email_tracking TO authenticated;
GRANT ALL ON public.email_tracking TO service_role;

ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to insert tracking events (pixel loads / link clicks)
DROP POLICY IF EXISTS "Anyone can insert tracking events" ON public.email_tracking;
CREATE POLICY "Anyone can insert tracking events" ON public.email_tracking
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own tracking events" ON public.email_tracking;
CREATE POLICY "Users can view own tracking events" ON public.email_tracking
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.lead_responses lr
      WHERE lr.id = email_tracking.lead_response_id
      AND lr.user_id = auth.uid()
    )
  );

-- Add tracking fields to lead_responses for fast dashboard reads
ALTER TABLE public.lead_responses
  ADD COLUMN IF NOT EXISTS tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_responses_tracking_id
  ON public.lead_responses(tracking_id)
  WHERE tracking_id IS NOT NULL;

-- Allow status to include 'opened' and 'clicked' for more granular tracking
ALTER TABLE public.lead_responses
  DROP CONSTRAINT IF EXISTS lead_responses_status_check;

ALTER TABLE public.lead_responses
  ADD CONSTRAINT lead_responses_status_check
  CHECK (status IN ('pending','estimate_sent','opened','clicked','failed'));
