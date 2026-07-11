import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { INVOICE_STATUSES, StatusPill, type InvoiceStatus } from "@/lib/documents";
import { Loader2, Plus, Search } from "lucide-react";

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  total_cents: number;
  currency: string;
  issue_date: string;
  due_date: string | null;
  client_id: string | null;
};
type Client = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    const [invRes, cliRes] = await Promise.all([
      supabase.from("invoices").select("id,invoice_number,status,total_cents,currency,issue_date,due_date,client_id").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    setInvoices((invRes.data as Invoice[]) ?? []);
    setClients((cliRes.data as Client[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (query) {
        const c = clients.find((x) => x.id === i.client_id)?.name?.toLowerCase() ?? "";
        const hay = `${i.invoice_number} ${c}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [invoices, clients, filter, query]);

  async function createBlank() {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("invoice_prefix,next_invoice_number").eq("id", user.id).maybeSingle();
      const prefix = profile?.invoice_prefix ?? "INV";
      const num = profile?.next_invoice_number ?? 1001;
      const due = new Date(); due.setDate(due.getDate() + 30);
      const { data: inv } = await supabase.from("invoices").insert({
        user_id: user.id,
        invoice_number: `${prefix}-${num}`,
        status: "draft",
        due_date: due.toISOString().slice(0, 10),
      }).select("id").single();
      await supabase.from("profiles").upsert({ id: user.id, next_invoice_number: num + 1 });
      if (inv) window.location.href = `/invoices/${inv.id}`;
    } finally {
      setCreating(false);
    }
  }

  const totals = useMemo(() => ({
    outstanding: invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.total_cents, 0),
    paid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total_cents, 0),
    draft: invoices.filter((i) => i.status === "draft").length,
  }), [invoices]);

  return (
    <AppShell title="Invoices">
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatCurrency(totals.outstanding)} />
        <Stat label="Collected" value={formatCurrency(totals.paid)} tone="success" />
        <Stat label="Drafts" value={totals.draft.toString()} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by invoice # or client"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(["all", ...INVOICE_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`h-10 rounded-lg px-3 text-xs font-semibold capitalize ${filter === s ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-foreground hover:bg-surface-muted"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={createBlank}
          disabled={creating}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New invoice
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-soft">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            No invoices{filter !== "all" ? ` with status "${filter}"` : ""}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Invoice</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Issued</th>
                <th className="px-6 py-3">Due</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted/50">
                  <td className="px-6 py-4 font-semibold">
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="hover:text-primary">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{clients.find((c) => c.id === inv.client_id)?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(inv.due_date)}</td>
                  <td className="px-6 py-4"><StatusPill status={inv.status} /></td>
                  <td className="px-6 py-4 text-right font-semibold tabular-nums">
                    {formatCurrency(inv.total_cents, inv.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  const color = tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl ${color}`}>{value}</p>
    </div>
  );
}
