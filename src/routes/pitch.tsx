import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { ArrowRight, TrendingUp, Target, Users, Sparkles, Bot } from "lucide-react";

export const Route = createFileRoute("/pitch")({
  head: () => ({
    meta: [
      { title: "Investor Pitch — Honest Invoice" },
      {
        name: "description",
        content:
          "Honest Invoice is rebuilding invoicing for the 30 million service businesses that still get paid on paper.",
      },
      { property: "og:title", content: "Investor Pitch — Honest Invoice" },
      { property: "og:url", content: "/pitch" },
    ],
    links: [{ rel: "canonical", href: "/pitch" }],
  }),
  component: PitchPage,
});

function PitchPage() {
  return (
    <MarketingShell>
      <section className="bg-hero">
        <div className="container-page py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">
            Investor overview · Series Seed
          </p>
          <h1 className="mt-3 font-display text-5xl tracking-tight text-foreground sm:text-6xl">
            Invoicing, rebuilt for the 30M
            <br />
            <span className="italic text-primary">service businesses paid on paper.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            QuickBooks was built for accountants. Freshbooks was built for freelancers a decade ago.
            Honest Invoice is built for the modern contractor: mobile-first, AI-assisted, and honest
            about pricing.
          </p>
        </div>
      </section>

      <Section title="The problem" icon={Target}>
        <p>
          85% of US service businesses still send invoices via PDF or text message. The average
          contractor waits 27 days to get paid. Existing tools are either overbuilt (Intuit),
          undermarketed (Wave), or extractive (Housecall Pro's payment fees).
        </p>
      </Section>

      <Section title="The market" icon={TrendingUp}>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { k: "30M+", v: "US service businesses" },
            { k: "$78B", v: "SMB accounting software TAM by 2028" },
            { k: "12%", v: "CAGR of invoicing software" },
          ].map((m) => (
            <div key={m.k} className="rounded-2xl border border-border bg-surface p-6">
              <p className="font-display text-4xl text-primary">{m.k}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.v}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The wedge" icon={Sparkles}>
        <p>
          AI line-item extraction converts a plain-English job description into a professional,
          itemized invoice in under 10 seconds. That single feature — impossible two years ago —
          collapses the biggest friction point for contractors who hate paperwork.
        </p>
      </Section>

      <Section title="MCP: AI agents as your sales force" icon={Bot}>
        <div>
          <p>
            On active Pro and Business plans, Honest Invoice exposes a Model Context Protocol (MCP)
            server so AI agents like Claude and Cursor can create and send estimates on a
            contractor's behalf. When a lead posts on Craigslist or Nextdoor, the contractor's AI
            agent can generate a professional estimate and email it — in seconds. Every request is
            scoped to the contractor account associated with its access token.
          </p>
          <p className="mt-4">
            MCP access is a paid-plan feature. Pro and Business users can connect an agent to work
            with their own clients, estimates, and invoices; Free accounts cannot call MCP tools.
          </p>
          <ul className="mt-4 list-disc pl-5 text-sm">
            <li>MCP stdio transport for desktop agents (Claude, Cursor, Windsurf)</li>
            <li>REST API at /api/mcp/documents for cloud agents and webhooks</li>
            <li>AI-powered line-item extraction for Pro and Business</li>
            <li>Estimate-to-invoice conversion with one API call</li>
          </ul>
        </div>
      </Section>

      <Section title="Traction & plan" icon={Users}>
        <ul className="list-disc pl-5 text-sm">
          <li>Public launch: Q3 2026</li>
          <li>Wedge: HVAC & electrical contractors in the US Southeast</li>
          <li>Business model: $14 Pro / $39 Business SaaS with no per-payment take rate</li>
          <li>18-month goal: 10,000 paying customers, $2.5M ARR</li>
        </ul>
      </Section>

      <section className="py-16">
        <div className="container-page">
          <div className="rounded-3xl bg-primary-gradient p-10 text-primary-foreground">
            <h2 className="font-display text-3xl tracking-tight">Interested?</h2>
            <p className="mt-2 max-w-xl text-primary-foreground/80">
              We're raising a seed round to accelerate the AI roadmap and hire our founding
              engineering team. Reach out for the full deck.
            </p>
            <a
              href="mailto:investors@honestinvoice.com"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground"
            >
              investors@honestinvoice.com <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-6 text-xs text-primary-foreground/60">
              Or{" "}
              <Link to="/signup" className="underline">
                try the product yourself
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-16">
      <div className="container-page grid gap-8 md:grid-cols-[1fr_2fr]">
        <div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">
            <Icon className="h-4 w-4" /> {title}
          </span>
        </div>
        <div className="text-lg leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </section>
  );
}
