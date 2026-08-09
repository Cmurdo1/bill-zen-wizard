-- Retry protection for agent mutations. A key is scoped to the account and
-- endpoint, and cached responses expire so the table cannot grow forever.
CREATE TABLE IF NOT EXISTS public.mcp_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.mcp_api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL CHECK (char_length(endpoint) BETWEEN 1 AND 100),
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 128),
  payload_hash TEXT NOT NULL CHECK (char_length(payload_hash) = 64),
  status TEXT NOT NULL CHECK (status IN ('processing', 'complete')),
  response_status INTEGER,
  response_body JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_mcp_idempotency_expiry
  ON public.mcp_idempotency_keys(expires_at);
GRANT ALL ON public.mcp_idempotency_keys TO service_role;
ALTER TABLE public.mcp_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Only server-side API handlers can read or write replay records.
REVOKE ALL ON public.mcp_idempotency_keys FROM anon, authenticated;
