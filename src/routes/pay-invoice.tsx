import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/pay-invoice")({
  head: () => ({
    meta: [
      { title: "Pay an invoice — Honest Invoice" },
      { name: "description", content: "Pay an Honest Invoice quickly and securely by card or ACH." },
      { property: "og:title", content: "Pay an invoice — Honest Invoice" },
      { property: "og:url", content: "/pay-invoice" },
    ],
    links: [{ rel: "canonical", href: "/pay-invoice" }],
  }),
  component: PayInvoicePage,
});

function PayInvoicePage() {
  return (
    <MarketingShell>
      <section className="bg-hero">
        <div className="container-page py-16">
          <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">Pay an invoice</h1>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            Received an Honest Invoice? Enter your invoice code below to view and pay it securely.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="container-page grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <form
            className="rounded-2xl border border-border bg-surface p-8 shadow-soft"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">Invoice code</span>
              <input
                placeholder="e.g. INV-1042 or the code in your email"
                className="block h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
              />
            </label>
            <button
              type="submit"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90"
            >
              Look up invoice <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Tip: the fastest way to pay is the button in the email your contractor sent you.
            </p>
          </form>

          <aside className="rounded-2xl border border-border bg-surface-muted/60 p-8">
            <ShieldCheck className="h-7 w-7 text-success" />
            <h2 className="mt-3 font-display text-2xl text-foreground">Secure by design</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Payments are processed by Stripe over an encrypted (TLS 1.3) connection. Honest Invoice
              never sees your card number. Every payment has a receipt sent to your email.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Trouble paying? Contact the business who sent you the invoice — or{" "}
              <Link to="/" className="underline">learn more about Honest Invoice</Link>.
            </p>
          </aside>
        </div>
      </section>
    </MarketingShell>
  );
}
