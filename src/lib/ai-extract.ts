import { ESTIMATOR_SYSTEM_PROMPT, formatRateBook, type PricingRule } from "@/lib/estimate-ai";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const NIM_URL = process.env.NVIDIA_BASE_URL?.replace(/\/$/, "") || "https://integrate.api.nvidia.com/v1";

type ImageBlock = { type: "image_url"; image_url: { url: string } };

export type ExtractedItem = {
  description: string;
  quantity: number;
  unit: string;
  rate_cents: number;
  basis: string;
};

export type ExtractResult = {
  items: ExtractedItem[];
  measurements: Array<{ label: string; value: string; confidence: string }>;
  assumptions: string[];
};

export const ExtractSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string", description: "sq ft, linear ft, hour, each, gallon, etc." },
          rate_cents: { type: "integer", description: "Unit price in the smallest currency unit (cents)" },
          basis: { type: "string", description: "How the quantity and price were derived" },
        },
        required: ["description", "quantity", "unit", "rate_cents", "basis"],
        additionalProperties: false,
      },
    },
    measurements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["label", "value", "confidence"],
        additionalProperties: false,
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
  },
  required: ["items", "measurements", "assumptions"],
  additionalProperties: false,
} as const;

function buildRequestBody(args: {
  userText: string;
  imageBlocks: ImageBlock[];
}) {
  return {
    temperature: 0,
    top_p: 0.1,
    seed: 7,
    max_tokens: 8192,
    messages: [
      { role: "system", content: ESTIMATOR_SYSTEM_PROMPT },
      { role: "user", content: [{ type: "text", text: args.userText }, ...args.imageBlocks] },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "return_estimate",
          description: "Return the itemized estimate with measurements and assumptions",
          parameters: ExtractSchema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "return_estimate" } },
  };
}

async function callProvider(url: string, apiKey: string, model: string, body: unknown): Promise<ExtractResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ ...(body as object), model }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 429) throw new Error("AI is busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI request failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const payload = await res.json();
  const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("AI returned no estimate");

  const parsed = JSON.parse(call.function.arguments) as {
    items: ExtractedItem[];
    measurements: Array<{ label: string; value: string; confidence: string }>;
    assumptions: string[];
  };

  return {
    items: (parsed.items ?? []).map((it) => ({
      description: String(it.description).slice(0, 400),
      quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
      unit: String(it.unit ?? "").slice(0, 30),
      rate_cents: Math.max(0, Math.round(Number(it.rate_cents) || 0)),
      basis: String(it.basis ?? "").slice(0, 300),
    })),
    measurements: parsed.measurements ?? [],
    assumptions: parsed.assumptions ?? [],
  };
}

/**
 * Extract line items from a job description (and optional photos) using AI.
 *
 * Primary provider: OpenRouter (default model "openrouter/free", which routes
 * to available free models)
 * Fallback provider: NVIDIA NIM (meta/llama-3.3-70b-instruct) when the primary
 * call fails or OPENROUTER_API_KEY is missing.
 */
// OpenRouter's "free" router — auto-cycles through available free models.
// Used as the default primary model; NVIDIA NIM is the backup provider.
const OPENROUTER_FREE_MODEL = "openrouter/free";

export async function extractLineItemsWithAI(input: {
  description: string;
  currency?: string;
  rules?: PricingRule[];
  imageBlocks?: ImageBlock[];
}): Promise<ExtractResult> {
  const { description, currency = "USD", rules = [], imageBlocks = [] } = input;

  const userText = [
    `Currency: ${currency}`,
    "",
    "Contractor rate book (authoritative pricing):",
    formatRateBook(rules, currency),
    "",
    "Job description from the contractor:",
    description,
    "",
    imageBlocks.length
      ? `Photos attached: ${imageBlocks.length}.`
      : "No photos attached — estimate from the description only and note the reduced confidence.",
  ].join("\n");

  const body = buildRequestBody({ userText, imageBlocks });

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const nimKey = process.env.NVIDIA_API_KEY;
  const nimModel = process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct";

  // Provider attempts in order: configured OpenRouter model, OpenRouter free
  // router, then NVIDIA NIM (backup provider).
  const attempts: Array<{ url: string; key: string; model: string }> = [];
  if (openRouterKey) {
    const configured = process.env.OPENROUTER_MODEL;
    if (configured && configured !== OPENROUTER_FREE_MODEL) {
      attempts.push({ url: OPENROUTER_URL, key: openRouterKey, model: configured });
    }
    attempts.push({ url: OPENROUTER_URL, key: openRouterKey, model: OPENROUTER_FREE_MODEL });
  }
  if (nimKey) {
    attempts.push({ url: `${NIM_URL}/chat/completions`, key: nimKey, model: nimModel });
  }

  if (!attempts.length) {
    throw new Error("Missing OPENROUTER_API_KEY (and no NVIDIA_API_KEY fallback configured)");
  }

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await callProvider(attempt.url, attempt.key, attempt.model, body);
    } catch (err) {
      lastError = err;
      console.error(
        `[ai-extract] provider failed (${attempt.model}): ${(err as Error).message}`,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All AI providers failed");
}
