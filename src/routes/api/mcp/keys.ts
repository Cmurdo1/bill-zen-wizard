import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  createMcpUserContext,
  hashMcpApiKey,
  mcpErrorResponse,
  requireMcpPaidPlan,
  MCP_SCOPES,
  type McpScope,
} from "@/lib/mcp-api-shared";

const CreateKeyInput = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z
    .array(z.enum(MCP_SCOPES as [McpScope, ...McpScope[]]))
    .min(1)
    .max(5)
    .default(["read", "write", "send", "ai", "leads"]),
  expires_at: z.string().datetime().optional().nullable(),
});

const KEY_PREFIX_LENGTH = 16;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const encoded = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `hi_mcp_${encoded}`;
}

export const Route = createFileRoute("/api/mcp/keys")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { userId, supabase } = await createMcpUserContext(request);
          await requireMcpPaidPlan(supabase, userId);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          const { data, error } = await db
            .from("mcp_api_keys")
            .select("id,name,key_prefix,scopes,expires_at,last_used_at,revoked_at,created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
          if (error) throw error;
          return json({ keys: data ?? [] });
        } catch (error) {
          return mcpErrorResponse(error);
        }
      },

      POST: async ({ request }) => {
        try {
          const { userId, supabase } = await createMcpUserContext(request);
          await requireMcpPaidPlan(supabase, userId);
          const input = CreateKeyInput.parse(await request.json());
          if (input.expires_at && new Date(input.expires_at).getTime() <= Date.now()) {
            return json({ error: "expires_at must be in the future" }, 400);
          }

          const secret = generateApiKey();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          const { data, error } = await db
            .from("mcp_api_keys")
            .insert({
              user_id: userId,
              name: input.name,
              key_prefix: secret.slice(0, KEY_PREFIX_LENGTH),
              key_hash: await hashMcpApiKey(secret),
              scopes: input.scopes,
              expires_at: input.expires_at ?? null,
            })
            .select("id,name,key_prefix,scopes,expires_at,created_at")
            .single();
          if (error) throw error;

          // The secret is intentionally returned exactly once.
          return json({ key: secret, record: data }, 201);
        } catch (error) {
          if (error instanceof z.ZodError) return json({ error: "Invalid API key request" }, 400);
          return mcpErrorResponse(error);
        }
      },

      PATCH: async ({ request }) => {
        try {
          const { userId, supabase } = await createMcpUserContext(request);
          await requireMcpPaidPlan(supabase, userId);
          const body = z
            .object({ id: z.string().uuid(), revoked: z.literal(true) })
            .parse(await request.json());
          const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          const { data: revoked, error } = await db.rpc("revoke_mcp_api_key", {
            p_key_id: body.id,
          });
          if (error) throw error;
          if (revoked !== true) return json({ error: "API key not found or already revoked" }, 404);
          return json({ success: true });
        } catch (error) {
          if (error instanceof z.ZodError) return json({ error: "Invalid API key request" }, 400);
          return mcpErrorResponse(error);
        }
      },
    },
  },
});
