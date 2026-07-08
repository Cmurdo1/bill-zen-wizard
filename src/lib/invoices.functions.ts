import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
        tool_choice: { type: "function", function: { name: "return_line_items" } },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI is busy right now — please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const payload = await res.json();
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI returned no line items");

    const parsed = JSON.parse(call.function.arguments);
    const items = (parsed.items as Array<{ description: string; quantity: number; rate_cents: number }>).map(
      (it) => ({
        description: String(it.description).slice(0, 500),
        quantity: Number(it.quantity) || 1,
        rate_cents: Math.max(0, Math.round(Number(it.rate_cents) || 0)),
      }),
    );

    return { items };
  });
