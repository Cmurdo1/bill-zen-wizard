import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export class McpHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type McpPlan = "pro" | "business";
export type McpScope = "read" | "write" | "send" | "ai" | "leads";
export const MCP_SCOPES: readonly McpScope[] = ["read", "write", "send", "ai", "leads"];

type SubscriptionProfile = {
  subscription_status: string | null;
  subscription_end: string | null;
};

/** Return the paid MCP plan represented by a profile subscription. */
export function mcpPlanFromSubscription(
  status: string | null | undefined,
  end: string | null | undefined,
): McpPlan | null {
  const normalizedStatus = status?.toLowerCase();
  if (!normalizedStatus || normalizedStatus === "free" || normalizedStatus === "canceled") {
    return null;
  }

  const activeUntil = end ? new Date(end) : null;
  if (activeUntil && (Number.isNaN(activeUntil.getTime()) || activeUntil.getTime() < Date.now())) {
    return null;
  }

  if (normalizedStatus === "business" || normalizedStatus === "active_business") {
    return "business";
  }

  if (["pro", "active", "active_pro", "trialing"].includes(normalizedStatus)) {
    return "pro";
  }

  return null;
}

/**
 * Require an active Pro or Business subscription for MCP operations.
 * Fail closed when the profile cannot be read, so an authenticated token
 * alone can never unlock MCP access.
 */
export async function requireMcpPaidPlan(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
): Promise<McpPlan> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("subscription_status,subscription_end")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new McpHttpError(500, "Unable to verify MCP subscription");

  const plan = mcpPlanFromSubscription(
    (profile as SubscriptionProfile | null)?.subscription_status,
    (profile as SubscriptionProfile | null)?.subscription_end,
  );

  if (!plan) {
    throw new McpHttpError(403, "MCP access requires an active Pro or Business plan.");
  }

  return plan;
}

export function mcpErrorResponse(error: unknown): Response {
  // Do not reflect arbitrary upstream/database errors to API clients.
  const status = error instanceof McpHttpError ? error.status : 500;
  if (!(error instanceof McpHttpError)) console.error(error);
  const message = error instanceof McpHttpError ? error.message : "Internal server error";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

/**
 * Validate the Authorization bearer token against Supabase and return an
 * RLS-scoped client acting as that user (no service-role key required).
 */
export type McpContext = {
  userId: string;
  plan: McpPlan;
  scopes: readonly McpScope[];
  credentialType: "session" | "api_key";
  apiKeyId: string | null;
  requestId: string;
  supabase: ReturnType<typeof createClient<Database>>;
};

function getRequestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && supplied.length <= 100 ? supplied : crypto.randomUUID();
}

export async function hashMcpApiKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashMcpRequestBody(request: Request): Promise<string> {
  const body = await request.clone().text();
  return hashMcpApiKey(body);
}

export function isMcpApiKey(value: string): boolean {
  return value.startsWith("hi_mcp_");
}

export function assertMcpScope(context: McpContext, scope: McpScope): void {
  if (context.credentialType === "session" || context.scopes.includes(scope)) return;
  throw new McpHttpError(403, `This API key does not include the '${scope}' scope.`);
}

export async function enforceMcpActionRateLimit(
  context: McpContext,
  action: "write" | "send" | "ai" | "leads",
): Promise<void> {
  const limits = {
    write: { limit: 60, windowSeconds: 60 },
    send: { limit: 10, windowSeconds: 60 },
    ai: { limit: 30, windowSeconds: 60 },
    leads: { limit: 10, windowSeconds: 60 },
  } as const;
  const selected = limits[action];
  await consumeMcpRateLimit(
    `mcp:${context.credentialType}:${context.apiKeyId ?? context.userId}:${action}`,
    selected.limit,
    selected.windowSeconds,
  );
}

