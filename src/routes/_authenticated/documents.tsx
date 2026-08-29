import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { ESTIMATE_STATUSES, INVOICE_STATUSES, StatusPill } from "@/lib/documents";
import { useSubscription } from "@/lib/subscription";
import { UsageMeter } from "@/components/app/plan-badge";
import { SendDocumentModal } from "@/components/app/send-document-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Search, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { fetchEstimateList, type UnifiedEstimate } from "@/lib/estimate-schema";
import { fetchInvoiceList, type UnifiedInvoice } from "@/lib/invoice-schema";
import { useSendDocument, useMyEmail } from "@/hooks/useInvoices";

type Client = { id: string; name: string; email: string | null };

const DocumentsSearch = z.object({
  type: z.enum(["estimate", "invoice"]).default("estimate"),
});

type Sendable = {
  type: "estimate" | "invoice";
  id: string;
  number: string;
  client_id: string | null;
  total_cents: number;
  currency: string;
  date: string | null;
  job_description: string | null;
};

function toSendable(type: "estimate" | "invoice", doc: UnifiedEstimate | UnifiedInvoice): Sendable {
  return type === "estimate"
    ? {
        type,
        id: doc.id,
        number: (doc as UnifiedEstimate).estimate_number,
        client_id: doc.client_id,
        total_cents: doc.total_cents,
        currency: doc.currency,
        date: (doc as UnifiedEstimate).expiry_date,
        job_description: doc.job_description,
      }
    : {
        type,
        id: doc.id,
        number: (doc as UnifiedInvoice).invoice_number,
        client_id: doc.client_id,
        total_cents: doc.total_cents,
        currency: doc.currency,
        date: (doc as UnifiedInvoice).due_date,
        job_description: doc.job_description,
      };
}

