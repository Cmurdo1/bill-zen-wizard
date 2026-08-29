# Honest Invoice — MCP (Model Context Protocol) Server

This document provides full context for AI agents to interact with the Honest Invoice API via the Model Context Protocol.

## Overview

Honest Invoice (honestinvoice.com) is an invoicing and estimates platform for contractors and freelancers. The MCP server (`src/mcp-server.ts`) exposes tools for AI agents to create, manage, and send invoices and estimates on behalf of users. It runs over **stdio (JSON-RPC 2.0)** and forwards every tool call to the app's REST API (`/api/mcp/*`) with the account's API key.

## Authentication

MCP transports like stdio do **not** carry HTTP headers, so authentication is passed through **environment variables**, not `Authorization` headers.

1. Generate a dedicated, revocable API key in the app: **Settings → AI agent API keys** (Pro or Business plan required). Keys look like `hi_mcp_…` and can be revoked at any time.
2. Put that key in the `env` block of your `mcpServers` config:

```json
{
  "mcpServers": {
    "honest-invoice": {
      "command": "npx",
      "args": ["tsx", "src/mcp-server.ts"],
      "env": {
        "APP_BASE_URL": "https://honestinvoice.com",
        "HONEST_INVOICE_API_KEY": "hi_mcp_YOUR_KEY_HERE"
      }
    }
  }
}
```

The key identifies exactly one account, and the server enforces that account's plan limits (Free accounts cannot use MCP at all). Never share a key across users, and revoke it from Settings if a device is lost.

## Available Tools

Every tool below is gated to the authenticated account's **Pro or Business** plan. Records are **never deleted** — to cancel a document, set its status to `void` via `update_document` or `mark_document_status`.

| Tool | Purpose | Key parameters |
| --- | --- | --- |
| `create_invoice` | Create an invoice with line items | `client_id` \| `client_name`/`client_email`, `job_description`, `due_date`, `tax_rate`, `currency`, `items[]` (`description`, `quantity`, `rate_cents` int) |
| `create_estimate` | Create an estimate with line items | Same as invoice, plus `expiry_date` |
| `list_documents` | List invoices/estimates with filtering + pagination | `type` (`invoice`\|`estimate`\|`all`), `status`, `limit`, `offset` — returns `total` and `has_more` |
| `update_document` | Update fields, line items, or status of an existing document | `document_id`, `document_type`, any editable field, `status`, `items[]` |
| `mark_document_status` | Change a document's status only (e.g. mark paid, void a mistake) | `document_id`, `document_type`, `status` (`draft`\|`sent`\|`paid`\|`overdue`\|`void`\|`accepted`\|`rejected`\|`expired`) |
| `list_clients` | Find existing clients (by name/email) to reuse their `client_id` | `search`, `limit` |
| `list_leads` | List account leads with response status | `status`, `limit` |
| `update_lead_status` | Mark a lead response won or lost | `lead_id`, `status` (`won`\|`lost`) |
| `get_document_activity` | Read audit/activity history for a document | `document_type`, `document_id`, `limit` |
| `send_document` | Email an invoice or estimate | `document_id`, `document_type`, `to_email`, `custom_message` |
| `extract_line_items` | AI line-item extraction from a job description (Pro/Business) | `description` (4–4000 chars), `currency` |
| `process_lead` | Create an estimate for a scraped lead and email it | `title`, `description`, `location`, `contact_email`, `source`, `auto_send` |
| `scrape_leads` | Scrape Craigslist/Nextdoor/Facebook for leads (Business only) | `sources[]`, `cl_city`, `cl_category`, `keywords`, `max_per_source`, `auto_send` |

### Document lifecycle guidance

Agents are iterative: always look up the client first with `list_clients` so you reuse the existing `client_id` instead of duplicating records, and use `update_document` / `mark_document_status` to correct drafts. There is intentionally **no delete tool** — destructive deletes are not exposed to agents; `status = "void"` is the supported way to remove a document from active workflows.

### App URLs

Estimates and invoices share one editor in the web app. When a user asks to open or review a document, give them:

- `{APP_BASE_URL}/documents` — combined list (Estimates/Invoices dropdown)
- `{APP_BASE_URL}/documents/{id}?type=estimate` — estimate editor
- `{APP_BASE_URL}/documents/{id}?type=invoice` — invoice editor

The legacy `/estimates/{id}` and `/invoices/{id}` routes redirect to the corresponding editor above, so any links you may already have issued still work.

### Plan Limits

- **Free**: no MCP access.
- **Pro**: unlimited invoices/estimates, AI extraction, email sending, 2 leads/month.
- **Business**: everything in Pro plus unlimited lead generation and automated lead scraping.

