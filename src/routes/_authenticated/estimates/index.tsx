import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { ESTIMATE_STATUSES, StatusPill, type EstimateStatus } from "@/lib/documents";
import { SendDocumentModal } from "@/components/app/send-document-modal";
import { Loader2, Plus, Search, Mail } from "lucide-react";
import { toast } from "sonner";
import { fetchEstimateList, type UnifiedEstimate } from "@/lib/estimate-schema";
import { useSendDocument, useMyEmail } from "@/hooks/useInvoices";

type Client = { id: string; name: string; email: string | null };

export const Route = createFileRoute("/_authenticated/estimates/")({
  head: () => ({
    meta: [{ title: "Estimates — Honest Invoice" }, { name: "robots", content: "noindex" }],
  }),
  component: EstimatesPage,
});

function EstimatesPage() {
  const [estimates, setEstimates] = useState<UnifiedEstimate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | EstimateStatus>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<UnifiedEstimate | null>(null);
  const sendDoc = useSendDocument();
  const { data: myEmail } = useMyEmail();

  async function refresh() {
    setLoading(true);
    try {
      const [estimates, cliRes] = await Promise.all([
        fetchEstimateList(),
        supabase.from("clients").select("id,name,email").order("name"),
      ]);
      setEstimates(estimates);
      setClients((cliRes.data as Client[]) ?? []);
    } catch (e) {
      toast.error(`Couldn't load estimates: ${e instanceof Error ? e.message : "unknown error"}`);
      setEstimates([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(
    () =>
      estimates.filter((e) => {
        if (filter !== "all" && e.status !== filter) return false;
        if (query) {
          const c = clients.find((x) => x.id === e.client_id)?.name?.toLowerCase() ?? "";
          if (!`${e.estimate_number} ${c}`.toLowerCase().includes(query.toLowerCase()))
            return false;
        }
        return true;
      }),
    [estimates, clients, filter, query],
  );

  async function createBlank() {
    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      window.location.href = `/magic-create?type=estimate`;
    } finally {
      setCreating(false);
    }
  }

  const totals = useMemo(
    () => ({
      pipeline: estimates
        .filter((e) => e.status === "sent" || e.status === "draft")
        .reduce((s, e) => s + e.total_cents, 0),
      accepted: estimates
        .filter((e) => e.status === "accepted" || e.status === "converted")
        .reduce((s, e) => s + e.total_cents, 0),
      open: estimates.filter((e) => e.status === "draft" || e.status === "sent").length,
    }),
    [estimates],
  );

  return (
    <AppShell title="Estimates">
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Pipeline" value={formatCurrency(totals.pipeline)} />
        <Stat label="Accepted" value={formatCurrency(totals.accepted)} tone="success" />
        <Stat label="Open" value={totals.open.toString()} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by estimate # or client"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(["all", ...ESTIMATE_STATUSES] as const).map((s) => (
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
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}
          New estimate
        </button>
      </div>
      <div className="rounded-2xl border border-border bg-surface shadow-soft">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            No estimates{filter !== "all" ? ` with status "${filter}"` : ""}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Estimate</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Issued</th>
                <th className="px-6 py-3">Expires</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Send</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((est) => {
                const client = clients.find((c) => c.id === est.client_id);
                return (
                  <tr
                    key={est.id}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-6 py-4 font-semibold">
                      <Link
                        to="/estimates/$id"
                        params={{ id: est.id }}
                        className="hover:text-primary"
                      >
                        {est.estimate_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {clients.find((c) => c.id === est.client_id)?.name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDate(est.issue_date)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDate(est.expiry_date)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={est.status} />
                    </td>
                    <td className="px-6 py-4 text-right font-semibold tabular-nums">
                      {formatCurrency(est.total_cents, est.currency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSending(est)}
                        title="Email this estimate — pick a recipient or type any address"
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
        title={`Send ${sending?.estimate_number ?? "estimate"}`}
        defaultTo={sending ? (clients.find((c) => c.id === sending.client_id)?.email ?? "") : ""}
        clients={clients}
        myEmail={myEmail ?? ""}
        onSend={async (to, message) => {
          if (!sending) return;
          const client = clients.find((c) => c.id === sending.client_id);
          await sendDoc.mutateAsync({
            type: "estimate",
            id: sending.id,
            invoice_number: sending.estimate_number,
            client_name: client?.name ?? "Client",
            client_email: to,
            total_amount: sending.total_cents / 100,
            due_date: sending.expiry_date,
            job_description: sending.job_description,
            message,
          });
          toast.success(`Estimate ${sending.estimate_number} emailed to ${to}`);
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
