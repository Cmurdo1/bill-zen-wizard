import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import {
  ArrowRight,
  Bot,
  Check,
  Code2,
  Copy,
  Globe,
  Play,
  Terminal,
  Zap,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/mcp")({
  head: () => ({
    meta: [
      { title: "MCP — AI Agent Access — Honest Invoice" },
      {
        name: "description",
        content:
          "Connect Claude, Cursor, or any MCP-compatible AI agent to Honest Invoice with a Pro or Business plan. Your agent creates and sends estimates from your account.",
      },
      { property: "og:title", content: "MCP — AI Agent Access — Honest Invoice" },
      {
        property: "og:description",
        content:
          "Connect your AI agents to Honest Invoice via Model Context Protocol on Pro or Business. Create and send estimates from your associated account.",
      },
      { property: "og:url", content: "/mcp" },
    ],
    links: [{ rel: "canonical", href: "/mcp" }],
  }),
  component: McpPage,
});

const TOOLS = [
  {
    name: "create_estimate",
    desc: "Pro and Business only. Create an estimate with line items, client details, taxes, and an optional job description for the authenticated account.",
    method: "POST",
    path: "/api/mcp/documents",
  },
  {
    name: "create_invoice",
    desc: "Pro and Business only. Create an invoice with the same structure for the authenticated account.",
    method: "POST",
    path: "/api/mcp/documents",
  },
  {
    name: "list_documents",
    desc: "Pro and Business only. List the authenticated account's invoices and estimates with filtering.",
    method: "GET",
    path: "/api/mcp/documents",
  },
  {
    name: "update_document",
    desc: "Pro and Business only. Update account-owned invoices or estimates and their line items. Agents cannot delete records.",
    method: "PATCH",
    path: "/api/mcp/documents",
  },
  {
    name: "list_clients",
    desc: "Pro and Business only. List account-owned clients.",
    method: "GET",
    path: "/api/mcp/clients",
  },
  {
    name: "list_leads",
    desc: "Pro and Business only. List account-owned leads and response status.",
    method: "GET",
    path: "/api/mcp/leads",
  },
  {
    name: "update_lead_status",
    desc: "Pro and Business only. Mark an account lead won or lost without deleting it.",
    method: "PATCH",
    path: "/api/mcp/leads",
  },
  {
    name: "get_document_activity",
    desc: "Pro and Business only. Read the activity history for an account-owned document.",
    method: "GET",
    path: "/api/mcp/documents/activity",
  },
  {
    name: "send_document",
    desc: "Pro and Business only. Email an estimate or invoice from the authenticated account to its client.",
    method: "POST",
    path: "/api/mcp/documents/send",
  },
  {
    name: "extract_line_items",
    desc: "Use AI to break a plain-English job description into itemized labor and materials. Pro and Business only.",
    method: "POST",
    path: "/api/mcp/documents/extract",
  },
  {
    name: "process_lead",
    desc: "Pro and Business only. Process a lead, create an estimate for the authenticated account, and optionally email it.",
    method: "POST",
    path: "/api/mcp/leads/webhook",
  },
  {
    name: "scrape_leads",
    desc: "Scrape Craigslist, Nextdoor, or Facebook for new leads and auto-create estimates with AI. Business plan required.",
    method: "POST",
    path: "/api/mcp/leads/scrape",
  },
];

const CURSOR_CONFIG = `{
  "mcpServers": {
    "honest-invoice": {
      "command": "npx",
      "args": ["tsx", "src/mcp-server.ts"],
      "env": {
        "HONEST_INVOICE_API_KEY": "hi_mcp_your-dedicated-key",
        "APP_BASE_URL": "https://honestinvoice.com"
      }
    }
  }
}`;

const CURL_EXAMPLE = `curl -X POST https://honestinvoice.com/api/mcp/documents \\
  -H "Authorization: Bearer hi_mcp_YOUR_DEDICATED_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "estimate",
    "client_name": "Jane Smith",
    "client_email": "jane@email.com",
    "tax_rate": 7.25,
    "currency": "USD",
    "items": [
      {"description": "3-ton Condenser Unit", "quantity": 1, "rate_cents": 250000},
      {"description": "Labor (6 hours)", "quantity": 6, "rate_cents": 12500}
    ]
  }'`;

