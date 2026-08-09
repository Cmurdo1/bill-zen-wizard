import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  assertMcpScope,
  createMcpContext,
  logMcpAction,
  mcpErrorResponse,
  McpHttpError,
} from "@/lib/mcp-api-shared";

const RuleInput = z.object({
  label: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(50).default("each"),
  rate_cents: z.number().int().nonnegative().max(100_000_000),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const RulePatch = RuleInput.partial();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/mcp/rate-book")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "read");
          const { data, error } = await context.supabase
            .from("pricing_rules")
            .select("id,label,unit,rate_cents,notes,created_at,updated_at")
            .eq("user_id", context.userId)
            .order("label");
          if (error) throw error;
          return json({ rules: data ?? [] });
        } catch (error) {
          return mcpErrorResponse(error);
        }
      },
      POST: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "write");
          const input = RuleInput.parse(await request.json());
          const { data, error } = await context.supabase
            .from("pricing_rules")
            .insert({ ...input, user_id: context.userId })
            .select()
            .single();
          if (error) throw error;
          await logMcpAction(context, "create", "pricing_rule", data.id);
          return json({ rule: data }, 201);
        } catch (error) {
          if (error instanceof z.ZodError) return json({ error: "Invalid rate-book rule" }, 400);
          return mcpErrorResponse(error);
        }
      },
      PATCH: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "write");
          const body = z
            .object({ id: z.string().uuid(), patch: RulePatch })
            .parse(await request.json());
          const { data, error } = await context.supabase
            .from("pricing_rules")
            .update(body.patch)
            .eq("id", body.id)
            .eq("user_id", context.userId)
            .select()
            .maybeSingle();
          if (error) throw error;
          if (!data) throw new McpHttpError(404, "Rate-book rule not found");
          await logMcpAction(context, "update", "pricing_rule", data.id, {
            fields: Object.keys(body.patch),
          });
          return json({ rule: data });
        } catch (error) {
          if (error instanceof z.ZodError) return json({ error: "Invalid rate-book update" }, 400);
          return mcpErrorResponse(error);
        }
      },
    },
  },
});
