import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Honest Invoice" },
      { name: "description", content: "Simple, transparent pricing. Start free. Upgrade when your business does." },
      { property: "og:title", content: "Pricing — Honest Invoice" },
      { property: "og:description", content: "Free plan available. Pro and Business plans unlock AI, recurring invoices, and lead-gen tools." },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "Try it. Send real invoices.",
    features: [
      "Up to 5 invoices per month",
      "Custom logo & brand color",
      "Public payment links",
      "1 user",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$14",
    period: "per month",
    tagline: "For serious solo operators.",
    features: [
      "Unlimited invoices & estimates",
      "AI line-item extraction",
      "Recurring invoices",
      "Automated payment reminders",
      "Multi-currency",
      "Cash velocity dashboard",
    ],
    cta: "Start 14-day trial",
    highlight: true,
  },
  {
    name: "Business",
    price: "$39",
    period: "per month",
    tagline: "For growing teams.",
    features: [
      "Everything in Pro",
      "Lead Gen Engine",
      "AI cash-flow forecasting",
      "Client risk scoring",
      "Up to 5 users",
      "Priority support",
    ],
    cta: "Start 14-day trial",
    highlight: false,
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
            <div
              key={p.name}
              className={`relative rounded-3xl border p-8 shadow-soft ${
                p.highlight
                  ? "border-primary bg-primary text-primary-foreground shadow-lifted"
                  : "border-border bg-surface"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                  Most popular
                </span>
              )}
              <h2 className={`text-lg font-semibold ${p.highlight ? "text-primary-foreground" : "text-foreground"}`}>{p.name}</h2>
              <p className={`text-sm ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{p.tagline}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl">{p.price}</span>
                <span className={`text-sm ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>/ {p.period}</span>
              </div>
              <Link
                to="/signup"
                className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold ${
                  p.highlight
                    ? "bg-accent text-accent-foreground hover:opacity-90"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {p.cta}
              </Link>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 ${p.highlight ? "text-accent" : "text-success"}`} />
                    <span className={p.highlight ? "text-primary-foreground/90" : "text-foreground"}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="container-page mt-8 text-center text-xs text-muted-foreground">
          Prices in USD. Payments processed securely by Stripe. Taxes may apply.
        </p>
      </section>
    </MarketingShell>
  );
}