const WEBHOOK_EXAMPLE = `# Scrape a lead and auto-respond with an estimate\ncurl -X POST https://honestinvoice.com/api/mcp/leads/webhook \\
  -H "Authorization: Bearer hi_mcp_YOUR_DEDICATED_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Need HVAC condenser replaced",
    "description": "3-ton Lennox, 6 hours labor, R-410A refrigerant",
    "location": "Atlanta, GA",
    "contact_email": "customer@example.com",
    "contact_phone": "+15551234567",
    "source": "craigslist",
    "tax_rate": 7.25,
    "auto_send": true
  }'`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-success" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> Copy
        </>
      )}
    </button>
  );
}

function McpPage() {
  return (
    <MarketingShell>
      {/* HERO */}
      <section className="bg-hero">
        <div className="container-page py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
            <Bot className="h-3.5 w-3.5 text-accent" /> Model Context Protocol
          </span>
          <h1 className="mt-4 font-display text-5xl tracking-tight text-foreground sm:text-6xl">
            Let your AI agent
            <br />
            <span className="italic text-primary">do the billing.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Connect Claude, Cursor, or any MCP-compatible AI agent to Honest Invoice. Your agent
            creates and sends estimates from your associated Honest Invoice account — while you
            focus on the work. MCP access is available only on active Pro and Business plans, and
            every request is scoped to the account behind its dedicated API key.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#setup"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lifted transition-opacity hover:opacity-90"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#api-docs"
              className="inline-flex h-12 items-center rounded-xl border border-border bg-surface px-6 text-sm font-semibold text-foreground hover:bg-surface-muted"
            >
              API docs
            </a>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="border-t border-border py-16">
        <div className="container-page grid gap-8 md:grid-cols-3">
          {[
            {
              icon: Zap,
              title: "Respond in seconds",
              body: "Your AI agent generates a branded, itemized estimate and emails it the moment a lead appears. No human delay. No missed opportunities.",
            },
            {
              icon: Globe,
              title: "Works everywhere",
              body: "Stdio transport for desktop agents like Claude and Cursor. REST API for cloud agents, webhooks, and custom integrations.",
            },
            {
              icon: Sparkles,
              title: "AI-powered extraction",
              body: "Drop in a plain-English job description. AI splits it into labor, materials, quantities, and realistic pricing automatically.",
            },
          ].map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-border bg-surface p-6 shadow-soft"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/5 text-primary">
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SETUP GUIDE */}
      <section id="setup" className="border-t border-border py-16">
        <div className="container-page">
          <h2 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            Setup guide
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Connect your AI agent in under ten minutes. You need an active Pro or Business plan,
            Node.js 18+, and a dedicated API key created in Settings.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {/* Claude Desktop */}
            <div className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-2xl text-foreground">Claude Desktop</h3>
                  <p className="text-sm text-muted-foreground">Anthropic Claude</p>
                </div>
              </div>
              <ol className="mt-6 space-y-4 text-sm text-foreground/90">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    1
                  </span>
                  <span>
                    Open <strong>Settings → Developer → MCP Servers</strong> in Claude Desktop.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    2
                  </span>
                  <span>
                    Add a new server named <strong>honest-invoice</strong>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    3
                  </span>
                  <span>
                    Set command to <strong>npx</strong> and args to{" "}
                    <strong>tsx,src/mcp-server.ts</strong>. Point the working directory to your
                    Honest Invoice project.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    4
                  </span>
                  <span>
                    Add <strong>HONEST_INVOICE_API_KEY</strong> (your dedicated key) and{" "}
                    <strong>APP_BASE_URL</strong> (honestinvoice.com). Keep the key private and
                    never commit it to source control.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    5
                  </span>
                  <span>Click Save. A green status means you are connected.</span>
                </li>
              </ol>
            </div>

            {/* Cursor */}
            <div className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Terminal className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-2xl text-foreground">Cursor</h3>
                  <p className="text-sm text-muted-foreground">Cursor IDE</p>
                </div>
              </div>
              <ol className="mt-6 space-y-4 text-sm text-foreground/90">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    1
                  </span>
                  <span>
                    Open <strong>Settings → Features → MCP</strong> in Cursor.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    2
                  </span>
                  <span>
                    Add a new MCP server with the JSON config below. Replace the placeholder values
                    with your actual credentials.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    3
                  </span>
                  <span>
                    Restart Cursor and check the MCP panel — Honest Invoice tools should appear.
                  </span>
                </li>
              </ol>
              <div className="relative mt-5">
                <pre className="overflow-x-auto rounded-xl border border-border bg-surface-muted p-4 text-xs text-foreground/80">
                  <code>{CURSOR_CONFIG}</code>
                </pre>
                <CopyButton text={CURSOR_CONFIG} />
              </div>
            </div>
          </div>

          {/* Getting your token */}
          <div className="mt-8 rounded-2xl border border-border bg-surface-muted/60 p-8">
            <h4 className="font-display text-xl text-foreground">Create a dedicated API key</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a dedicated API key in your Honest Invoice Settings. Never copy a browser
              session token into an agent or cron configuration: session tokens expire and can
              expose more than the integration needs. API keys are hashed, account-scoped, and
              revocable.
            </p>
          </div>
        </div>
      </section>

      {/* API DOCS */}
      <section id="api-docs" className="border-t border-border py-16">
        <div className="container-page">
          <div className="flex items-center gap-3">
            <Code2 className="h-6 w-6 text-primary" />
            <h2 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              API reference
            </h2>
          </div>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            All endpoints accept a dedicated API key or a Supabase session JWT via the{" "}
            <code className="rounded bg-surface-muted px-1.5 py-0.5 text-sm">
              Authorization: Bearer
            </code>{" "}
            header. Dedicated keys are recommended for agents. An active Pro or Business plan is
            required, and every request is limited to the account associated with its credential.
          </p>

          {/* curl example */}
          <div className="relative mt-8">
            <pre className="overflow-x-auto rounded-2xl border border-border bg-surface-muted p-6 text-xs text-foreground/80">
              <code>{CURL_EXAMPLE}</code>
            </pre>
            <CopyButton text={CURL_EXAMPLE} />
          </div>

          {/* tools table */}
          <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left">
                  <th className="px-6 py-4 font-semibold text-foreground">Tool</th>
                  <th className="px-6 py-4 font-semibold text-foreground">Method</th>
                  <th className="hidden px-6 py-4 font-semibold text-foreground sm:table-cell">
                    Endpoint
                  </th>
                  <th className="hidden px-6 py-4 font-semibold text-foreground lg:table-cell">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {TOOLS.map((t) => (
                  <tr key={t.name} className="hover:bg-surface-muted/30">
                    <td className="px-6 py-4">
                      <code className="text-xs font-medium text-primary">{t.name}</code>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.method === "GET"
                            ? "bg-success/10 text-success"
                            : "bg-accent/10 text-accent-foreground"
                        }`}
                      >
                        {t.method}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 font-mono text-xs text-muted-foreground sm:table-cell">
                      {t.path}
                    </td>
                    <td className="hidden px-6 py-4 text-muted-foreground lg:table-cell">
                      {t.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cron setup */}
          <h3 className="mt-12 font-display text-2xl text-foreground">Cron job setup</h3>
          <p className="mt-3 text-muted-foreground">
            To scrape leads automatically on a schedule, configure an external cron service to call
            the{" "}
            <code className="rounded bg-surface-muted px-1.5 py-0.5 text-sm">
              POST /api/mcp/leads/scrape
            </code>{" "}
            endpoint every 5-15 minutes. This runs the scrapers, posts each found lead to the
            webhook, and auto-creates estimates. Business plan required.
          </p>
          <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
            <h4 className="font-semibold text-foreground">cron-job.org setup</h4>
            <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>1. Create a free account at cron-job.org</li>
              <li>
                2. Set URL to{" "}
                <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
                  https://honestinvoice.com/api/mcp/leads/scrape
                </code>
              </li>
              <li>
                3. Add header:{" "}
                <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
                  Authorization: Bearer hi_mcp_YOUR_DEDICATED_KEY
                </code>
              </li>
              <li>4. Set schedule to every 15 minutes</li>
              <li>
                5. Set request body (JSON): sources=["craigslist"], cl_city=atlanta,
                cl_category=hva, keywords=HVAC repair
              </li>
              <li>
                6. Save and enable — leads flow in automatically, estimates go out within seconds
              </li>
            </ol>
          </div>

          {/* Lead webhook */}
          <h3 className="mt-12 font-display text-2xl text-foreground">Lead scraping webhook</h3>
          <p className="mt-3 text-muted-foreground">
            The{" "}
            <code className="rounded bg-surface-muted px-1.5 py-0.5 text-sm">
              /api/mcp/leads/webhook
            </code>{" "}
            endpoint receives scraped leads and auto-creates an AI-extracted estimate, then emails
            it to the lead. Use it to build real-time lead response pipelines. When your scraping
            service finds a lead, POST it here and your AI agent handles the rest.
          </p>
          <div className="relative mt-4">
            <pre className="overflow-x-auto rounded-2xl border border-border bg-surface-muted p-6 text-xs text-foreground/80">
              <code>{WEBHOOK_EXAMPLE}</code>
            </pre>
            <CopyButton text={WEBHOOK_EXAMPLE} />
          </div>

          {/* Plan limits */}
          <div className="mt-8 rounded-2xl border border-border bg-surface p-8">
            <h3 className="font-display text-2xl text-foreground">Plan limits</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 font-semibold text-foreground">Feature</th>
                    <th className="pb-3 font-semibold text-foreground">Free</th>
                    <th className="pb-3 font-semibold text-foreground">Pro</th>
                    <th className="pb-3 font-semibold text-foreground">Business</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Invoices / month", "5", "Unlimited", "Unlimited"],
                    ["MCP access", "—", "Yes", "Yes"],
                    ["AI extraction", "—", "Yes", "Yes"],
                    ["Email sending", "—", "Yes", "Yes"],
                    ["Payment links", "—", "Yes", "Yes"],
                  ].map(([feature, free, pro, business]) => (
                    <tr key={feature}>
                      <td className="py-3 text-muted-foreground">{feature}</td>
                      <td className="py-3 text-foreground">{free}</td>
                      <td className="py-3 font-medium text-primary">{pro}</td>
                      <td className="py-3 font-medium text-primary">{business}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              MCP access, agent-created estimates, and agent-sent documents require an active Pro or
              Business plan. Every agent request acts on behalf of the account tied to its
              credential.
            </p>
          </div>
        </div>
      </section>

      {/* VIDEO WALKTHROUGH */}
      <section className="border-t border-border py-16">
        <div className="container-page">
          <div className="flex items-center gap-3">
            <Play className="h-6 w-6 text-primary" />
            <h2 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              Video walkthrough
            </h2>
          </div>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Watch a complete setup from scratch — creating a dedicated API key, configuring Claude
            Desktop, and sending your first AI-generated estimate in under five minutes.
          </p>
          <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface-muted shadow-soft">
            <div className="flex aspect-video items-center justify-center">
              <div className="text-center">
                <Play className="mx-auto h-14 w-14 text-primary/40" />
                <p className="mt-3 text-sm text-muted-foreground">Video walkthrough coming soon.</p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  In the meantime, follow the setup guide above or{" "}
                  <Link
                    to="/blog/$slug"
                    params={{ slug: "connect-claude-cursor-to-honest-invoice-mcp" }}
                    className="text-primary underline"
                  >
                    read the blog post
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16">
        <div className="container-page">
          <div className="overflow-hidden rounded-3xl bg-primary-gradient p-10 text-center text-primary-foreground shadow-lifted sm:p-16">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
              Your AI agent is waiting.
            </h2>
            <p className="mt-3 text-primary-foreground/80">
              Connect in under ten minutes with an active Pro or Business plan.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-lifted transition-transform hover:-translate-y-0.5"
              >
                Create your account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/blog/$slug"
                params={{ slug: "connect-claude-cursor-to-honest-invoice-mcp" }}
                className="inline-flex h-12 items-center rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-6 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/20"
              >
                Read the full guide
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
