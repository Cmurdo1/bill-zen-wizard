
CREATE TABLE public.document_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('invoice','estimate')),
  document_id uuid NOT NULL,
  action text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_activity_doc ON public.document_activity(document_type, document_id, created_at DESC);
GRANT SELECT, INSERT ON public.document_activity TO authenticated;
GRANT ALL ON public.document_activity TO service_role;
ALTER TABLE public.document_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own activity" ON public.document_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own activity" ON public.document_activity FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Prevent double convert: track converted_at on estimates
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS converted_at timestamptz;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS converted_invoice_id uuid;

-- Stripe sync: track stripe payment intent / checkout id on invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_session ON public.invoices(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_token ON public.invoices(payment_link_token);