export async function reserveMcpIdempotencyKey(
  context: McpContext,
  request: Request,
  endpoint: string,
  payloadHash: string,
): Promise<{
  key: string | null;
  replay: Response | null;
}> {
  const rawKey = request.headers.get("Idempotency-Key")?.trim();
  if (!rawKey) return { key: null, replay: null };
  if (!/^[A-Za-z0-9._~-]{1,128}$/.test(rawKey)) {
    throw new McpHttpError(400, "Invalid Idempotency-Key");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError } = await db
    .from("mcp_idempotency_keys")
    .delete()
    .lt("expires_at", new Date().toISOString());
  if (cleanupError) throw new McpHttpError(503, "Idempotency protection is unavailable");

  const { data: existing, error: existingError } = await db
    .from("mcp_idempotency_keys")
    .select("status,response_status,response_body,expires_at,payload_hash")
    .eq("user_id", context.userId)
    .eq("endpoint", endpoint)
    .eq("idempotency_key", rawKey)
    .maybeSingle();
  if (existingError) throw new McpHttpError(503, "Idempotency protection is unavailable");

  if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
    if (existing.payload_hash !== payloadHash) {
      throw new McpHttpError(409, "This Idempotency-Key was already used with different input");
    }
    if (existing.status === "processing") {
      throw new McpHttpError(409, "A request with this Idempotency-Key is already processing");
    }
    return {
      key: rawKey,
      replay: new Response(JSON.stringify(existing.response_body ?? {}), {
        status: existing.response_status ?? 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }

  const { error: insertError } = await db.from("mcp_idempotency_keys").insert({
    user_id: context.userId,
    api_key_id: context.apiKeyId,
    endpoint,
    idempotency_key: rawKey,
    payload_hash: payloadHash,
    status: "processing",
    response_status: null,
    response_body: null,
    expires_at: expiresAt,
  });
  if (insertError) {
    throw new McpHttpError(409, "A request with this Idempotency-Key is already processing");
  }
  return { key: rawKey, replay: null };
}

export async function completeMcpIdempotencyKey(
  context: McpContext,
  endpoint: string,
  key: string | null,
  status: number,
  body: unknown,
): Promise<void> {
  if (!key) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { error } = await db
    .from("mcp_idempotency_keys")
    .update({ status: "complete", response_status: status, response_body: body })
    .eq("user_id", context.userId)
    .eq("endpoint", endpoint)
    .eq("idempotency_key", key);
  if (error) throw new McpHttpError(503, "Idempotency protection is unavailable");
}

export async function releaseMcpIdempotencyKey(
  context: McpContext,
  endpoint: string,
  key: string | null,
): Promise<void> {
  if (!key) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  await db
    .from("mcp_idempotency_keys")
    .delete()
    .eq("user_id", context.userId)
    .eq("endpoint", endpoint)
    .eq("idempotency_key", key)
    .eq("status", "processing");
}

async function consumeMcpRateLimit(
  bucketKey: string,
  limit = 120,
  windowSeconds = 60,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // This RPC and the API-key tables are server-only security infrastructure;
  // use a narrow untyped boundary so generated client types can lag migrations.
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await db.rpc("consume_mcp_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new McpHttpError(503, "API rate limiting is unavailable; try again shortly.");
  if (data !== true) throw new McpHttpError(429, "API rate limit exceeded; try again shortly.");
}

async function buildMcpUserClient(
  token: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<ReturnType<typeof createClient<Database>>> {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    global: {
      fetch: createSupabaseFetch(supabaseKey),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Authenticate a browser/session JWT without granting API-key semantics. */
export async function createMcpUserContext(request: Request): Promise<{
  userId: string;
  supabase: ReturnType<typeof createClient<Database>>;
}> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new McpHttpError(401, "Unauthorized");
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || isMcpApiKey(token)) throw new McpHttpError(401, "A Supabase session is required.");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new McpHttpError(500, "Supabase not configured");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey },
  });
  if (!response.ok) throw new McpHttpError(401, "Unauthorized");
  const userData = await response.json();
  if (!userData?.id) throw new McpHttpError(401, "Unauthorized");

  return {
    userId: userData.id,
    supabase: await buildMcpUserClient(token, supabaseUrl, supabaseKey),
  };
}

export async function logMcpAction(
  context: McpContext,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { error } = await db.from("mcp_audit_logs").insert({
    user_id: context.userId,
    api_key_id: context.apiKeyId,
    request_id: context.requestId,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    metadata,
  });
  if (error) throw new McpHttpError(503, "Audit logging is unavailable; try again shortly.");
}

export async function createMcpContext(request: Request): Promise<McpContext> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new McpHttpError(401, "Unauthorized");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new McpHttpError(401, "Unauthorized");

  const requestId = getRequestId(request);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new McpHttpError(500, "Supabase not configured");

  let userId: string;
  let supabase: ReturnType<typeof createClient<Database>>;
  let credentialType: "session" | "api_key" = "session";
  let scopes: readonly McpScope[] = MCP_SCOPES;
  let apiKeyId: string | null = null;

  if (isMcpApiKey(token)) {
    credentialType = "api_key";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const keyHash = await hashMcpApiKey(token);
    const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data: keyRow, error: keyError } = await db
      .from("mcp_api_keys")
      .select("id,user_id,scopes,expires_at")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (keyError || !keyRow) throw new McpHttpError(401, "Invalid API key");
    if (keyRow.expires_at && new Date(keyRow.expires_at).getTime() <= Date.now()) {
      throw new McpHttpError(401, "API key expired");
    }
    userId = keyRow.user_id;
    apiKeyId = keyRow.id;
    scopes = (Array.isArray(keyRow.scopes) ? keyRow.scopes : []).filter(
      (scope): scope is McpScope => MCP_SCOPES.includes(scope as McpScope),
    );
    supabase = supabaseAdmin;
    await db
      .from("mcp_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKeyId);
  } else {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey },
    });
    if (!response.ok) throw new McpHttpError(401, "Unauthorized");
    const userData = await response.json();
    if (!userData?.id) throw new McpHttpError(401, "Unauthorized");
    userId = userData.id;
    supabase = await buildMcpUserClient(token, supabaseUrl, supabaseKey);
  }

  const plan = await requireMcpPaidPlan(supabase, userId);
  await consumeMcpRateLimit(`mcp:${credentialType}:${apiKeyId ?? userId}`);

  return { userId, plan, scopes, credentialType, apiKeyId, requestId, supabase };
}

let _legacySchema: boolean | null = null;

/**
 * Detect which invoices schema the connected project uses.
 * New schema (repo migrations): subtotal_cents / tax_cents / total_cents / currency.
 * Legacy schema (deployed live DB): total_amount / tax_amount (dollars) / type.
 */
export async function isLegacyInvoiceSchema(supabase: unknown): Promise<boolean> {
  if (_legacySchema !== null) return _legacySchema;
  const client = supabase as {
    from: (table: string) => {
      select: (cols: string) => {
        limit: (n: number) => PromiseLike<{ error: { code?: string } | null }>;
      };
    };
  };
  const { error } = await client.from("invoices").select("total_cents").limit(1);
  _legacySchema = !!(error && error.code === "42703");
  return _legacySchema;
}
