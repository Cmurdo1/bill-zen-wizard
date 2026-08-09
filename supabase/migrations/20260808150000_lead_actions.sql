-- Extend lead_responses status to support manual won/lost marking
-- from the Lead Board action buttons.
ALTER TABLE public.lead_responses
  DROP CONSTRAINT IF EXISTS lead_responses_status_check;

ALTER TABLE public.lead_responses
  ADD CONSTRAINT lead_responses_status_check
  CHECK (status IN ('pending','estimate_sent','opened','clicked','won','lost','failed'));

-- Index for quick filtering of won/lost leads
CREATE INDEX IF NOT EXISTS idx_lead_responses_status ON public.lead_responses(status);
