import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// MCP server for Honest Invoice. Runs as a stdio process and talks to the
// app's HTTP API (/api/mcp/*) using a Supabase user access token.
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
    throw new Error(`API error (${response.status}): ${detail.slice(0, 300)}`);
  }

  return parsed;
}

const server = new Server(
  {
    name: "honest-invoice-mcp",
    version: "1.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const invoiceLikeSchema = {
  type: "object" as const,
  properties: {
    client_id: { type: "string", description: "Optional client UUID" },
    client_name: { type: "string", description: "Client name if creating new" },
    client_email: { type: "string", description: "Client email if creating new" },
    job_description: { type: "string", description: "Plain English job description" },
    notes: { type: "string", description: "Notes/terms" },
    tax_rate: { type: "number", default: 0 },
    currency: { type: "string", default: "USD" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          rate_cents: { type: "number" },
        },
        required: ["description", "quantity", "rate_cents"],
      },
      minItems: 1,
    },
  },
  required: ["items"],
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_invoice",
        description: "Pro or Business only: create an invoice for the authenticated account",
        inputSchema: invoiceLikeSchema,
      },
      {
        name: "create_estimate",
        description: "Pro or Business only: create an estimate for the authenticated account",
        inputSchema: {
          ...invoiceLikeSchema,
          properties: {
            ...invoiceLikeSchema.properties,
            expiry_date: { type: "string", description: "Expiry date YYYY-MM-DD" },
          },
        },
      },
      {
        name: "list_documents",
        description:
          "Pro or Business only: list invoices and estimates for the authenticated account. Use type=invoice, type=estimate, or type=all.",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["invoice", "estimate"], default: "invoice" },
            status: { type: "string" },
            limit: { type: "number", default: 20 },
            offset: { type: "number", default: 0 },
          },
        },
      },
      {
        name: "update_document",
        description:
          "Pro or Business only: update an invoice or estimate, including line items, for the authenticated account. Agents cannot delete records.",
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
            tax_rate: { type: "number" },
            currency: { type: "string" },
            status: { type: "string" },
            items: { type: "array" },
          },
          required: ["document_id", "document_type"],
        },
      },
      {
        name: "list_clients",
        description: "Pro or Business only: list clients for the authenticated account.",
        inputSchema: {
          type: "object",
          properties: { search: { type: "string" }, limit: { type: "number" } },
        },
      },
      {
        name: "list_leads",
        description: "Pro or Business only: list account-scoped leads and response status.",
        inputSchema: {
          type: "object",
          properties: { status: { type: "string" }, limit: { type: "number" } },
        },
      },
      {
        name: "update_lead_status",
        description:
          "Pro or Business only: mark an account lead response won or lost. Agents cannot delete records.",
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
            limit: { type: "number" },
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
            currency: { type: "string", length: 3, default: "USD" },
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
            tax_rate: { type: "number", default: 0 },
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
            max_per_source: { type: "number", default: 10 },
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
        result = await callAPI("/api/mcp/documents", "POST", { ...args, type: "invoice" });
        break;

      case "create_estimate":
        result = await callAPI("/api/mcp/documents", "POST", { ...args, type: "estimate" });
        break;

      case "list_documents": {
        const a = (args ?? {}) as Record<string, string | number | undefined>;
        const qs = new URLSearchParams();
        if (a.type) qs.set("type", String(a.type));
        if (a.status) qs.set("status", String(a.status));
        if (a.limit) qs.set("limit", String(a.limit));
        if (a.offset) qs.set("offset", String(a.offset));
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        result = await callAPI(`/api/mcp/documents${suffix}`, "GET");
        break;
      }

      case "update_document":
        result = await callAPI("/api/mcp/documents", "PATCH", args);
        break;

      case "list_clients": {
        const a = (args ?? {}) as Record<string, string | number | undefined>;
        const qs = new URLSearchParams();
        if (a.search) qs.set("search", String(a.search));
        if (a.limit) qs.set("limit", String(a.limit));
        result = await callAPI(`/api/mcp/clients${qs.toString() ? `?${qs}` : ""}`, "GET");
        break;
      }

      case "list_leads": {
        const a = (args ?? {}) as Record<string, string | number | undefined>;
        const qs = new URLSearchParams();
        if (a.status) qs.set("status", String(a.status));
        if (a.limit) qs.set("limit", String(a.limit));
        result = await callAPI(`/api/mcp/leads${qs.toString() ? `?${qs}` : ""}`, "GET");
        break;
      }

      case "update_lead_status":
        result = await callAPI("/api/mcp/leads", "PATCH", args);
        break;

      case "get_document_activity": {
        const a = (args ?? {}) as Record<string, string | number | undefined>;
        const qs = new URLSearchParams({
          document_type: String(a.document_type || "invoice"),
          document_id: String(a.document_id || ""),
        });
        if (a.limit) qs.set("limit", String(a.limit));
        result = await callAPI(`/api/mcp/documents/activity?${qs}`, "GET");
        break;
      }

      case "send_document":
        result = await callAPI("/api/mcp/documents/send", "POST", args);
        break;

      case "extract_line_items":
        result = await callAPI("/api/mcp/documents/extract", "POST", args);
        break;

      case "process_lead":
        result = await callAPI("/api/mcp/leads/webhook", "POST", args);
        break;

      case "scrape_leads":
        result = await callAPI("/api/mcp/leads/scrape", "POST", args);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Honest Invoice MCP server running on stdio (HTTP API backend)");