export const Route = createFileRoute("/_authenticated/documents")({
  validateSearch: (search: unknown) => DocumentsSearch.parse(search),
  head: () => ({
    meta: [{ title: "Documents — Honest Invoice" }, { name: "robots", content: "noindex" }],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const navigate = useNavigate();
  const { type } = useSearch({ from: "/_authenticated/documents" });
  const isEstimate = type === "estimate";

  const [estimates, setEstimates] = useState<UnifiedEstimate[]>([]);
  const [invoices, setInvoices] = useState<UnifiedInvoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | string>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<Sendable | null>(null);
  const sub = useSubscription();
  const sendDoc = useSendDocument();
  const { data: myEmail } = useMyEmail();

  async function refresh() {
    setLoading(true);
    try {
      const [ests, invs, cliRes] = await Promise.all([
        fetchEstimateList(),
        fetchInvoiceList(),
        supabase.from("clients").select("id,name,email").order("name"),
      ]);
      setEstimates(ests);
      setInvoices(invs);
      setClients((cliRes.data as Client[]) ?? []);
    } catch (e) {
      toast.error(`Couldn't load documents: ${e instanceof Error ? e.message : "unknown error"}`);
      setEstimates([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  // Reset the status filter when switching between estimates and invoices.
  useEffect(() => {
    setFilter("all");
  }, [type]);

  const docs: (UnifiedEstimate | UnifiedInvoice)[] = isEstimate ? estimates : invoices;
  const statuses = isEstimate ? ESTIMATE_STATUSES : INVOICE_STATUSES;
  const label = isEstimate ? "estimate" : "invoice";
  const Label = isEstimate ? "Estimate" : "Invoice";

  const filtered = useMemo(
    () =>
      docs.filter((d) => {
        if (filter !== "all" && d.status !== filter) return false;
        if (query) {
          const c = clients.find((x) => x.id === d.client_id)?.name?.toLowerCase() ?? "";
          const number = isEstimate
            ? (d as UnifiedEstimate).estimate_number
            : (d as UnifiedInvoice).invoice_number;
          if (!`${number} ${c}`.toLowerCase().includes(query.toLowerCase())) return false;
        }
        return true;
      }),
    [docs, clients, filter, query, isEstimate],
  );

  async function createBlank() {
    if (!isEstimate && !sub.canCreateInvoice) return;
    setCreating(true);
    try {
      navigate({ to: "/magic-create", search: { type } });
    } finally {
      setCreating(false);
    }
  }

  const totals = useMemo((): {
    pipeline: number;
    accepted: number;
    open: number;
    outstanding: number;
    paid: number;
    draft: number;
  } => {
    if (isEstimate) {
      return {
        pipeline: estimates
          .filter((e) => e.status === "sent" || e.status === "draft")
          .reduce((s, e) => s + e.total_cents, 0),
        accepted: estimates
          .filter((e) => e.status === "accepted" || e.status === "converted")
          .reduce((s, e) => s + e.total_cents, 0),
        open: estimates.filter((e) => e.status === "draft" || e.status === "sent").length,
        outstanding: 0,
        paid: 0,
        draft: 0,
      };
    }
    return {
      outstanding: invoices
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((s, i) => s + i.total_cents, 0),
      paid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total_cents, 0),
      draft: invoices.filter((i) => i.status === "draft").length,
      pipeline: 0,
      accepted: 0,
      open: 0,
    };
  }, [isEstimate, estimates, invoices]);

  return (
    <AppShell title="Documents">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Select
          value={type}
          onValueChange={(v) =>
            navigate({ to: "/documents", search: { type: v as "estimate" | "invoice" } })
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="estimate">Estimates</SelectItem>
            <SelectItem value="invoice">Invoices</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {isEstimate ? (
          <>
            <Stat label="Pipeline" value={formatCurrency(totals.pipeline)} />
            <Stat label="Accepted" value={formatCurrency(totals.accepted)} tone="success" />
            <Stat label="Open" value={totals.open.toString()} />
          </>
        ) : (
          <>
            <Stat label="Outstanding" value={formatCurrency(totals.outstanding)} />
            <Stat label="Collected" value={formatCurrency(totals.paid)} tone="success" />
            <Stat label="Drafts" value={totals.draft.toString()} />
          </>
        )}
      </div>
      {!isEstimate && sub.plan === "free" && !sub.loading && (
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
            placeholder={`Search by ${label} # or client`}
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(["all", ...statuses] as const).map((s) => (
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
          disabled={creating || (!isEstimate && !sub.canCreateInvoice)}
          title={
            !isEstimate && !sub.canCreateInvoice
              ? "Free plan monthly limit reached — upgrade to continue"
              : undefined
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !isEstimate && !sub.canCreateInvoice ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}{" "}
          New {label}
        </button>
      </div>
      <div className="rounded-2xl border border-border bg-surface shadow-soft">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            No {label}s{filter !== "all" ? ` with status "${filter}"` : ""}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-3">{Label}</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Issued</th>
                <th className="px-6 py-3">{isEstimate ? "Expires" : "Due"}</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Send</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const number = isEstimate
                  ? (d as UnifiedEstimate).estimate_number
                  : (d as UnifiedInvoice).invoice_number;
                const date = isEstimate
                  ? (d as UnifiedEstimate).expiry_date
                  : (d as UnifiedInvoice).due_date;
                return (
                  <tr
                    key={d.id}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-6 py-4 font-semibold">
                      <Link
                        to="/documents/$id"
                        params={{ id: d.id }}
                        search={{ type }}
                        className="hover:text-primary"
                      >
                        {number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {clients.find((c) => c.id === d.client_id)?.name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(d.issue_date)}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {date ? formatDate(date) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={d.status} />
                    </td>
                    <td className="px-6 py-4 text-right font-semibold tabular-nums">
                      {formatCurrency(d.total_cents, d.currency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSending(toSendable(type, d))}
                        title={`Email this ${label} — pick a recipient or type any address`}
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
        title={`Send ${sending?.number ?? label}`}
        defaultTo={sending ? (clients.find((c) => c.id === sending.client_id)?.email ?? "") : ""}
        clients={clients}
        myEmail={myEmail ?? ""}
        onSend={async (to, message) => {
          if (!sending) return;
          const client = clients.find((c) => c.id === sending.client_id);
          await sendDoc.mutateAsync({
            type: sending.type,
            id: sending.id,
            invoice_number: sending.number,
            client_name: client?.name ?? "Client",
            client_email: to,
            total_amount: sending.total_cents / 100,
            due_date: sending.date,
            job_description: sending.job_description,
            message,
          });
          toast.success(`${Label} ${sending.number} emailed to ${to}`);
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
