import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Honest Invoice" },
      {
        name: "description",
        content:
          "Simple, transparent pricing. Free plan forever. Pro at $19.99/mo. Business at $49.99/mo.",
      },
      { property: "og:title", content: "Pricing — Honest Invoice" },
      {
        property: "og:description",
        content:
          "Free plan forever. Pro unlocks unlimited invoices and AI estimating. Business unlocks the Lead Gen Engine.",
      },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

const PRO_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK_PRO ?? "";
const BUSINESS_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK_BUSINESS ?? "";

type Plan = {
  name: string;
  price: string;
  period?: string;
  tagline: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  ctaExternal?: boolean;
  highlight?: boolean;
  variant: "free" | "pro" | "business";
};

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    tagline: "Basic billing for new trades",
    features: [
      "Up to 5 invoices / month",
      "Professional PDF templates",
      "Client contact list",
      "Manual payment recording",
      "Community support",
    ],
    ctaLabel: "Current Plan",
    ctaHref: "/signup",
    variant: "free",
  },
  {
    name: "Pro",
    price: "$19.99",
    period: "/ month",
    tagline: "Active Cash Flow Management",
    features: [
      "Unlimited High-Velocity Invoices",
      "Email delivery with payment links & one-click follow-ups",
      "AI-Powered Regional Estimating",
      "MCP API — let AI agents create & send estimates",
      "Real-time DSO & Cash Flow Analytics",
      "Lead Gen Engine (2 leads/mo)",
      "Automated Estimate Matching",
    ],
    ctaLabel: "Upgrade to Pro",
    ctaHref: PRO_LINK || "/signup",
    ctaExternal: Boolean(PRO_LINK),
    highlight: true,
    variant: "pro",
  },
  {
    name: "Business",
    price: "$49.99",
    period: "/ month",
    tagline: "Full Pipeline Dominance",
    features: [
      "Everything in Pro",
      "MCP API — AI agents auto-respond to leads 24/7",
      "Unlimited Lead Generation Engine",
      "Craigslist, FB, Nextdoor lead scraping",
      "AI-powered regional estimating",
      "Automated lead-to-estimate matching",
      "White-glove onboarding & support",
      "Priority feature requests",
    ],
    ctaLabel: "Upgrade to Business",
    ctaHref: BUSINESS_LINK || "/signup",
    ctaExternal: Boolean(BUSINESS_LINK),
    variant: "business",
  },
];

function PricingPage() {
  return (
    <MarketingShell>
      <section className="bg-hero">
        <div className="container-page py-20 text-center">
          <h1 className="font-display text-5xl tracking-tight text-foreground sm:text-6xl">
            Simple pricing. <span className="italic text-primary">Honest.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Start free. Upgrade when your business does. No hidden fees. Cancel any time.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="container-page grid gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <PlanCard key={p.name} plan={p} />
          ))}
        </div>
        <p className="container-page mt-8 text-center text-xs text-muted-foreground">
          Prices in USD. Subscriptions billed securely by Stripe. Cancel from your Stripe receipt
          any time.
        </p>
      </section>
    </MarketingShell>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const isHighlight = plan.highlight;
  return (
    <div
      className={`relative flex flex-col rounded-3xl border p-8 shadow-soft ${
        isHighlight
          ? "border-primary bg-primary text-primary-foreground shadow-lifted"
          : "border-border bg-surface"
      }`}
    >
      {isHighlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          Most popular
        </span>
      )}
      <h2
        className={`font-display text-3xl ${isHighlight ? "text-primary-foreground" : "text-foreground"}`}
      >
        {plan.name}
      </h2>
      <p
        className={`mt-1 text-sm ${isHighlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}
      >
        {plan.tagline}
      </p>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-display text-5xl">{plan.price}</span>
        {plan.period && (
          <span
            className={`text-sm ${isHighlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}
          >
            {plan.period}
          </span>
        )}
      </div>

      <p
        className={`mt-6 text-xs font-semibold uppercase tracking-widest ${isHighlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}
      >
        Included features
      </p>
      <ul className="mt-3 flex-1 space-y-3 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check
              className={`mt-0.5 h-4 w-4 shrink-0 ${isHighlight ? "text-accent" : "text-success"}`}
            />
            <span className={isHighlight ? "text-primary-foreground/90" : "text-foreground"}>
              {f}
            </span>
          </li>
        ))}
      </ul>

      <CtaButton plan={plan} />
    </div>
  );
}

function CtaButton({ plan }: { plan: Plan }) {
  const baseClass = `mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-opacity ${
    plan.variant === "free"
      ? "border border-border bg-surface text-foreground hover:bg-surface-muted"
      : plan.highlight
        ? "bg-accent text-accent-foreground hover:opacity-90"
        : "bg-primary text-primary-foreground hover:opacity-90"
  }`;

  if (plan.ctaExternal) {
    return (
      <a href={plan.ctaHref} target="_blank" rel="noopener noreferrer" className={baseClass}>
        {plan.variant !== "free" && <Sparkles className="h-4 w-4" />}
        {plan.ctaLabel}
      </a>
    );
  }
  return (
    <Link to={plan.ctaHref} className={baseClass}>
      {plan.variant !== "free" && <Sparkles className="h-4 w-4" />}
      {plan.ctaLabel}
    </Link>
  );
}
