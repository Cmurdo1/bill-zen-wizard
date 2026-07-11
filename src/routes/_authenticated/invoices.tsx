import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { FileText, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AppShell title="Invoices">
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-soft">
        <FileText className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-3 font-display text-2xl">Manage invoices from the dashboard</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Your invoice list, AI line-item extraction, and cash summaries live on the dashboard. A dedicated Invoices workspace is on the way.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AppShell>
  ),
});
