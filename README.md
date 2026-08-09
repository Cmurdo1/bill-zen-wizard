# Invoice AI

AI-powered invoicing and estimating for contractors and freelancers. Generate line items and full estimates from a plain-English job description, collect payment via Stripe payment links, and let AI agents create and send documents on your behalf through MCP.

## Features

- Invoices & estimates with AI line-item extraction from job descriptions
- Clients, rate book, custom branding, and PDF export
- Stripe payment links and subscription billing
- Lead auto-response (Craigslist / Nextdoor / Facebook webhook → estimate + email)
- MCP server for AI agents (Claude, Cursor, etc.)
- Public marketing site, blog, pricing, and pay-invoice portal

## Stack

React 19 · TypeScript · TanStack Start · Tailwind CSS v4 · Supabase (auth + Postgres) · Stripe · Resend · NVIDIA NIM + OpenRouter

## Development

```sh
npm install
npm run dev      # start the dev server
npm run build    # production build
npm run preview  # preview the production build
npm run lint     # run ESLint
```

## Environment variables

Set the required variables in `.env` (or your deployment platform):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (client) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (client) |
| `SUPABASE_URL` | Supabase project URL (server) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `VITE_STRIPE_PAYMENT_LINK_PRO` | Stripe checkout link for the Pro plan |
| `VITE_STRIPE_PAYMENT_LINK_BUSINESS` | Stripe checkout link for the Business plan |
| `RESEND_API_KEY` | Transactional email (Resend) |
| `NVIDIA_API_KEY` | AI line-item extraction (primary provider) |
| `OPENROUTER_API_KEY` | AI line-item extraction (fallback provider) |
| `HONEST_INVOICE_API_KEY` | Dedicated API key for MCP server access |
| `APP_BASE_URL` | Deployed app URL |

## MCP / AI agent access

See [MCP_CONTEXT.md](./MCP_CONTEXT.md) for connecting Claude, Cursor, or any MCP-compatible agent to your account, plus the lead-scraping webhook and available endpoints.
