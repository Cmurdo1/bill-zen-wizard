import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Loader2 } from "lucide-react";

type Invoice = { status: string; total_cents: number; issue_date: string; due_date: string | null };

export const Route = createFileRoute("/_authenticated/cash-velocity")({
  head: () => ({ meta: [{ title: "Cash Velocity — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: CashVelocityPage,
});

function CashVelocityPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase
      .from("invoices")
      .select("status,total_cents,issue_date,due_date")
      .then(({ data }) => {
        setInvoices((data as Invoice[]) ?? []);
        setLoading(false);
      });
  }, []);

  const outstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.total_cents, 0);
  const overdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.total_cents, 0);
  const paidThisMonth = invoices
    .filter((i) => i.status === "paid" && new Date(i.issue_date).getMonth() === new Date().getMonth())
    .reduce((s, i) => s + i.total_cents, 0);
  const paidLast30 = invoices
    .filter((i) => i.status === "paid" && Date.now() - new Date(i.issue_date).getTime() < 30 * 864e5)
    .reduce((s, i) => s + i.total_cents, 0);

  const dsoDays = (() => {
    const paid = invoices.filter((i) => i.status === "paid" && i.due_date);
    if (!paid.length) return 0;
    const total = paid.reduce((sum, i) => {
      const issued = new Date(i.issue_date).getTime();
      const due = new Date(i.due_date!).getTime();
      return sum + Math.max(0, (due - issued) / 864e5);
    }, 0);
    return Math.round(total / paid.length);
  })();

  return (
    <AppShell title="Cash Velocity">
      {loading ? (
        <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Outstanding" value={formatCurrency(outstanding)} />
            <Stat label="Overdue" value={formatCurrency(overdue)} tone="danger" />
            <Stat label="Paid this month" value={formatCurrency(paidThisMonth)} tone="success" />
            <Stat label="Avg DSO" value={`${dsoDays}d`} />
          </div>
          <div className="mt-6 rounded-2xl border border-border bg-surface p-8 shadow-soft">
            <h2 className="font-display text-xl">Last 30 days</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Collected {formatCurrency(paidLast30)} across {invoices.filter((i) => i.status === "paid").length} paid invoices.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Full trend charts and forecasting land with the Pro plan's Real-time DSO & Cash Flow Analytics module.
            </p>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl ${color}`}>{value}</p>
    </div>
  );
}
