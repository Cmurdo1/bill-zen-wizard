import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { INVOICE_STATUSES, StatusPill, type InvoiceStatus } from "@/lib/documents";
import { useSubscription } from "@/lib/subscription";
import { UsageMeter } from "@/components/app/plan-badge";
import { SendDocumentModal } from "@/components/app/send-document-modal";
import { Loader2, Plus, Search, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { fetchInvoiceList, type UnifiedInvoice } from "@/lib/invoice-schema";
import { useSendDocument, useMyEmail } from "@/hooks/useInvoices";

type Client = { id: string; name: string; email: string | null };

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({
    meta: [{ title: "Invoices — Honest Invoice" }, { name: "robots", content: "noindex" }],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const [invoices, setInvoices] = useState<UnifiedInvoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<UnifiedInvoice | null>(null);
  const sub = useSubscription();
  const sendDoc = useSendDocument();
  const { data: myEmail } = useMyEmail();

  async function refresh() {
    setLoading(true);
    try {
      const [invoices, cliRes] = await Promise.all([
        fetchInvoiceList(),
        supabase.from("clients").select("id,name,email").order("name"),
      ]);
      setInvoices(invoices);
      setClients((cliRes.data as Client[]) ?? []);
    } catch (e) {
      toast.error(`Couldn't load invoices: ${e instanceof Error ? e.message : "unknown error"}`);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

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
    if (!sub.canCreateInvoice) return;
    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      window.location.href = `/magic-create?type=invoice`;
    } finally {
      setCreating(false);
    }
  }

  const totals = useMemo(
    () => ({
      outstanding: invoices
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((s, i) => s + i.total_cents, 0),
      paid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total_cents, 0),
      draft: invoices.filter((i) => i.status === "draft").length,
    }),
    [invoices],
  );

  return (
    <AppShell title="Invoices">
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatCurrency(totals.outstanding)} />
        <Stat label="Collected" value={formatCurrency(totals.paid)} tone="success" />
        <Stat label="Drafts" value={totals.draft.toString()} />
      </div>
      {sub.plan === "free" && !sub.loading && (
        <div className="mb-4">
          <UsageMeter
            used={sub.invoicesThisMonth}
            limit={sub.invoiceLimit}
            label="Invoices this month"
          />
        </div>
      )}
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
          disabled={creating || !sub.canCreateInvoice}
          title={
            !sub.canCreateInvoice
              ? "Free plan monthly limit reached — upgrade to continue"
              : undefined
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sub.canCreateInvoice ? (
            <Plus className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}{" "}
          New invoice
        </button>
      </div>
      <div className="rounded-2xl border border-border bg-surface shadow-soft">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
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
                <th className="px-6 py-3 text-right">Send</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const client = clients.find((c) => c.id === inv.client_id);
                return (
                  <tr
                    key={inv.id}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-6 py-4 font-semibold">
                      <Link
                        to="/invoices/$id"
                        params={{ id: inv.id }}
                        className="hover:text-primary"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {clients.find((c) => c.id === inv.client_id)?.name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDate(inv.issue_date)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(inv.due_date)}</td>
                    <td className="px-6 py-4">
                      <StatusPill status={inv.status} />
                    </td>
                    <td className="px-6 py-4 text-right font-semibold tabular-nums">
                      {formatCurrency(inv.total_cents, inv.currency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSending(inv)}
                        title="Email this invoice — pick a recipient or type any address"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Send
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>{" "}
      <SendDocumentModal
        open={!!sending}
        onClose={() => setSending(null)}
        title={`Send ${sending?.invoice_number ?? "invoice"}`}
        defaultTo={sending ? (clients.find((c) => c.id === sending.client_id)?.email ?? "") : ""}
        clients={clients}
        myEmail={myEmail ?? ""}
        onSend={async (to, message) => {
          if (!sending) return;
          const client = clients.find((c) => c.id === sending.client_id);
          await sendDoc.mutateAsync({
            type: "invoice",
            id: sending.id,
            invoice_number: sending.invoice_number,
            client_name: client?.name ?? "Client",
            client_email: to,
            total_amount: sending.total_cents / 100,
            due_date: sending.due_date,
            job_description: sending.job_description,
            message,
          });
          toast.success(`Invoice ${sending.invoice_number} emailed to ${to}`);
          setSending(null);
          await refresh();
        }}
      />
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
