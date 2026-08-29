import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// MCP server for Honest Invoice. Runs as a stdio process (JSON-RPC) and talks
// to the app's HTTP API (/api/mcp/*) using a dedicated, revocable API key.
//
// stdio transports carry no HTTP headers, so authentication is passed through
// environment variables — create a key in Settings → "AI agent API keys" and
// put it in the `env` block of your mcpServers config (see MCP_CONTEXT.md).
//
// Required env vars:
//   HONEST_INVOICE_API_KEY - a dedicated, revocable API key for one account
//   APP_BASE_URL           - the app origin (default: https://honestinvoice.com)
const APP_BASE_URL = (process.env.APP_BASE_URL || "https://honestinvoice.com").replace(/\/+$/, "");
const ACCESS_TOKEN = process.env.HONEST_INVOICE_API_KEY;

if (!ACCESS_TOKEN) {
  console.error(
    "Error: HONEST_INVOICE_API_KEY is required. Create a dedicated API key in Honest Invoice settings.",
  );
  process.exit(1);
}

/** Error thrown for upstream HTTP failures; carries the HTTP status so it can
 *  be mapped onto a machine-readable MCP error code. */
class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Error thrown when tool arguments fail local Zod validation. */
class ToolInputError extends Error {}

/**
 * Map upstream HTTP statuses to MCP error codes.
 * Protocol errors (-32600..-32603) are reserved for MCP itself; application
 * errors live in the server-defined range -32000..-32099. Codes are embedded
 * in isError tool results as [MCP-<code>] so the taxonomy survives the
 * spec-compliant (isError) failure pattern.
 */
function httpStatusToMcpCode(status: number): number {
  switch (status) {
    case 400:
      return ErrorCode.InvalidParams; // -32602 (bad arguments)
    case 401:
      return -32001; // Unauthorized
    case 403:
      return -32003; // Forbidden / plan limit
    case 404:
      return -32004; // Not found
    case 409:
      return -32009; // Conflict (e.g. idempotency replay)
    case 429:
      return -32029; // Rate limited
    default:
      return ErrorCode.InternalError; // -32603 (5xx and anything else)
  }
}

