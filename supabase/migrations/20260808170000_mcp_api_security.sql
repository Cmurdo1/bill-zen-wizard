-- Dedicated MCP/API credentials are stored as hashes only.
CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read','write','send','ai','leads']::TEXT[],
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_user ON public.mcp_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_active ON public.mcp_api_keys(id, key_hash)
  WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.mcp_api_keys TO authenticated;
GRANT ALL ON public.mcp_api_keys TO service_role;
ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own MCP API keys" ON public.mcp_api_keys;
CREATE POLICY "Users can view own MCP API keys" ON public.mcp_api_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own MCP API keys" ON public.mcp_api_keys;
CREATE POLICY "Users can create own MCP API keys" ON public.mcp_api_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can revoke own MCP API keys" ON public.mcp_api_keys;
CREATE POLICY "Users can revoke own MCP API keys" ON public.mcp_api_keys
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Append-only audit records for agent actions. The service role writes these;
-- account owners can read their own records.
CREATE TABLE IF NOT EXISTS public.mcp_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.mcp_api_keys(id) ON DELETE SET NULL,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 100),
  resource_type TEXT NOT NULL CHECK (char_length(resource_type) BETWEEN 1 AND 50),
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_user_created
  ON public.mcp_audit_logs(user_id, created_at DESC);
GRANT SELECT ON public.mcp_audit_logs TO authenticated;
GRANT ALL ON public.mcp_audit_logs TO service_role;
ALTER TABLE public.mcp_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own MCP audit logs" ON public.mcp_audit_logs;
CREATE POLICY "Users can view own MCP audit logs" ON public.mcp_audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Atomic fixed-window limiter. The API uses a per-user or per-key bucket.
CREATE TABLE IF NOT EXISTS public.mcp_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0
);
GRANT ALL ON public.mcp_rate_limits TO service_role;
ALTER TABLE public.mcp_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_mcp_rate_limit(
  p_bucket_key TEXT,
  p_limit INTEGER DEFAULT 120,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  IF p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  INSERT INTO public.mcp_rate_limits(bucket_key, window_started_at, request_count)
  VALUES (p_bucket_key, now(), 1)
  ON CONFLICT (bucket_key) DO UPDATE SET
    request_count = CASE
      WHEN public.mcp_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now()
        THEN 1
      ELSE public.mcp_rate_limits.request_count + 1
    END,
    window_started_at = CASE
      WHEN public.mcp_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now()
        THEN now()
      ELSE public.mcp_rate_limits.window_started_at
    END
  RETURNING request_count INTO current_count;

  RETURN current_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_mcp_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_mcp_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
