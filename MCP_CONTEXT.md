# Honest Invoice - MCP (Model Context Protocol) Server

This document provides full context for AI agents to interact with the Honest Invoice API via the Model Context Protocol.

## Overview

Honest Invoice (honestinvoice.com) is an invoicing and estimates platform for contractors and freelancers. The MCP server exposes tools for AI agents to create, manage, and send invoices and estimates on behalf of users.

## Authentication

All MCP tools require the user to be authenticated via Supabase. The MCP server runs with the user's credentials and respects their plan limits.

## Available Tools

### 1. `create_invoice`

Create a new invoice with line items.

**Parameters:**

- `client_id` (string, optional): Existing client UUID
- `client_name` (string, optional): Client name if creating new
- `client_email` (string, optional): Client email if creating new
- `job_description` (string, optional): Plain English job description for AI extraction
- `notes` (string, optional): Notes/terms
- `due_date` (string, optional): Due date in YYYY-MM-DD format
- `tax_rate` (number, default: 0): Tax rate percentage
- `currency` (string, default: "USD"): 3-letter currency code
- `items` (array, required): Array of line items
  - `description` (string, required): Item description
  - `quantity` (number, required): Quantity
  - `rate_cents` (number, required): Unit price in cents

**Plan Limits:**

- Free: 5 invoices/month, no AI extraction
- Pro: Unlimited invoices, AI extraction enabled
- Business: Unlimited invoices, AI extraction enabled

**Returns:** Created invoice with document number (e.g., "INV-1001") and items.

### 2. `create_estimate`

Create a new estimate with line items.

**Parameters:** Same as `create_invoice` but with:

- `expiry_date` (string, optional): Expiry date in YYYY-MM-DD format (instead of due_date)
- Document number format: "EST-1001"

### 3. `list_documents`

List invoices and estimates with filtering.

**Parameters:**

- `type` (string, enum: "invoice" | "estimate" | "all", default: "all")
- `status` (string, optional): Filter by status (draft, sent, paid, overdue, etc.)
- `limit` (number, default: 20, max: 100)
- `offset` (number, default: 0)

**Returns:** Paginated list of documents with client and item details.

### 4. `send_document`

Send an invoice or estimate via email.

**Parameters:**

- `document_id` (string, required): UUID of the document
- `document_type` (string, required): "invoice" or "estimate"
- `to_email` (string, required): Recipient email
- `custom_message` (string, optional): Custom message to include

**Returns:** Success confirmation, document status updated to "sent".

### 5. `extract_line_items`

Use AI to extract line items from a job description (Pro/Business only).

**Parameters:**

- `description` (string, required): Plain English job description (4-4000 chars)
- `currency` (string, default: "USD"): 3-letter currency code

**Plan Limits:**

- Free: Not available
- Pro: Available
- Business: Available

**Returns:** Array of extracted line items with descriptions, quantities, and rates in cents.

### 6. `process_lead`

Process a scraped lead from Craigslist, Nextdoor, or Facebook — auto-creates an AI-extracted estimate and emails it to the lead. Be the first response and win the job.

**Parameters:**

- `title` (string, required): Lead title (e.g., "Need HVAC condenser replaced")
- `description` (string, required): Full job description from the lead post
- `location` (string, required): Location of the job
- `contact_email` (string, required): Lead contact email
- `contact_phone` (string, optional): Optional phone number
- `budget_range` (string, optional): Budget range (e.g., "2000-4000")
- `source` (string, default: "manual"): One of "craigslist", "nextdoor", "facebook", "manual"
- `client_name` (string, optional): Client name (falls back to email prefix)
- `tax_rate` (number, default: 0): Tax rate percentage
- `auto_send` (boolean, default: true): Auto-email the estimate to the lead

**Plan Limits:**

- Free: Creates estimate with a single placeholder item (no AI extraction)
- Pro: Full AI line-item extraction, estimate auto-sent via email
- Business: Full AI extraction, auto-send, plus lead response tracking

