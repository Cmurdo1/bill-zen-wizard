import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Loader2, ShieldCheck, Users, Activity, Webhook, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  head: () => ({ meta: [{ title: "Admin — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type SystemStats = {
  total_users: number; total_invoices: number; total_clients: number;
  total_revenue_cents: number; active_subscriptions: number;
  invoices_this_month: number; users_this_month: number;
};
type AdminUser = {
  id: string; email: string | null; business_name: string | null;
  subscription_status: string | null; subscription_end: string | null;
  created_at: string; invoice_count: number;
};
type SubStat = { status: string; count: number };
type WebhookLog = { id: string; type: string; source: string; status: string; created_at: string; payload: unknown };
type JobLead = { id: string; title: string; location: string; contact_email: string | null; status: string; created_at: string };

type Tab = "overview" | "users" | "subscriptions" | "webhooks" | "leads";

function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [subs, setSubs] = useState<SubStat[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookLog[]>([]);
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, u, ss, w, l] = await Promise.all([
        supabase.rpc("get_system_stats"),
        supabase.rpc("get_all_users"),
        supabase.rpc("get_subscription_stats"),
        supabase.rpc("get_webhook_logs"),
        supabase.rpc("get_job_leads"),
      ]);
      setStats((s.data as SystemStats[])?.[0] ?? null);
      setUsers((u.data as AdminUser[]) ?? []);
      setSubs((ss.data as SubStat[]) ?? []);
      setWebhooks((w.data as WebhookLog[]) ?? []);
      setLeads((l.data as JobLead[]) ?? []);
      setLoading(false);
    })();
  }, []);

  async function updateLead(id: string, status: string) {
    await supabase.rpc("update_job_lead_status", { lead_id: id, new_status: status });
    setLeads((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "subscriptions", label: "Subscriptions", icon: ShieldCheck },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "leads", label: "Job Leads", icon: Target },
  ];

  return (
    <AppShell title="Admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface-muted/40 p-1 w-fit">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${tab === id ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <Link
          to="/email"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Mail className="h-4 w-4" /> Send email
        </Link>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {tab === "overview" && stats && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total users" value={String(stats.total_users)} sub={`+${stats.users_this_month} this month`} />
              <Stat label="Total invoices" value={String(stats.total_invoices)} sub={`+${stats.invoices_this_month} this month`} />
              <Stat label="Total clients" value={String(stats.total_clients)} />
              <Stat label="Paid revenue" value={formatCurrency(stats.total_revenue_cents)} sub={`${stats.active_subscriptions} active subs`} />
            </div>
          )}

          {tab === "users" && (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <tr><th className="px-6 py-3">Email</th><th className="px-6 py-3">Business</th><th className="px-6 py-3">Plan</th><th className="px-6 py-3">Invoices</th><th className="px-6 py-3">Joined</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="px-6 py-4 font-semibold">{u.email ?? "—"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{u.business_name ?? "—"}</td>
                      <td className="px-6 py-4"><span className="rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold capitalize">{u.subscription_status ?? "free"}</span></td>
                      <td className="px-6 py-4 tabular-nums">{u.invoice_count}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No users yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === "subscriptions" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {subs.map((s) => <Stat key={s.status} label={s.status} value={String(s.count)} />)}
              {subs.length === 0 && <p className="text-muted-foreground">No subscription data.</p>}
            </div>
          )}

          {tab === "webhooks" && (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <tr><th className="px-6 py-3">Received</th><th className="px-6 py-3">Source</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Status</th></tr>
                </thead>
                <tbody>
                  {webhooks.map((w) => (
                    <tr key={w.id} className="border-b border-border/60 last:border-0">
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(w.created_at)}</td>
                      <td className="px-6 py-4 font-semibold">{w.source}</td>
                      <td className="px-6 py-4">{w.type}</td>
                      <td className="px-6 py-4"><span className="rounded-full bg-surface-muted px-2 py-1 text-xs">{w.status}</span></td>
                    </tr>
                  ))}
                  {webhooks.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No webhook events yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === "leads" && (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <tr><th className="px-6 py-3">Title</th><th className="px-6 py-3">Location</th><th className="px-6 py-3">Contact</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Received</th></tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b border-border/60 last:border-0">
                      <td className="px-6 py-4 font-semibold">{l.title}</td>
                      <td className="px-6 py-4 text-muted-foreground">{l.location}</td>
                      <td className="px-6 py-4 text-muted-foreground">{l.contact_email ?? "—"}</td>
                      <td className="px-6 py-4">
                        <select value={l.status} onChange={(e) => updateLead(l.id, e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="matched">Matched</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(l.created_at)}</td>
                    </tr>
                  ))}
                  {leads.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No job leads yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
