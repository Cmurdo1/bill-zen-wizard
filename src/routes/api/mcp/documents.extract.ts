import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  createMcpContext,
  enforceMcpActionRateLimit,
  mcpErrorResponse,
  McpHttpError,
  assertMcpScope,
  logMcpAction,
} from "@/lib/mcp-api-shared";
import { extractLineItemsWithAI } from "@/lib/ai-extract";
import { isPaidPlan, type PricingRule } from "@/lib/estimate-ai";

const ExtractInput = z.object({
  description: z.string().trim().min(4).max(4000),
  currency: z.string().length(3).default("USD"),
});

export const Route = createFileRoute("/api/mcp/documents/extract")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          const { userId, supabase } = context;
          assertMcpScope(context, "ai");
          await enforceMcpActionRateLimit(context, "ai");

          const body = await request.json();
          const parsed = ExtractInput.parse(body);

          const { data: profile } = await supabase
            .from("profiles")
            .select("subscription_status,subscription_end")
            .eq("id", userId)
            .maybeSingle();

          if (!isPaidPlan(profile?.subscription_status, profile?.subscription_end)) {
            throw new McpHttpError(403, "AI line-item extraction requires a Pro or Business plan.");
          }

          // Rate book may not exist on all deployments (legacy schema) — treat as empty.
          let rules: PricingRule[] = [];
          try {
            const { data } = await supabase
              .from("pricing_rules")
              .select("label,unit,rate_cents,notes")
              .eq("user_id", userId)
              .order("label");
            if (data) rules = data as PricingRule[];
          } catch {
            rules = [];
          }

          const result = await extractLineItemsWithAI({
            description: parsed.description,
            currency: parsed.currency,
            rules,
          });

          await logMcpAction(context, "extract", "ai", undefined, {
            description_length: parsed.description.length,
          });

          return new Response(
            JSON.stringify({
              items: result.items.map((it) => ({
                description: it.description,
                quantity: it.quantity,
                rate_cents: it.rate_cents,
              })),
              measurements: result.measurements,
              assumptions: result.assumptions,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (e) {
          if (e instanceof z.ZodError) {
            return new Response(JSON.stringify({ error: "Invalid input", details: e.errors }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          return mcpErrorResponse(e);
        }
      },
    },
  },
});
