/**
 * Inference layer for the app.
 *
 * Primary provider: OpenRouter (OPENROUTER_API_KEY)
 * Fallback provider: NVIDIA NIM (NVIDIA_API_KEY)
 *
 * Both expose an OpenAI-compatible /chat/completions endpoint, so one request
 * body works for either. Keys are read inside the call, never at module scope.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

export type ToolSpec = {
  type: "function";
  function: { name: string; description?: string; parameters: unknown };
};

export type InferenceRequest = {
  /** OpenRouter model id, e.g. "google/gemini-2.5-pro". */
  model: string;
  /** NVIDIA NIM model id used when OpenRouter is unavailable. */
  fallbackModel?: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  toolChoice?: { type: "function"; function: { name: string } };
  temperature?: number;
  topP?: number;
  seed?: number;
  /** Set when the request contains images — the fallback must also be multimodal. */
  requiresVision?: boolean;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

function buildBody(req: InferenceRequest, model: string) {
  return JSON.stringify({
    model,
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.topP !== undefined ? { top_p: req.topP } : {}),
    ...(req.seed !== undefined ? { seed: req.seed } : {}),
    messages: req.messages,
    ...(req.tools ? { tools: req.tools } : {}),
    ...(req.toolChoice ? { tool_choice: req.toolChoice } : {}),
  });
}

type Completion = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
    };
  }>;
};

async function callProvider(url: string, apiKey: string, body: string, extraHeaders: Record<string, string> = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body,
  });
}

/**
 * Runs a chat completion against OpenRouter, falling back to NVIDIA NIM when
 * OpenRouter is unconfigured, rate limited, or erroring.
 */
export async function runInference(req: InferenceRequest): Promise<Completion> {
  const openRouterKey = process.env["OPENROUTER_API_KEY"];
  const nvidiaKey = process.env["NVIDIA_API_KEY"];

  if (!openRouterKey && !nvidiaKey) {
    throw new Error("No inference provider configured. Add OPENROUTER_API_KEY (or NVIDIA_API_KEY).");
  }

  let lastError = "";

  if (openRouterKey) {
    const res = await callProvider(OPENROUTER_URL, openRouterKey, buildBody(req, req.model), {
      "HTTP-Referer": "https://honestinvoice.com",
      "X-Title": "Honest Invoice",
    });
    if (res.ok) return (await res.json()) as Completion;
    lastError = `OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (res.status === 402) throw new Error("AI credits exhausted on your OpenRouter account.");
  }

  const fallbackModel = req.fallbackModel;
  if (nvidiaKey && fallbackModel && !(req.requiresVision && !fallbackModel.includes("vl"))) {
    const res = await callProvider(NVIDIA_URL, nvidiaKey, buildBody(req, fallbackModel));
    if (res.ok) return (await res.json()) as Completion;
    lastError = `${lastError} | NVIDIA ${res.status}: ${(await res.text()).slice(0, 300)}`;
  }

  throw new Error(`AI request failed. ${lastError || "No provider available."}`);
}

/** Extracts the JSON arguments of the first tool call in a completion. */
export function readToolArguments<T>(payload: Completion): T {
  const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
  if (call?.function?.arguments) return JSON.parse(call.function.arguments) as T;

  // Some models answer with raw JSON text instead of a tool call.
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text === "string") {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
  }
  throw new Error("AI returned no structured result");
}
