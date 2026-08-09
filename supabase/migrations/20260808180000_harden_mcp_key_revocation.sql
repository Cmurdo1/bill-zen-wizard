-- API-key revocation is intentionally irreversible. Account owners manage keys
-- through the server endpoint/security-definer function, not arbitrary updates.
REVOKE UPDATE ON public.mcp_api_keys FROM authenticated;

CREATE OR REPLACE FUNCTION public.revoke_mcp_api_key(p_key_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE public.mcp_api_keys
  SET revoked_at = COALESCE(revoked_at, now())
  WHERE id = p_key_id
    AND user_id = auth.uid()
    AND revoked_at IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_mcp_api_key(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_mcp_api_key(UUID) TO authenticated;
