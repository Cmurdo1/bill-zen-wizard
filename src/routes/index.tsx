import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import {
  ArrowRight,
  Check,
  Sparkles,
  Zap,
  Receipt,
  Repeat,
  Globe2,
  Smartphone,
  ShieldCheck,
  Wand2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

const FEATURES = [
  { icon: Receipt, title: "Professional invoices", body: "Clean, branded invoices in under 2 minutes. Attach a payment link automatically." },
  { icon: Wand2, title: "AI line-item extraction", body: "Paste a job description. Get labor and materials broken out, priced, and ready to send." },
  { icon: Repeat, title: "Recurring & automated", body: "Set it once. Get paid every month. Automated payment reminders included." },
  { icon: Globe2, title: "Multi-currency", body: "Send in USD, EUR, GBP, and 150+ more. Your client sees their currency." },
  { icon: Smartphone, title: "Mobile-first", body: "Invoice from the truck, the jobsite, or the couch. Works everywhere." },
  { icon: ShieldCheck, title: "Secure by default", body: "Bank-grade encryption. PCI-compliant payments via Stripe. Your data stays yours." },
];

const STEPS = [
  { n: "01", title: "Add a client", body: "Or import from your contacts. One-time setup, forever reusable." },
  { n: "02", title: "Describe the job", body: "Type it like you'd tell a friend. AI turns it into itemized labor and materials." },
  { n: "03", title: "Send and get paid", body: "One-click send. Payment link included. Cash lands in your bank." },
];

const AUDIENCES = [
  "Freelancers", "Consultants", "HVAC contractors", "Electricians", "Plumbers",
  "Landscapers", "Cleaners", "Photographers", "Agencies", "Bookkeepers",
];

const FAQS = [
  { q: "Is there really a free plan?", a: "Yes. Send up to 5 invoices a month on the free plan, forever. No credit card required." },
  { q: "How do payments work?", a: "We use Stripe under the hood. Your client clicks the payment link on the invoice, pays by card or ACH, and money lands in your bank on the standard Stripe schedule. We never touch your money." },
  { q: "What is AI line-item extraction?", a: "Paste a plain-English job description — \"replaced 3-ton condenser, 4 hrs labor, refrigerant charge\" — and we generate itemized labor and materials with realistic pricing. You review, edit, and send." },
  { q: "Can I use my own logo and colors?", a: "Yes. Every plan supports custom branding on invoices, estimates, and payment pages." },
  { q: "Do you handle taxes?", a: "We calculate and display tax on invoices, but filing is your responsibility. Talk to an accountant." },
];

function HomePage() {
  return (
    <MarketingShell>
      {/* HERO */}
      <section className="bg-hero">
        <div className="container-page grid gap-12 py-20 lg:grid-cols-[1.15fr_1fr] lg:py-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> AI-powered invoicing, built for real work
            </span>
            <h1 className="mt-5 text-balance font-display text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Get paid faster.
              <br />
              <span className="italic text-primary">Honestly.</span>
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
              Honest Invoice is the modern invoicing platform for contractors, freelancers, and
              service businesses. Create professional invoices, send estimates, and get paid
              online — while AI handles the busywork.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lifted transition-opacity hover:opacity-90"
              >
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex h-12 items-center rounded-xl border border-border bg-surface px-6 text-sm font-semibold text-foreground hover:bg-surface-muted"
              >
                See pricing
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free plan · No credit card · Cancel any time
            </p>
          </div>

          {/* Faux invoice preview */}
          <div className="relative">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-lifted">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Invoice</p>
                  <p className="mt-0.5 font-semibold">INV-1042</p>
                </div>
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">Paid</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <Row label="Site inspection & diagnosis" qty="2h" amount="$180.00" />
                <Row label="3-ton condenser (Lennox)" qty="1" amount="$1,840.00" />
                <Row label="Refrigerant charge (R-410A)" qty="4 lb" amount="$96.00" />
                <Row label="Labor — installation" qty="6h" amount="$540.00" />
              </div>
              <div className="mt-4 border-t border-border pt-4 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>$2,656.00</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tax (7.25%)</span><span>$192.56</span></div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-sm font-semibold">Total due</span>
                  <span className="font-display text-3xl text-primary">$2,848.56</span>
                </div>
              </div>
              <button className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                <Zap className="h-4 w-4" /> Pay with one click
              </button>
            </div>
            <div className="absolute -right-4 -top-4 hidden rotate-3 rounded-xl border border-border bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground shadow-soft md:block">
              AI generated in 6s
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">Everything you need</p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              Invoicing that respects your time.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-surface p-6 shadow-soft transition-shadow hover:shadow-lifted">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/5 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-border bg-surface-muted/60 py-20">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">How it works</p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              Three steps. About two minutes.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-border bg-surface p-8 shadow-soft">
                <span className="font-display text-6xl text-primary/10">{s.n}</span>
                <h3 className="mt-2 text-xl font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="py-20">
        <div className="container-page text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">Built for you</p>
          <h2 className="mt-2 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            Serving the people who serve everyone else.
          </h2>
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
            {AUDIENCES.map((a) => (
              <span key={a} className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-soft">{a}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-surface-muted/60 py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">FAQ</p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              Questions, answered.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Can't find what you're looking for?{" "}
              <Link to="/signup" className="underline underline-offset-4">Try it free</Link>.
            </p>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {FAQS.map((f) => (
              <details key={f.q} className="group p-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground">
                  {f.q}
                  <span className="ml-4 text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20">
        <div className="container-page">
          <div className="overflow-hidden rounded-3xl bg-primary-gradient p-10 text-center text-primary-foreground shadow-lifted sm:p-16">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Ready to get paid faster?</h2>
            <p className="mt-3 text-primary-foreground/80">Start free. Send your first invoice in two minutes.</p>
            <Link
              to="/signup"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-lifted transition-transform hover:-translate-y-0.5"
            >
              Create your account <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function Row({ label, qty, amount }: { label: string; qty: string; amount: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-foreground">
        <Check className="h-3.5 w-3.5 text-success" /> {label}
      </span>
      <span className="flex items-center gap-4 text-muted-foreground">
        <span className="tabular-nums">{qty}</span>
        <span className="w-20 text-right font-medium text-foreground tabular-nums">{amount}</span>
      </span>
    </div>
  );
}