## Error Handling

Per the MCP specification, tool-execution failures are returned as **tool results with `isError: true`** (never as JSON-RPC errors), so the calling model can read the message and correct itself. Each failure message carries a machine-readable `[MCP-<code>]` prefix so clients can still distinguish failure classes programmatically. JSON-RPC errors are reserved for protocol-level failures (e.g. `-32601` for an unknown tool name).

Example failure result:

```json
{
  "content": [{ "type": "text", "text": "[MCP-32003] MCP access requires an active Pro or Business plan." }],
  "isError": true
}
```

| Code | Meaning |
| --- | --- |
| `-32602` | Invalid params — arguments failed strict validation (mirrors the API's Zod schemas; e.g. `rate_cents` must be an integer). |
| `-32601` | Method not found — unknown tool name (JSON-RPC error). |
| `-32603` | Internal server error. |
| `-32001` | Unauthorized — missing/invalid/expired API key. |
| `-32003` | Forbidden / plan limit — e.g. MCP requires an active Pro or Business plan, or a Business-only tool on Pro. |
| `-32004` | Not found — document, client, or lead does not exist for this account. |
| `-32009` | Conflict — e.g. an idempotency-key replay with different input. |
| `-32029` | Rate limited — slow down and retry. |

## Pagination

`list_documents` accepts `limit` (default 20, max 100) and `offset` (default 0), and its response includes:

```json
{
  "documents": [ … ],
  "total": 137,
  "limit": 20,
  "offset": 0,
  "has_more": true
}
```

Keep fetching with increasing `offset` until `has_more` is `false` (e.g. to find an unpaid invoice from last year).

## Usage Example (AI Agent)

```json
{
  "tool": "create_invoice",
  "arguments": {
    "client_name": "Acme Corp",
    "client_email": "billing@acme.com",
    "job_description": "Installed new HVAC system - 3 ton condenser, 4 hours labor, R-410A refrigerant charge, warranty registration",
    "due_date": "2026-09-15",
    "tax_rate": 8.5,
    "items": [
      { "description": "3-ton Condenser Unit", "quantity": 1, "rate_cents": 250000 },
      { "description": "Labor (4 hours)", "quantity": 4, "rate_cents": 12500 },
      { "description": "R-410A Refrigerant", "quantity": 10, "rate_cents": 1500 }
    ]
  }
}
```

## REST API (alternative to MCP)

Prefer the MCP server for agent use; use these endpoints directly from cron jobs or `curl` with the same `hi_mcp_…` key:

- `POST /api/mcp/documents` — create invoice/estimate
- `GET /api/mcp/documents` — list documents (`type`, `status`, `limit`, `offset` → `total`, `has_more`)
- `PATCH /api/mcp/documents` — update a document (fields, items, status)
- `POST /api/mcp/documents/send` — send document
- `POST /api/mcp/documents/extract` — AI extract line items
- `GET /api/mcp/clients` — list/search clients
- `GET /api/mcp/leads` / `PATCH /api/mcp/leads` — list leads / update lead status
- `POST /api/mcp/leads/webhook` — lead webhook (auto-create + send estimate)
- `POST /api/mcp/leads/scrape` — run lead scrapers (Business)

All endpoints require `Authorization: Bearer <hi_mcp_… or Supabase JWT>`.

## Lead Scraping Webhook

To auto-respond to scraped leads from Craigslist, Nextdoor, or Facebook:

```bash
curl -X POST https://honestinvoice.com/api/mcp/leads/webhook \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Need HVAC condenser replaced",
    "description": "3-ton Lennox, 6 hours labor, R-410A refrigerant",
    "location": "Atlanta, GA",
    "contact_email": "customer@example.com",
    "source": "craigslist",
    "tax_rate": 7.25,
    "auto_send": true
  }'
```

The webhook:
1. Records the lead in `job_leads`
2. Uses AI to extract line items (Pro/Business) or creates a placeholder item
3. Creates a professional estimate
4. Emails it to the lead's contact email
5. Records the response in `lead_responses` for tracking

## Rate Limits

- AI extraction: subject to your AI provider's limits (OpenRouter primary, NVIDIA NIM backup)
- Email sending: subject to your email provider's limits (Resend)
- API calls: per-account rate limits (write 60/min, send 10/min, AI 30/min, leads 10/min)

## Stripe Webhook

For payment processing, configure Stripe webhook at:
`https://your-domain/api/public/webhooks/stripe`

Events handled:

- `checkout.session.completed`
- `payment_intent.succeeded`

Include `invoice_id` or `invoice_token` in metadata to auto-mark invoices as paid. (Agents can also mark invoices paid directly via `mark_document_status`.)