async function callAPI(path: string, method: string = "GET", body?: unknown) {
  const response = await fetch(`${APP_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep raw text
  }

  if (!response.ok) {
    const detail =
      typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : text;
    throw new ApiError(
      response.status,
      detail.slice(0, 300) || `Request failed (${response.status})`,
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Strict input schemas (mirror the API's Zod validation so bad arguments are
// rejected locally with a -32602 instead of round-tripping to the backend).
// ---------------------------------------------------------------------------

const itemZod = z.object({
  description: z.string().trim().min(1).max(1000),
  quantity: z.number().positive().max(1_000_000),
  rate_cents: z.number().int().nonnegative().max(1_000_000_000),
});
const itemsZod = z.array(itemZod).min(1).max(100);

const invoiceLikeZod = z.object({
  client_id: z.string().uuid().optional().nullable(),
  client_name: z.string().trim().max(200).optional().nullable(),
  client_email: z.string().trim().email().max(255).optional().nullable(),
  job_description: z.string().trim().max(10_000).optional().nullable(),
  notes: z.string().trim().max(10_000).optional().nullable(),
  due_date: z.string().max(30).optional().nullable(),
  expiry_date: z.string().max(30).optional().nullable(),
  tax_rate: z.number().min(0).max(100).default(0),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase())
    .default("USD"),
  items: itemsZod,
});

const DOCUMENT_STATUSES = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
  "accepted",
  "rejected",
  "expired",
] as const;

const listDocumentsZod = z.object({
  type: z.enum(["invoice", "estimate", "all"]).default("all"),
  status: z.string().trim().max(30).optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().max(10_000).default(0),
});

const updateDocumentZod = z.object({
  document_id: z.string().uuid(),
  document_type: z.enum(["invoice", "estimate"]),
  client_id: z.string().uuid().nullable().optional(),
  issue_date: z.string().max(30).optional().nullable(),
  due_date: z.string().max(30).optional().nullable(),
  expiry_date: z.string().max(30).optional().nullable(),
  job_description: z.string().trim().max(10_000).optional().nullable(),
  notes: z.string().trim().max(10_000).optional().nullable(),
  tax_rate: z.number().min(0).max(100).optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  items: itemsZod.optional(),
});

const markDocumentStatusZod = z.object({
  document_id: z.string().uuid(),
  document_type: z.enum(["invoice", "estimate"]),
  status: z.enum(DOCUMENT_STATUSES),
});

const sendDocumentZod = z.object({
  document_id: z.string().uuid(),
  document_type: z.enum(["invoice", "estimate"]),
  to_email: z.string().trim().email().max(255),
  custom_message: z.string().trim().max(10_000).optional(),
});

const extractLineItemsZod = z.object({
  description: z.string().trim().min(4).max(4000),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase())
    .default("USD"),
});

const listClientsZod = z.object({
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const listLeadsZod = z.object({
  status: z.string().trim().max(30).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const updateLeadStatusZod = z.object({
  lead_id: z.string().uuid(),
  status: z.enum(["won", "lost"]),
});

const getDocumentActivityZod = z.object({
  document_type: z.enum(["invoice", "estimate"]),
  document_id: z.string().uuid(),
  limit: z.number().int().positive().max(100).optional(),
});

const processLeadZod = z.object({
  title: z.string().min(3).max(500),
  description: z.string().min(10).max(5000),
  location: z.string().min(1).max(200),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  budget_range: z.string().optional(),
  source: z.enum(["craigslist", "nextdoor", "facebook", "manual"]).default("manual"),
  client_name: z.string().optional(),
  tax_rate: z.number().min(0).max(100).default(0),
  auto_send: z.boolean().default(true),
});

const scrapeLeadsZod = z.object({
  sources: z
    .array(z.enum(["craigslist", "nextdoor", "facebook"]))
    .min(1)
    .default(["craigslist"]),
  cl_city: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,40}$/i)
    .default("atlanta"),
  cl_category: z.enum(["hva", "egr", "bbb", "skl", "lbs", "hss", "trd"]).default("hva"),
  keywords: z.string().optional(),
  max_per_source: z.number().int().min(1).max(50).default(10),
  auto_send: z.boolean().default(true),
});

/** Validate tool arguments; failures become isError tool results (-32602). */
function parseArgs<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  toolName: string,
  args: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(args ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path?.length ? ` at '${issue.path.join(".")}'` : "";
    const message = `${toolName}: ${issue?.message ?? "invalid arguments"}${where}.`;
    throw new ToolInputError(message);
  }
  return result.data;
}

/**
 * Build a spec-compliant tool failure result. Per the MCP specification,
 * tool-execution errors are returned as tool results with isError: true (so
 * the calling model can read the message and self-correct) rather than as
 * JSON-RPC errors, which are reserved for protocol-level failures.
 * The [MCP-<code>] prefix keeps the error taxonomy (see MCP_CONTEXT.md) so
 * clients can still distinguish validation, auth, plan-limit, and rate-limit
 * failures programmatically.
 */
function toolErrorResult(code: number, message: string) {
  return {
    content: [{ type: "text" as const, text: `[MCP-${Math.abs(code)}] ${message}` }],
    isError: true,
  };
}

const server = new Server(
  {
    name: "honest-invoice-mcp",
    title: "Honest Invoice",
    version: "1.5.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// JSON Schema definitions advertised in tools/list. Kept strict so the model
// formats arguments correctly: rate_cents is an integer, items is an array of
// objects with required fields, and enums constrain free-form strings.
const invoiceLikeSchema = {
  type: "object" as const,
  properties: {
    client_id: {
      type: "string",
      description: "Existing client UUID (look it up with list_clients)",
    },
    client_name: { type: "string", description: "Client name if creating a new client" },
    client_email: { type: "string", description: "Client email if creating a new client" },
    job_description: { type: "string", description: "Plain English job description" },
    notes: { type: "string", description: "Notes/terms" },
    due_date: { type: "string", description: "Due date YYYY-MM-DD" },
    expiry_date: { type: "string", description: "Expiry date YYYY-MM-DD (estimates)" },
    tax_rate: {
      type: "number",
      description: "Tax rate percentage",
      default: 0,
      minimum: 0,
      maximum: 100,
    },
    currency: { type: "string", description: "3-letter currency code", default: "USD" },
    items: {
      type: "array",
      description: "Line items",
      items: {
        type: "object",
        properties: {
          description: { type: "string", description: "Item description" },
          quantity: { type: "number", description: "Quantity (may be fractional, e.g. 4.5 hours)" },
          rate_cents: { type: "integer", description: "Unit price in cents" },
        },
        required: ["description", "quantity", "rate_cents"],
      },
      minItems: 1,
      maxItems: 100,
    },
  },
  required: ["items"],
};

const itemListJsonSchema = {
  type: "array",
  description: "Line items",
  items: {
    type: "object",
    properties: {
      description: { type: "string" },
      quantity: { type: "number" },
      rate_cents: { type: "integer", description: "Unit price in cents" },
    },
    required: ["description", "quantity", "rate_cents"],
  },
  minItems: 1,
  maxItems: 100,
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_invoice",
        description:
          "Pro or Business only: create an invoice for the authenticated account. Use list_clients first to reuse an existing client_id.",
        inputSchema: invoiceLikeSchema,
      },
      {
        name: "create_estimate",
        description:
          "Pro or Business only: create an estimate for the authenticated account. Use list_clients first to reuse an existing client_id.",
        inputSchema: {
          ...invoiceLikeSchema,
          properties: {
            ...invoiceLikeSchema.properties,
            due_date: {
              type: "string",
              description: "Due date YYYY-MM-DD (estimates use expiry_date)",
            },
          },
        },
      },
      {
        name: "list_documents",
        description:
          "Pro or Business only: list invoices and estimates for the authenticated account. Responses include total and has_more so you can paginate with offset until has_more is false.",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["invoice", "estimate", "all"], default: "all" },
            status: {
              type: "string",
              description:
                "Filter by status (draft, sent, paid, overdue, void, accepted, rejected, expired)",
            },
            limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
            offset: { type: "integer", default: 0, minimum: 0 },
          },
        },
      },
      {
        name: "update_document",
        description:
          "Pro or Business only: update an invoice or estimate — fields, line items, or status — for the authenticated account. Records cannot be deleted; set status to 'void' to cancel one.",
        inputSchema: {
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
            tax_rate: { type: "number", minimum: 0, maximum: 100 },
            currency: { type: "string" },
            status: {
              type: "string",
              enum: [...DOCUMENT_STATUSES],
              description: "New status",
            },
            items: itemListJsonSchema,
          },
          required: ["document_id", "document_type"],
        },
      },
      {
        name: "mark_document_status",
        description:
          "Pro or Business only: change a document's status (e.g. mark an invoice paid or void a mistaken estimate). Use 'void' instead of deleting — records are never deleted.",
        inputSchema: {
          type: "object",
          properties: {
            document_id: { type: "string" },
            document_type: { type: "string", enum: ["invoice", "estimate"] },
            status: {
              type: "string",
              enum: [...DOCUMENT_STATUSES],
              description: "New status",
            },
          },
          required: ["document_id", "document_type", "status"],
        },
      },
      {
        name: "list_clients",
        description:
          "Pro or Business only: list clients for the authenticated account. Pass search to find a client by name or email so you can reuse its client_id on new documents.",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Substring match on client name or email" },
            limit: { type: "integer", default: 50, minimum: 1, maximum: 100 },
          },
        },
      },
      {
        name: "list_leads",
        description: "Pro or Business only: list account-scoped leads and response status.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by response status" },
            limit: { type: "integer", default: 50, minimum: 1, maximum: 100 },
          },
        },
      },
      {
        name: "update_lead_status",
        description:
          "Pro or Business only: mark an account lead response won or lost. Records cannot be deleted.",
        inputSchema: {
          type: "object",
          properties: {
            lead_id: { type: "string" },
            status: { type: "string", enum: ["won", "lost"] },
          },
          required: ["lead_id", "status"],
        },
      },
      {
        name: "get_document_activity",
        description: "Pro or Business only: read activity for an account document.",
        inputSchema: {
          type: "object",
          properties: {
            document_type: { type: "string", enum: ["invoice", "estimate"] },
            document_id: { type: "string" },
            limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          },
          required: ["document_type", "document_id"],
        },
      },
      {
        name: "send_document",
        description:
          "Pro or Business only: send an invoice or estimate from the authenticated account",
        inputSchema: {
          type: "object",
          properties: {
            document_id: { type: "string" },
            document_type: { type: "string", enum: ["invoice", "estimate"] },
            to_email: { type: "string" },
            custom_message: { type: "string" },
          },
          required: ["document_id", "document_type", "to_email"],
        },
      },
      {
        name: "extract_line_items",
        description: "Use AI to extract line items from a job description (Pro/Business only)",
        inputSchema: {
          type: "object",
          properties: {
            description: { type: "string", minLength: 4, maxLength: 4000 },
            currency: { type: "string", default: "USD" },
          },
          required: ["description"],
        },
      },
      {
        name: "process_lead",
        description:
          "Pro or Business only: process a lead, create an estimate for the authenticated account, and email it to the lead.",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Lead title (e.g. 'Need HVAC condenser replaced')",
            },
            description: { type: "string", description: "Full job description from the lead post" },
            location: { type: "string", description: "Location of the job" },
            contact_email: { type: "string", description: "Lead contact email" },
            contact_phone: { type: "string", description: "Optional phone number" },
            budget_range: {
              type: "string",
              description: "Optional budget range (e.g. '2000-4000')",
            },
            source: {
              type: "string",
              enum: ["craigslist", "nextdoor", "facebook", "manual"],
              default: "manual",
            },
            client_name: { type: "string", description: "Optional client name" },
            tax_rate: { type: "number", default: 0, minimum: 0, maximum: 100 },
            auto_send: {
              type: "boolean",
              default: true,
              description: "Auto-email the estimate to the lead",
            },
          },
          required: ["title", "description", "location", "contact_email"],
        },
      },
      {
        name: "scrape_leads",
        description:
          "Scrape Craigslist, Nextdoor, or Facebook for new job leads and auto-create estimates with AI. Business plan required.",
        inputSchema: {
          type: "object",
          properties: {
            sources: {
              type: "array",
              items: { type: "string", enum: ["craigslist", "nextdoor", "facebook"] },
              description: "Sources to scrape",
              minItems: 1,
            },
            cl_city: {
              type: "string",
              default: "atlanta",
              description: "Craigslist city subdomain",
            },
            cl_category: {
              type: "string",
              default: "hva",
              description: "Category code: hva=HVAC, egr=electrical, skl=trades, bbb=construction",
            },
            keywords: { type: "string", description: "Comma-separated search keywords" },
            max_per_source: { type: "integer", default: 10, minimum: 1, maximum: 50 },
            auto_send: {
              type: "boolean",
              default: true,
              description: "Auto-email estimates to leads",
            },
          },
          required: ["sources"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;
    switch (name) {
      case "create_invoice":
        result = await callAPI("/api/mcp/documents", "POST", {
          ...parseArgs(invoiceLikeZod, name, args),
          type: "invoice",
        });
        break;

      case "create_estimate":
        result = await callAPI("/api/mcp/documents", "POST", {
          ...parseArgs(invoiceLikeZod, name, args),
          type: "estimate",
        });
        break;

      case "list_documents": {
        const a = parseArgs(listDocumentsZod, name, args);
        const qs = new URLSearchParams();
        qs.set("type", a.type);
        if (a.status) qs.set("status", a.status);
        qs.set("limit", String(a.limit));
        qs.set("offset", String(a.offset));
        result = await callAPI(`/api/mcp/documents?${qs.toString()}`, "GET");
        break;
      }

      case "update_document":
        result = await callAPI(
          "/api/mcp/documents",
          "PATCH",
          parseArgs(updateDocumentZod, name, args),
        );
        break;

      case "mark_document_status":
        result = await callAPI(
          "/api/mcp/documents",
          "PATCH",
          parseArgs(markDocumentStatusZod, name, args),
        );
        break;

      case "list_clients": {
        const a = parseArgs(listClientsZod, name, args);
        const qs = new URLSearchParams();
        if (a.search) qs.set("search", a.search);
        if (a.limit) qs.set("limit", String(a.limit));
        result = await callAPI(`/api/mcp/clients${qs.toString() ? `?${qs}` : ""}`, "GET");
        break;
      }

      case "list_leads": {
        const a = parseArgs(listLeadsZod, name, args);
        const qs = new URLSearchParams();
        if (a.status) qs.set("status", a.status);
        if (a.limit) qs.set("limit", String(a.limit));
        result = await callAPI(`/api/mcp/leads${qs.toString() ? `?${qs}` : ""}`, "GET");
        break;
      }

      case "update_lead_status":
        result = await callAPI(
          "/api/mcp/leads",
          "PATCH",
          parseArgs(updateLeadStatusZod, name, args),
        );
        break;

      case "get_document_activity": {
        const a = parseArgs(getDocumentActivityZod, name, args);
        const qs = new URLSearchParams({
          document_type: a.document_type,
          document_id: a.document_id,
        });
        if (a.limit) qs.set("limit", String(a.limit));
        result = await callAPI(`/api/mcp/documents/activity?${qs}`, "GET");
        break;
      }

      case "send_document":
        result = await callAPI(
          "/api/mcp/documents/send",
          "POST",
          parseArgs(sendDocumentZod, name, args),
        );
        break;

      case "extract_line_items":
        result = await callAPI(
          "/api/mcp/documents/extract",
          "POST",
          parseArgs(extractLineItemsZod, name, args),
        );
        break;

      case "process_lead":
        result = await callAPI(
          "/api/mcp/leads/webhook",
          "POST",
          parseArgs(processLeadZod, name, args),
        );
        break;

      case "scrape_leads":
        result = await callAPI(
          "/api/mcp/leads/scrape",
          "POST",
          parseArgs(scrapeLeadsZod, name, args),
        );
        break;

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (error) {
    // Protocol-level failures (unknown tool name) are JSON-RPC errors.
    if (error instanceof McpError) throw error;
    // Tool-level failures follow the MCP spec: return an isError tool result.
    if (error instanceof ToolInputError) {
      return toolErrorResult(ErrorCode.InvalidParams, error.message);
    }
    if (error instanceof ApiError) {
      return toolErrorResult(httpStatusToMcpCode(error.status), error.message);
    }
    return toolErrorResult(
      ErrorCode.InternalError,
      error instanceof Error ? error.message : String(error),
    );
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Honest Invoice MCP server running on stdio (HTTP API backend)");
