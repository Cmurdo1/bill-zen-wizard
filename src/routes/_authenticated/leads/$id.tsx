import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import {
  ArrowLeft,
  Loader2,
  Target,
  Mail,
  MapPin,
  Phone,
  Clock,
  ExternalLink,
  Send,
  XCircle,
  AlertCircle,
  Eye,
  MousePointerClick,
  RotateCcw,
  Trophy,
  ThumbsDown,
  Trash2,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  head: () => ({
    meta: [{ title: "Lead Detail — Honest Invoice" }, { name: "robots", content: "noindex" }],
  }),
  component: LeadDetailPage,
});

const SOURCE_LABELS: Record<string, string> = {
  craigslist: "Craigslist",
  nextdoor: "Nextdoor",
  facebook: "Facebook",
  manual: "Manual",
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function LeadDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState<any>(null);
  const [response, setResponse] = useState<any>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [tracking, setTracking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [legacyEstimate, setLegacyEstimate] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const userId = userData.user.id;
      const db = supabase as any;

      // Fetch lead + response + estimate + items + tracking in parallel
      const [{ data: leadData }, { data: respData }] = await Promise.all([
        db.from("job_leads").select("*").eq("id", id).maybeSingle(),
        db
          .from("lead_responses")
          .select("*")
          .eq("lead_id", id)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!leadData) {
        setError("Lead not found");
        setLoading(false);
        return;
      }

      setLead(leadData);
      setResponse(respData || null);

      // If there's a response with an estimate, fetch estimate + items + tracking
      if (respData?.estimate_id) {
        // Detect legacy schema: if estimates table doesn't exist, use invoices
        let estTable = "estimates";
        let itemsTable = "estimate_items";
        let itemsFk = "estimate_id";
        let numberField = "estimate_number";
        let isLegacy = false;

        const { error: probeErr } = await db.from("estimates").select("id").limit(1);
        if (probeErr?.code === "42P01" || probeErr?.code === "PGRST205") {
          estTable = "invoices";
          itemsTable = "invoice_items";
          itemsFk = "invoice_id";
          numberField = "invoice_number";
          isLegacy = true;
          setLegacyEstimate(true);
        }

        const estPromise = isLegacy
          ? db
              .from("invoices")
              .select("*")
              .eq("id", respData.estimate_id)
              .eq("type", "estimate")
              .maybeSingle()
          : db.from("estimates").select("*").eq("id", respData.estimate_id).maybeSingle();

        const itemsPromise = db
          .from(itemsTable)
          .select("*")
          .eq(itemsFk, respData.estimate_id)
          .order("sort_order");

        const trackingPromise = respData.tracking_id
          ? db
              .from("email_tracking")
              .select("*")
              .eq("tracking_id", respData.tracking_id)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [] });

        const [{ data: estData }, { data: itemsData }, { data: trackingData }] = await Promise.all([
          estPromise,
          itemsPromise,
          trackingPromise,
        ]);

        setEstimate(
          estData
            ? {
                ...estData,
                [numberField]:
                  estData[numberField] || estData.estimate_number || estData.invoice_number,
              }
            : null,
        );
        setItems(itemsData || []);
        setTracking(trackingData || []);
      }

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lead");
    } finally {
      setLoading(false);
    }
  }

  // ── Actions ──────────────────────────────────────────────────

  async function handleResend() {
    if (!estimate?.id || !lead?.contact_email) return;
    setActionLoading(true);
    try {
      // Auto-approve if needed
      const db = supabase as any;
      const { data: est } = await db
        .from("estimates")
        .select("id, approved_at")
        .eq("id", estimate.id)
        .maybeSingle();

      if (est && !est.approved_at) {
        const { error: approveErr } = await db
          .from("estimates")
          .update({ approved_at: new Date().toISOString() })
          .eq("id", estimate.id);
        if (
          approveErr &&
          approveErr.code !== "42703" &&
          approveErr.code !== "42P01" &&
          approveErr.code !== "PGRST205"
        ) {
          throw approveErr;
        }
      }

      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/mcp/documents/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_id: estimate.id,
          document_type: "estimate",
          to_email: lead.contact_email,
          custom_message: `Following up on our estimate for "${lead.title}". Reply to discuss!`,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error || `Send failed (${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to re-send");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkStatus(status: string) {
    if (!response) return;
    setActionLoading(true);
    try {
      const db = supabase as any;
      const { error: updateErr } = await db
        .from("lead_responses")
        .update({ status })
        .eq("lead_id", id);
      if (updateErr) throw updateErr;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!response || !confirm("Delete this lead response?")) return;
    setActionLoading(true);
    try {
      const db = supabase as any;
      await db.from("lead_responses").delete().eq("lead_id", id);
      navigate({ to: "/leads" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setActionLoading(false);
    }
  }

  // ── Status helpers ───────────────────────────────────────────

  const statusColors: Record<string, string> = {
    pending: "bg-amber-400/10 text-amber-400",
    estimate_sent: "bg-blue-500/10 text-blue-500",
    opened: "bg-amber-400/10 text-amber-400",
    clicked: "bg-success/10 text-success",
    won: "bg-amber-500/10 text-amber-500",
    lost: "bg-slate-400/10 text-slate-400",
    failed: "bg-destructive/10 text-destructive",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pending",
    estimate_sent: "Estimate Sent",
    opened: "Opened",
    clicked: "Clicked",
    won: "Won",
    lost: "Lost",
    failed: "Failed",
  };

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell title="Lead Detail">
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!lead) {
    return (
      <AppShell title="Lead Detail">
        <p className="text-muted-foreground">{error ?? "Lead not found."}</p>
        <Link to="/leads" className="mt-4 inline-flex text-sm text-primary hover:underline">
          ← Back to Lead Board
        </Link>
      </AppShell>
    );
  }

  const canAct = response && !["won", "lost", "failed"].includes(response.status);

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/leads"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Lead Board
        </Link>
        <div className="flex items-center gap-2">
          {canAct && (
            <>
              <button
                onClick={handleResend}
                disabled={actionLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60"
              >
                {actionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Re-send
              </button>
              <button
                onClick={() => handleMarkStatus("won")}
                disabled={actionLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-500 hover:bg-amber-500/20 disabled:opacity-60"
              >
                <Trophy className="h-3.5 w-3.5" /> Mark Won
              </button>
              <button
                onClick={() => handleMarkStatus("lost")}
                disabled={actionLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-400/30 bg-slate-400/10 px-3 text-xs font-semibold text-slate-400 hover:bg-slate-400/20 disabled:opacity-60"
              >
                <ThumbsDown className="h-3.5 w-3.5" /> Mark Lost
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </>
          )}
          {response && ["won", "lost", "failed"].includes(response.status) && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${statusColors[response.status]}`}
            >
              {response.status === "won" ? (
                <Trophy className="h-3.5 w-3.5" />
              ) : response.status === "lost" ? (
                <ThumbsDown className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {statusLabels[response.status]}
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mr-2 inline-block h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main content */}
        <div className="space-y-6">
          {/* Lead info card */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl text-foreground">{lead.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium uppercase text-muted-foreground">
                    {SOURCE_LABELS[lead.source] || lead.source}
                  </span>
                  {response && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusColors[response.status] || "bg-surface-muted text-muted-foreground"}`}
                    >
                      {statusLabels[response.status] || response.status}
                    </span>
                  )}
                </div>
              </div>
              {lead.budget_range && (
                <div className="shrink-0 rounded-xl bg-accent/10 px-4 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Budget
                  </p>
                  <p className="text-sm font-bold text-accent">{lead.budget_range}</p>
                </div>
              )}
            </div>

            {/* Contact & location */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {lead.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {lead.location}
                </div>
              )}
              {lead.contact_email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${lead.contact_email}`} className="text-primary hover:underline">
                    {lead.contact_email}
                  </a>
                </div>
              )}
              {lead.contact_phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={`tel:${lead.contact_phone}`} className="text-primary hover:underline">
                    {lead.contact_phone}
                  </a>
                </div>
              )}
            </div>

            {/* Description */}
            {lead.description && (
              <div className="mt-5 rounded-xl bg-surface-muted/60 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Job Description
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {lead.description}
                </p>
              </div>
            )}

            {/* Source link */}
            {lead.source === "craigslist" && (
              <div className="mt-4 border-t border-border pt-4">
                <a
                  href={`https://${(lead.location || "atlanta").toLowerCase().replace(/\s+/g, "")}.craigslist.org/search/hva`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on Craigslist
                </a>
              </div>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              <Clock className="mr-1 inline-block h-3 w-3" />
              Lead scraped {timeAgo(lead.created_at)}
              {lead.updated_at !== lead.created_at && ` · Updated ${timeAgo(lead.updated_at)}`}
            </p>
          </section>

          {/* Estimate preview */}
          {estimate && (
            <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Auto-Generated Estimate
                </h2>
                <Link
                  to="/documents/$id"
                  params={{ id: estimate.id }}
                  search={{ type: "estimate" }}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open in editor <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-success/10 px-3 py-1.5 text-sm font-bold text-success">
                  {estimate.estimate_number}
                </span>
                <span className="text-xs text-muted-foreground">
                  Created {timeAgo(estimate.created_at)}
                </span>
              </div>

              {/* Line items */}
              {items.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted/40 text-left">
                        <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                          Item
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                          Qty
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                          Rate
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item: any, i: number) => {
                        const rate = item.rate_cents ?? Math.round((item.unit_price ?? 0) * 100);
                        const amt = item.amount_cents ?? Math.round((item.quantity ?? 0) * rate);
                        return (
                          <tr key={item.id || i}>
                            <td className="px-4 py-2.5 text-xs text-foreground">
                              {item.description}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-foreground tabular-nums">
                              {item.quantity ?? 1}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-foreground tabular-nums">
                              {formatCurrency(rate, estimate.currency || "USD")}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium text-foreground tabular-nums">
                              {formatCurrency(amt, estimate.currency || "USD")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div className="mt-4 flex items-center justify-end gap-8">
                <div className="text-right text-xs text-muted-foreground">
                  <p>Subtotal</p>
                  <p>Tax</p>
                  <p className="mt-1 border-t border-border pt-1 text-sm font-semibold text-foreground">
                    Total
                  </p>
                </div>
                <div className="text-right text-xs tabular-nums text-foreground">
                  <p>{formatCurrency(estimate.subtotal_cents ?? 0, estimate.currency || "USD")}</p>
                  <p>{formatCurrency(estimate.tax_cents ?? 0, estimate.currency || "USD")}</p>
                  <p className="mt-1 border-t border-border pt-1 text-sm font-bold">
                    {formatCurrency(estimate.total_cents ?? 0, estimate.currency || "USD")}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar — Timeline */}
        <aside className="space-y-6">
          {/* Timeline */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Timeline
            </h2>

            <ol className="mt-4 space-y-0">
              {/* Lead scraped */}
              <TimelineEvent
                icon={<Target className="h-3.5 w-3.5" />}
                color="text-blue-400"
                bg="bg-blue-400/10"
                label="Lead scraped"
                detail={`From ${SOURCE_LABELS[lead.source] || lead.source}`}
                time={timeAgo(lead.created_at)}
              />

              {/* Estimate created */}
              {response && (
                <TimelineEvent
                  icon={<Send className="h-3.5 w-3.5" />}
                  color="text-blue-500"
                  bg="bg-blue-500/10"
                  label="Estimate created"
                  detail={response.estimate_number ? response.estimate_number : "Auto-generated"}
                  time={timeAgo(response.created_at)}
                />
              )}

              {/* Email sent */}
              {response?.status !== "pending" && (
                <TimelineEvent
                  icon={<Mail className="h-3.5 w-3.5" />}
                  color="text-success"
                  bg="bg-success/10"
                  label="Estimate sent"
                  detail={response?.client_email || lead.contact_email}
                  time={timeAgo(response?.created_at || lead.created_at)}
                />
              )}

              {/* Opened */}
              {response?.opened_at && (
                <TimelineEvent
                  icon={<Eye className="h-3.5 w-3.5" />}
                  color="text-amber-400"
                  bg="bg-amber-400/10"
                  label="Email opened"
                  detail="Customer viewed the estimate email"
                  time={timeAgo(response.opened_at)}
                />
              )}

              {/* Clicked */}
              {response?.clicked_at && (
                <TimelineEvent
                  icon={<MousePointerClick className="h-3.5 w-3.5" />}
                  color="text-success"
                  bg="bg-success/10"
                  label="Link clicked"
                  detail="Customer clicked through to the site"
                  time={timeAgo(response.clicked_at)}
                />
              )}

              {/* Won / Lost / Failed */}
              {response && ["won", "lost", "failed"].includes(response.status) && (
                <TimelineEvent
                  icon={
                    response.status === "won" ? (
                      <Trophy className="h-3.5 w-3.5" />
                    ) : response.status === "lost" ? (
                      <ThumbsDown className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )
                  }
                  color={
                    response.status === "won"
                      ? "text-amber-500"
                      : response.status === "lost"
                        ? "text-slate-400"
                        : "text-destructive"
                  }
                  bg={
                    response.status === "won"
                      ? "bg-amber-500/10"
                      : response.status === "lost"
                        ? "bg-slate-400/10"
                        : "bg-destructive/10"
                  }
                  label={
                    response.status === "won"
                      ? "Marked Won"
                      : response.status === "lost"
                        ? "Marked Lost"
                        : "Failed"
                  }
                  detail={response.error_message || undefined}
                  time={timeAgo(response.created_at)}
                />
              )}
            </ol>

            {/* Empty timeline */}
            {!response && (
              <p className="mt-4 text-xs text-muted-foreground">
                No response recorded yet. This lead hasn't been processed.
              </p>
            )}
          </div>

          {/* Tracking events */}
          {tracking.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Email Events
              </h2>
              <div className="mt-4 space-y-2">
                {tracking.map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 rounded-lg bg-surface-muted/40 p-3"
                  >
                    {t.event_type === "open" ? (
                      <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    ) : (
                      <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">
                        {t.event_type === "open" ? "Email opened" : "Link clicked"}
                      </p>
                      {t.url && (
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{t.url}</p>
                      )}
                      {t.user_agent && (
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {t.user_agent.slice(0, 80)}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Summary
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              {lead.budget_range && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Budget</dt>
                  <dd className="font-semibold text-foreground">{lead.budget_range}</dd>
                </div>
              )}
              {estimate && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Estimate</dt>
                    <dd className="font-semibold text-foreground">{estimate.estimate_number}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="font-semibold text-foreground">
                      {formatCurrency(estimate.total_cents ?? 0, estimate.currency || "USD")}
                    </dd>
                  </div>
                </>
              )}
              {response && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Response</dt>
                    <dd>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColors[response.status] || "bg-surface-muted text-muted-foreground"}`}
                      >
                        {statusLabels[response.status] || response.status}
                      </span>
                    </dd>
                  </div>
                  {response.opened_at && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Opened</dt>
                      <dd className="text-xs text-foreground">{timeAgo(response.opened_at)}</dd>
                    </div>
                  )}
                  {response.clicked_at && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Clicked</dt>
                      <dd className="text-xs text-foreground">{timeAgo(response.clicked_at)}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function TimelineEvent({
  icon,
  color,
  bg,
  label,
  detail,
  time,
}: {
  icon: React.ReactNode;
  color: string;
  bg: string;
  label: string;
  detail?: string;
  time: string;
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* Connecting line */}
      <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border last:hidden" />
      {/* Icon */}
      <div className={`z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full ${bg}`}>
        <span className={color}>{icon}</span>
      </div>
      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {detail && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{detail}</p>}
        <p className="mt-0.5 text-[10px] text-muted-foreground">{time}</p>
      </div>
    </li>
  );
}
