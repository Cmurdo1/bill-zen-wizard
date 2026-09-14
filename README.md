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
npm run dev        # start the dev server
npm run build      # production build
npm run preview    # preview the production build
npm run lint       # run ESLint
npm run env:check  # fail if an .env file is ever tracked
npm run test:auth  # smoke-test the auth routes in a real browser
```

`npm run test:auth` drives the login, Google and account-recovery routes in a real
browser so they cannot silently regress. It starts the dev server itself, uses no
credentials, and accepts `BASE_URL` to test a deployment instead:

```sh
BASE_URL=https://honestinvoice.com npm run test:auth
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
| `OPENROUTER_API_KEY` | AI line-item extraction (primary provider — `openrouter/free` by default) |
| `NVIDIA_API_KEY` | AI line-item extraction (backup provider) |
| `HONEST_INVOICE_API_KEY` | Dedicated API key for MCP server access |
| `APP_BASE_URL` | Deployed app URL |

Copy [`.env.example`](./.env.example) to `.env` and fill in the values.

`.env` and every `.env.*` variant are gitignored (only `.env.example`, which holds
no values, is committed). To confirm your secrets will not be pushed before you commit:

```bash
npm run env:check
```

> **Auth emails** (signup confirmation, password reset, magic link) are sent by Supabase itself — configure SMTP in the Supabase dashboard (e.g. Resend: `smtp.resend.com`) so those emails get delivered.

## Auth setup (Supabase dashboard)

The auth UI is not self-contained — it relies on project settings that must be
configured in the Supabase dashboard, otherwise sign-in and OAuth fail at the
redirect rather than in our code.

**Authentication → URL Configuration**

| Setting | Value |
| --- | --- |
| Site URL | `https://honestinvoice.com` |
| Redirect URLs | `https://honestinvoice.com/**` and `http://localhost:5173/**` (dev) |

The app sends users back to `/auth/callback` (with a `?next=` destination) after
email confirmation, magic links, password recovery, and Google OAuth. If that URL
is not allowlisted, Supabase ignores it and drops the user on the Site URL
without a session, which looks like a silent sign-in failure.

**Authentication → Providers → Google**

1. Enable the provider and paste the Client ID / Secret (`GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET` in `.env.example`).
2. In Google Cloud Console, add an **Authorized redirect URI** pointing at
   Supabase, not this app: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Ensure the OAuth consent screen is published, otherwise only test users can
   sign in and everyone else gets `access_denied`.

First-time OAuth users get a `profiles` row from the `handle_new_user` trigger
(which reads the Google `name` claim) and are sent to onboarding like any other
new account.

## MCP / AI agent access

See [MCP_CONTEXT.md](./MCP_CONTEXT.md) for connecting Claude, Cursor, or any MCP-compatible agent to your account, plus the lead-scraping webhook and available endpoints.
