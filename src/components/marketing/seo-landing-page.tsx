import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/shell";
import type { SeoPageConfig } from "@/lib/seo-pages";

export function SeoLandingPage({
  config,
  children,
}: {
  config: SeoPageConfig;
  children?: ReactNode;
}) {
  return (
    <MarketingShell>
      <section className="bg-hero">
        <div className="container-page py-16 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">
              {config.eyebrow}
            </p>
            <h1 className="mt-3 text-balance font-display text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
              {config.h1}
            </h1>
            <p className="mt-5 text-pretty text-lg leading-8 text-muted-foreground">
              {config.intro}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lifted hover:opacity-90"
              >
                Create your first invoice free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/free-invoice-generator"
                className="inline-flex h-12 items-center rounded-xl border border-border bg-surface px-6 text-sm font-semibold text-foreground hover:bg-surface-muted"
              >
                Try the free generator
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free plan · No credit card · Up to 5 invoices/month
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-foreground shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> The Honest Invoice workflow
            </div>
            <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground">
              {config.workflow}
            </h2>
            <p className="mt-4 text-muted-foreground">{config.audience}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft sm:p-8">
            <ol className="space-y-6">
              {[
                [
                  "1",
                  "Describe the work",
                  "Type the job in plain English — what you did, what you used, and how long it took.",
                ],
                [
                  "2",
                  "Let AI draft the line items",
                  "Honest Invoice turns the description into labor, materials, quantities, and prices you can review.",
                ],
                [
                  "3",
                  "Send and get paid",
                  "Create the professional invoice, send it to the client, and use a payment link when your plan supports online payments.",
                ],
              ].map(([n, title, body]) => (
                <li key={n} className="flex gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {n}
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted/60 py-16 sm:py-20">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">
              Why it fits
            </p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-foreground">
              Less admin. More time doing the work.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {config.benefits.map((benefit) => (
              <div
                key={benefit}
                className="rounded-2xl border border-border bg-surface p-6 shadow-soft"
              >
                <Check className="h-5 w-5 text-success" />
                <p className="mt-3 text-sm leading-6 text-foreground">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">
              Use cases
            </p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-foreground">
              Built around real jobs.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Examples you can turn into an invoice without rebuilding every line item from scratch.
            </p>
            <ul className="mt-6 space-y-3">
              {config.examples.map((example) => (
                <li key={example} className="flex gap-3 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {example}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
            <ShieldCheck className="h-7 w-7 text-success" />
            <h2 className="mt-3 font-display text-2xl text-foreground">
              Secure payment infrastructure
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Online payments use Stripe. Honest Invoice is designed so your billing workflow stays
              focused on invoices and client payments rather than storing card numbers in your app.
            </p>
            <Link
              to="/pricing"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4"
            >
              See plans and payment features <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {children}

      <section className="border-t border-border bg-surface-muted/60 py-16">
        <div className="container-page grid gap-8 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">
              FAQ
            </p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-foreground">
              Questions, answered.
            </h2>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {config.faq.map((item) => (
              <details
                key={item.q}
                className="group p-6 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground">
                  {item.q}
                  <span className="ml-4 text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container-page">
          <div className="rounded-3xl bg-primary-gradient p-10 text-center text-primary-foreground shadow-lifted sm:p-14">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
              Stop writing invoices from scratch.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
              Describe the job, review the line items, and send the invoice.
            </p>
            <Link
              to="/signup"
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-lifted hover:-translate-y-0.5"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