**Returns:** Created estimate with document number, items, and email send status.

**Webhook API:** Also available as a REST endpoint at `POST /api/mcp/leads/webhook` with the same payload. Use this to connect external scraping services or cron jobs.

## Plan Features

| Feature                 | Free      | Pro       | Business  |
| ----------------------- | --------- | --------- | --------- |
| Invoices/month          | 5         | Unlimited | Unlimited |
| Estimates/month         | Unlimited | Unlimited | Unlimited |
| AI line-item extraction | ❌        | ✅        | ✅        |
| PDF export              | ❌        | ✅        | ✅        |
| Email sending           | ❌        | ✅        | ✅        |
| Payment links           | ❌        | ✅        | ✅        |
| Lead gen                | ❌        | ✅        | ✅        |
| Regional pricing        | ❌        | ✅        | ✅        |

## Error Handling

All tools return structured errors:

- `401`: Unauthorized (invalid/missing auth)
- `403`: Plan limit exceeded
- `400`: Invalid input (Zod validation errors)
- `500`: Server error

## Usage Example (AI Agent)

```json
{
  "tool": "create_invoice",
  "arguments": {
    "client_name": "Acme Corp",
    "client_email": "billing@acme.com",
    "job_description": "Installed new HVAC system - 3 ton condenser, 4 hours labor, R-410A refrigerant charge, warranty registration",
    "due_date": "2024-02-15",
    "tax_rate": 8.5,
    "items": [
      { "description": "3-ton Condenser Unit", "quantity": 1, "rate_cents": 250000 },
      { "description": "Labor (4 hours)", "quantity": 4, "rate_cents": 12500 },
      { "description": "R-410A Refrigerant", "quantity": 10, "rate_cents": 1500 }
    ]
  }
}
```

## MCP Server Configuration

To connect an AI agent (Claude, Cursor, etc.) to this MCP server:

```json
{
  "mcpServers": {
    "honest-invoice": {
      "command": "npx",
      "args": ["tsx", "src/mcp-server.ts"],
      "env": {
        "VITE_SUPABASE_URL": "https://your-project.supabase.co",
        "VITE_SUPABASE_PUBLISHABLE_KEY": "your-anon-key"
      }
    }
  }
}
```

Or use the HTTP API directly via the `/api/mcp/documents` endpoint.

## API Endpoints

- `POST /api/mcp/documents` - Create invoice/estimate
- `GET /api/mcp/documents` - List documents
- `POST /api/mcp/documents/send` - Send document
- `POST /api/mcp/documents/extract` - AI extract line items
- `POST /api/mcp/leads/webhook` - Lead scraping webhook (auto-create + send estimate)

All endpoints require `Authorization: Bearer <supabase-jwt>` header.

## Lead Scraping Webhook

To auto-respond to scraped leads from Craigslist, Nextdoor, or Facebook:

```bash
curl -X POST https://honestinvoice.com/api/mcp/leads/webhook \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
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
2. Uses AI to extract line items (Pro/Business) or creates a placeholder item (Free)
3. Creates a professional estimate
4. Emails it to the lead's contact email
5. Records the response in `lead_responses` for tracking

On the Business plan, scraping services can POST leads in real-time for instant auto-response — your AI agent is always first to reply, giving you the best shot at winning the job.

## Rate Limits

- AI extraction: subject to your AI provider's limits (OpenRouter primary, NVIDIA NIM backup)
- Email sending: subject to your email provider's limits (Resend)
- Standard API: No explicit limits (respect Supabase limits)

## Webhook Events

For payment processing, configure Stripe webhook at:
`https://your-domain/api/public/webhooks/stripe`

Events handled:

- `checkout.session.completed`
- `payment_intent.succeeded`

Include `invoice_id` or `invoice_token` in metadata to auto-mark invoices as paid.
