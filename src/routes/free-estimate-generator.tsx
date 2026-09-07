import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, FileText } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { SITE_URL } from "@/lib/seo-pages";

const title = "Free Estimate Generator | Create Estimates Online | Honest Invoice";
const description =
  "Create a professional estimate online for free. Describe the work, add services and pricing, review the scope, and send a clear estimate to your client.";

export const Route = createFileRoute("/free-estimate-generator")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:site_name", content: "Honest Invoice" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/free-estimate-generator` },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/free-estimate-generator` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Free Invoice Generator",
          url: `${SITE_URL}/free-estimate-generator`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description,
        }),
      },
    ],
  }),
  component: InvoiceGeneratorPage,
});

function InvoiceGeneratorPage() {
  return (
    <MarketingShell>
      <section className="bg-hero">
        <div className="container-page py-16 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">
              Free estimate generator
            </p>
            <h1 className="mt-3 font-display text-5xl tracking-tight text-foreground sm:text-6xl">
              Create a professional estimate for your next job.
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Start with the scope of work: add the client, describe the job, review pricing, and
              send. When you want AI-assisted line items and saved billing workflows, create a free
              Honest Invoice account.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
              >
                Create a free estimate <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/invoice-software-for-contractors"
                className="inline-flex h-12 items-center rounded-xl border border-border bg-surface px-6 text-sm font-semibold text-foreground"
              >
                For contractors
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="py-16">
        <div className="container-page grid gap-6 md:grid-cols-3">
          {[
            ["1", "Add your client", "Enter the customer and business details."],
            ["2", "Add the work", "List services, quantities, rates, taxes, and notes."],
            [
              "3",
              "Send it",
              "Create the invoice and use the payment workflow available on your plan.",
            ],
          ].map(([n, h, b]) => (
            <div key={n} className="rounded-2xl border border-border bg-surface p-7 shadow-soft">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {n}
              </span>
              <h2 className="mt-4 font-display text-2xl text-foreground">{h}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-y border-border bg-surface-muted/60 py-16">
        <div className="container-page grid gap-8 lg:grid-cols-2">
          <div>
            <FileText className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-display text-3xl text-foreground">
              Free does not have to mean flimsy.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Honest Invoice gives you a focused path from work completed to a client-ready invoice,
              without forcing you to learn a complicated accounting suite first.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              "Up to 5 invoices per month on the Free plan",
              "Professional invoice formatting",
              "Estimates and invoices in one workflow",
              "AI line-item extraction on eligible plans",
              "No credit card required to start",
            ].map((x) => (
              <li key={x} className="flex gap-3 text-sm text-foreground">
                <Check className="h-4 w-4 shrink-0 text-success" />
                {x}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="py-16">
        <div className="container-page rounded-3xl bg-primary-gradient p-10 text-center text-primary-foreground">
          <h2 className="font-display text-4xl">Need estimates and invoices for every job?</h2>
          <p className="mt-3 text-primary-foreground/80">
            Create a free account and keep your clients, estimates, and invoices together.
          </p>
          <Link
            to="/signup"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-accent-foreground"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
