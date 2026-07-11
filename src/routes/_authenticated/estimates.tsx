import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { ESTIMATE_STATUSES, StatusPill, type EstimateStatus } from "@/lib/documents";
import { Loader2, Plus, Search } from "lucide-react";

type Estimate = {
  id: string;
  estimate_number: string;
  status: string;
  total_cents: number;
  currency: string;
  issue_date: string;
  expiry_date: string | null;
  client_id: string | null;
};
type Client = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/estimates")({
  head: () => ({ meta: [{ title: "Estimates — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: EstimatesPage,
});

function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | EstimateStatus>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    const [estRes, cliRes] = await Promise.all([
      supabase.from("estimates").select("id,estimate_number,status,total_cents,currency,issue_date,expiry_date,client_id").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    setEstimates((estRes.data as Estimate[]) ?? []);
    setClients((cliRes.data as Client[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => estimates.filter((e) => {
    if (filter !== "all" && e.status !== filter) return false;
    if (query) {
      const c = clients.find((x) => x.id === e.client_id)?.name?.toLowerCase() ?? "";
      if (!`${e.estimate_number} ${c}`.toLowerCase().includes(query.toLowerCase())) return false;
    }
    return true;
  }), [estimates, clients, filter, query]);

  async function createBlank() {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase.from("estimates").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      const num = 1001 + (count ?? 0);
      const expiry = new Date(); expiry.setDate(expiry.getDate() + 30);
      const { data: est } = await supabase.from("estimates").insert({
        user_id: user.id,
        estimate_number: `EST-${num}`,
        status: "draft",
        expiry_date: expiry.toISOString().slice(0, 10),
      }).select("id").single();
      if (est) window.location.href = `/estimates/${est.id}`;
    } finally {
      setCreating(false);
    }
  }

  const totals = useMemo(() => ({
    pipeline: estimates.filter((e) => e.status === "sent" || e.status === "draft").reduce((s, e) => s + e.total_cents, 0),
    accepted: estimates.filter((e) => e.status === "accepted" || e.status === "converted").reduce((s, e) => s + e.total_cents, 0),
    open: estimates.filter((e) => e.status === "draft" || e.status === "sent").length,
  }), [estimates]);

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
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New estimate
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-soft">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((est) => (
                <tr key={est.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted/50">
                  <td className="px-6 py-4 font-semibold">
                    <Link to="/estimates/$id" params={{ id: est.id }} className="hover:text-primary">
                      {est.estimate_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{clients.find((c) => c.id === est.client_id)?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(est.issue_date)}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(est.expiry_date)}</td>
                  <td className="px-6 py-4"><StatusPill status={est.status} /></td>
                  <td className="px-6 py-4 text-right font-semibold tabular-nums">
                    {formatCurrency(est.total_cents, est.currency)}
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
