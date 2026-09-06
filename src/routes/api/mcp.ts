import { createFileRoute } from "@tanstack/react-router";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createMcpContext, mcpErrorResponse } from "@/lib/mcp-api-shared";

const TOOL_SCHEMAS = {
  create_invoice: {
    type: "object",
    properties: {
      client_id: { type: "string", description: "Existing client UUID" },
      client_name: { type: "string" },
      client_email: { type: "string" },
      job_description: { type: "string" },
      notes: { type: "string" },
      due_date: { type: "string", description: "Due date YYYY-MM-DD" },
      tax_rate: { type: "number", default: 0 },
      currency: { type: "string", default: "USD" },
      items: { type: "array", items: { $ref: "#/definitions/lineItem" } },
    },
    required: ["items"],
    definitions: {
      lineItem: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          rate_cents: { type: "integer" },
        },
        required: ["description", "quantity", "rate_cents"],
      },
    },
  },
  create_estimate: {
    type: "object",
    properties: {
      client_id: { type: "string" },
      client_name: { type: "string" },
      client_email: { type: "string" },
      job_description: { type: "string" },
      notes: { type: "string" },
      expiry_date: { type: "string", description: "Expiry date YYYY-MM-DD" },
      tax_rate: { type: "number", default: 0 },
      currency: { type: "string", default: "USD" },
      items: { type: "array", items: { $ref: "#/definitions/lineItem" } },
    },
    required: ["items"],
    definitions: {
      lineItem: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          rate_cents: { type: "integer" },
        },
        required: ["description", "quantity", "rate_cents"],
      },
    },
  },
  list_documents: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["invoice", "estimate", "all"], default: "all" },
      status: { type: "string" },
      limit: { type: "integer", default: 20 },
      offset: { type: "integer", default: 0 },
    },
  },
  update_document: {
    type: "object",
    properties: {
      document_id: { type: "string" },
      document_type: { type: "string", enum: ["invoice", "estimate"] },
      client_id: { type: ["string", "null"] },
      issue_date: { type: ["string", "null"] },
      due_date: { type: ["string", "null"] },
      expiry_date: { type: ["string", "null"] },
      job_description: { type: ["string", "null"] },
      notes: { type: ["string", "null"] },
      tax_rate: { type: "number" },
      currency: { type: "string" },
      status: { type: "string" },
      items: { type: "array", items: { type: "object" } },
    },
    required: ["document_id", "document_type"],
  },
  mark_document_status: {
    type: "object",
    properties: {
      document_id: { type: "string" },
      document_type: { type: "string", enum: ["invoice", "estimate"] },
      status: { type: "string" },
    },
    required: ["document_id", "document_type", "status"],
  },
  list_clients: {
    type: "object",
    properties: {
      search: { type: "string" },
      limit: { type: "integer", default: 50 },
    },
  },
  list_leads: {
    type: "object",
    properties: {
      status: { type: "string" },
      limit: { type: "integer", default: 50 },
    },
  },
  update_lead_status: {
    type: "object",
    properties: {
      lead_id: { type: "string" },
      status: { type: "string", enum: ["won", "lost"] },
    },
    required: ["lead_id", "status"],
  },
  get_document_activity: {
    type: "object",
    properties: {
      document_type: { type: "string", enum: ["invoice", "estimate"] },
      document_id: { type: "string" },
      limit: { type: "integer", default: 20 },
    },
    required: ["document_type", "document_id"],
  },
  send_document: {
    type: "object",
    properties: {
      document_id: { type: "string" },
      document_type: { type: "string", enum: ["invoice", "estimate"] },
      to_email: { type: "string" },
      custom_message: { type: "string" },
    },
    required: ["document_id", "document_type", "to_email"],
  },
  extract_line_items: {
    type: "object",
    properties: {
      description: { type: "string", minLength: 4, maxLength: 4000 },
      currency: { type: "string", default: "USD" },
    },
    required: ["description"],
  },
  process_lead: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      location: { type: "string" },
      contact_email: { type: "string" },
      contact_phone: { type: "string" },
      source: { type: "string" },
      tax_rate: { type: "number", default: 0 },
      auto_send: { type: "boolean", default: true },
    },
    required: ["title", "description", "location", "contact_email"],
  },
  scrape_leads: {
    type: "object",
    properties: {
      sources: { type: "array", items: { type: "string" } },
      cl_city: { type: "string", default: "atlanta" },
      cl_category: { type: "string", default: "hva" },
      keywords: { type: "string" },
      max_per_source: { type: "integer", default: 10 },
      auto_send: { type: "boolean", default: true },
    },
    required: ["sources"],
  },
} as const;

type ToolName = keyof typeof TOOL_SCHEMAS;

