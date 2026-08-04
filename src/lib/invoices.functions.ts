import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { runInference, readToolArguments } from "@/lib/ai-inference";

const ExtractInput = z.object({
  description: z.string().trim().min(4).max(4000),
  currency: z.string().length(3).default("USD"),
});

const ExtractSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          rate_cents: { type: "integer", description: "Unit price in the smallest currency unit (cents)" },
        },
        required: ["description", "quantity", "rate_cents"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export const extractLineItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }) => {
    // Server-side plan gate: AI extraction is a paid-plan feature.
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("subscription_status,subscription_end")
      .eq("id", context.userId)
      .maybeSingle();

    const status = profile?.subscription_status ?? "free";
    const activeUntil = profile?.subscription_end ? new Date(profile.subscription_end) : null;
    const expired = activeUntil ? activeUntil.getTime() < Date.now() : false;
    const paidPlan =
      !expired &&
      ["pro", "business", "active", "active_pro", "active_business", "trialing"].includes(status);

    if (!paidPlan) {
      throw new Error("AI line-item extraction requires a Pro or Business plan.");
    }

    const payload = await runInference({
      model: "google/gemini-2.5-flash",
      fallbackModel: "meta/llama-3.3-70b-instruct",
      messages: [
        {
          role: "system",
          content:
            "You extract invoice line items from a plain-English job description. Return realistic USD unit prices in cents. Split labor and materials. Be concise: 1–8 items max. Never invent client PII.",
        },
        {
          role: "user",
          content: `Currency: ${data.currency}\n\nJob description:\n${data.description}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_line_items",
            description: "Return the extracted invoice line items",
            parameters: ExtractSchema,
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "return_line_items" } },
    });

    const parsed = readToolArguments<{
      items: Array<{ description: string; quantity: number; rate_cents: number }>;
    }>(payload);
    const items = (parsed.items as Array<{ description: string; quantity: number; rate_cents: number }>).map(
      (it) => ({
        description: String(it.description).slice(0, 500),
        quantity: Number(it.quantity) || 1,
        rate_cents: Math.max(0, Math.round(Number(it.rate_cents) || 0)),
      }),
    );

    return { items };
  });