type ToolResponse = {
  content: [{ type: "text"; text: string }];
  isError?: boolean;
};

const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  create_invoice: "Create an invoice for the authenticated Honest Invoice account.",
  create_estimate: "Create an estimate for the authenticated Honest Invoice account.",
  list_documents: "List account-scoped invoices and estimates.",
  update_document: "Update an account-scoped invoice or estimate.",
  mark_document_status: "Change the status of an account-scoped document.",
  list_clients: "List account-scoped clients.",
  list_leads: "List account-scoped leads.",
  update_lead_status: "Mark an account lead won or lost.",
  get_document_activity: "Read activity for an account-scoped document.",
  send_document: "Email an invoice or estimate from the authenticated account.",
  extract_line_items: "Extract labor and material line items from a job description.",
  process_lead: "Process a lead, create an estimate, and optionally email it.",
  scrape_leads: "Scrape configured lead sources and create estimates. Business plan required.",
};

function toolResult(value: unknown, isError = false): ToolResponse {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

async function callApi(
  request: Request,
  authorization: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<ToolResponse> {
  const response = await fetch(new URL(path, request.url), {
    method,
    headers: {
      Authorization: authorization,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Preserve non-JSON upstream responses as text.
  }
  return toolResult(parsed, !response.ok);
}

function queryString(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

async function executeTool(
  request: Request,
  authorization: string,
  name: ToolName,
  args: Record<string, unknown>,
): Promise<ToolResponse> {
  switch (name) {
    case "create_invoice":
    case "create_estimate":
      return callApi(request, authorization, "/api/mcp/documents", "POST", {
        ...args,
        type: name === "create_invoice" ? "invoice" : "estimate",
      });
    case "list_documents":
      return callApi(request, authorization, `/api/mcp/documents${queryString(args)}`);
    case "update_document":
    case "mark_document_status":
      return callApi(request, authorization, "/api/mcp/documents", "PATCH", args);
    case "list_clients":
    case "list_leads":
      return callApi(
        request,
        authorization,
        `/api/mcp/${name === "list_clients" ? "clients" : "leads"}${queryString(args)}`,
      );
    case "update_lead_status":
      return callApi(request, authorization, "/api/mcp/leads", "PATCH", args);
    case "get_document_activity":
      return callApi(request, authorization, `/api/mcp/documents/activity${queryString(args)}`);
    case "send_document":
      return callApi(request, authorization, "/api/mcp/documents/send", "POST", args);
    case "extract_line_items":
      return callApi(request, authorization, "/api/mcp/documents/extract", "POST", args);
    case "process_lead":
      return callApi(request, authorization, "/api/mcp/leads/webhook", "POST", args);
    case "scrape_leads":
      return callApi(request, authorization, "/api/mcp/leads/scrape", "POST", args);
  }
}

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const requestOrigin = new URL(request.url).origin;
  const configuredOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return origin === requestOrigin || configuredOrigins.includes(origin) ? origin : null;
}

function corsResponse(response: Response, origin: string | null): Response {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id",
  );
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.append("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const originHeader = request.headers.get("Origin");
  const origin = allowedOrigin(request);
  if (originHeader && !origin) {
    return new Response(JSON.stringify({ error: "Origin is not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "OPTIONS") {
    return corsResponse(new Response(null, { status: 204 }), origin);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return corsResponse(
      new Response(
        JSON.stringify({ error: "Authorization: Bearer <dedicated API key> is required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
      origin,
    );
  }

  try {
    // Validate the credential and paid-plan access before accepting any MCP
    // handshake or capability request. Tool calls are authenticated again by
    // the account-scoped REST handlers below.
    await createMcpContext(request);
  } catch (error) {
    return corsResponse(mcpErrorResponse(error), origin);
  }

  const server = new Server(
    {
      name: "honest-invoice-mcp",
      title: "Honest Invoice",
      version: "1.6.0",
    },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: (Object.keys(TOOL_SCHEMAS) as ToolName[]).map((name) => ({
      name,
      description: TOOL_DESCRIPTIONS[name],
      inputSchema: TOOL_SCHEMAS[name],
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (rpcRequest) => {
    const name = rpcRequest.params.name as ToolName;
    if (!(name in TOOL_SCHEMAS)) return toolResult(`Unknown tool: ${name}`, true);
    const args = (rpcRequest.params.arguments ?? {}) as Record<string, unknown>;
    return executeTool(request, authorization, name, args);
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return corsResponse(await transport.handleRequest(request), origin);
  } finally {
    await server.close();
  }
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      GET: ({ request }) => handleMcpRequest(request),
      POST: ({ request }) => handleMcpRequest(request),
      DELETE: ({ request }) => handleMcpRequest(request),
      OPTIONS: ({ request }) => handleMcpRequest(request),
    },
  },
});
