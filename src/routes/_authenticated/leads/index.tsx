import { createFileRoute, Link } from "@tanstack/react-router";
// The Lead Board reads schema-adaptive tables (legacy + new schema), so
// untyped row access is intentional here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { UpgradeCallout } from "@/components/app/plan-badge";
import { useSubscription } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Target,
  Mail,
  MapPin,
  Clock,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Send,
  AlertCircle,
  ChevronRight,
  Eye,
  MousePointerClick,
  MoreHorizontal,
  RotateCcw,
  Trophy,
  ThumbsDown,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/leads/")({
  head: () => ({
    meta: [{ title: "Lead Board — Honest Invoice" }, { name: "robots", content: "noindex" }],
  }),
  component: LeadBoardPage,
});

type LeadWithResponse = {
  lead_id: string;
  title: string;
  description: string;
  location: string;
  contact_email: string | null;
  contact_phone: string | null;
  budget_range: string | null;
  source: string;
  lead_status: string;
  lead_created_at: string;
  response_status: string | null;
  estimate_id: string | null;
  estimate_number: string | null;
  error_message: string | null;
  response_created_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
};

type ScrapeRunRow = {
  id: string;
  sources: string[];
  leads_found: number;
  estimates_created: number;
  emails_sent: number;
  errors: string[] | null;
  status: string;
  created_at: string;
};

const PIPELINE_STAGES = [
  { key: "new", label: "New Leads", icon: Target, color: "text-blue-400", bg: "bg-blue-400/5" },
  {
    key: "estimate_sent",
    label: "Estimate Sent",
    icon: Send,
    color: "text-blue-500",
    bg: "bg-blue-500/5",
  },
  { key: "opened", label: "Opened", icon: Eye, color: "text-amber-400", bg: "bg-amber-400/5" },
  {
    key: "clicked",
    label: "Clicked",
    icon: MousePointerClick,
    color: "text-green-500",
    bg: "bg-green-500/5",
  },
  {
    key: "failed",
    label: "Failed",
    icon: AlertCircle,
    color: "text-destructive",
    bg: "bg-destructive/5",
  },
  {
    key: "closed",
    label: "Closed",
    icon: CheckCircle2,
    color: "text-slate-400",
    bg: "bg-slate-400/10",
  },
];

const FILTER_TABS = [
  ...PIPELINE_STAGES.slice(0, 5), // New → Failed (no Closed)
  { key: "won", label: "Won", icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/5" },
  { key: "lost", label: "Lost", icon: ThumbsDown, color: "text-slate-400", bg: "bg-slate-400/5" },
  {
    key: "closed",
    label: "Closed",
    icon: CheckCircle2,
    color: "text-slate-400",
    bg: "bg-slate-400/10",
  },
];

const SOURCE_LABELS: Record<string, string> = {
  craigslist: "Craigslist",
  nextdoor: "Nextdoor",
  facebook: "Facebook",
  manual: "Manual",
};

/** Build a Craigslist search URL from a lead's location and title keywords. */
function craigslistUrl(lead: LeadWithResponse): string {
  const city = lead.location?.toLowerCase().replace(/\s+/g, "") || "atlanta";
  const keywords = encodeURIComponent(lead.title?.split(" ").slice(0, 5).join(" ") || "");
  return `https://${city}.craigslist.org/search/hva?query=${keywords}`;
}

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

function LeadBoardPage() {
  const sub = useSubscription();
  const [leads, setLeads] = useState<LeadWithResponse[]>([]);
  const [scrapeRuns, setScrapeRuns] = useState<ScrapeRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const userId = userData.user.id;
      const db = supabase as any;

      const [{ data: allLeads, error: leadsError }, { data: responses, error: respError }] =
        await Promise.all([
          db
            .from("job_leads")
            .select(
              "id, title, description, location, contact_email, contact_phone, budget_range, source, status, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(100),
          db
            .from("lead_responses")
            .select(
              "id, lead_id, estimate_id, estimate_number, client_email, status, error_message, created_at, tracking_id, opened_at, clicked_at",
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

      if (leadsError && leadsError.code !== "42703") throw leadsError;
      if (respError && respError.code !== "42703") throw respError;

      const responseByLead: Record<string, any> = {};
      for (const r of responses || []) {
        if (!responseByLead[r.lead_id]) responseByLead[r.lead_id] = r;
      }

      const transformed: LeadWithResponse[] = (allLeads || []).map((lead: any) => {
        const resp = responseByLead[lead.id];
        return {
          lead_id: lead.id,
          title: lead.title || "Untitled",
          description: lead.description || "",
          location: lead.location || "",
          contact_email: lead.contact_email ?? null,
          contact_phone: lead.contact_phone ?? null,
          budget_range: lead.budget_range ?? null,
          source: lead.source || "manual",
          lead_status: lead.status || "new",
          lead_created_at: lead.created_at,
          response_status: resp?.status ?? null,
          estimate_id: resp?.estimate_id ?? null,
          estimate_number: resp?.estimate_number ?? null,
          error_message: resp?.error_message ?? null,
          response_created_at: resp?.created_at ?? null,
          opened_at: resp?.opened_at ?? null,
          clicked_at: resp?.clicked_at ?? null,
        };
      });

      setLeads(transformed);

      const { data: runs, error: runsError } = await db
        .from("scrape_runs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!runsError) {
        setScrapeRuns((runs || []) as ScrapeRunRow[]);
      }

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setRefreshing(true);
      fetchData();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  function handleRefresh() {
    setRefreshing(true);
    fetchData();
  }

  // ── Action handlers ──────────────────────────────────────────

  async function handleResend(lead: LeadWithResponse) {
    if (!lead.estimate_id || !lead.contact_email) return;
    setActionLoading(lead.lead_id);
    setOpenMenuId(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      // Auto-approve the estimate first (lead estimates are drafts)
      const db = supabase as any;
      const [{ data: est }] = await Promise.all([
        db.from("estimates").select("id, approved_at").eq("id", lead.estimate_id).maybeSingle(),
      ]);

      if (est && !est.approved_at) {
        // Try new schema first, fall back to legacy
        const { error: approveErr } = await db
          .from("estimates")
          .update({ approved_at: new Date().toISOString() })
          .eq("id", lead.estimate_id);

        if (approveErr && (approveErr.code === "42P01" || approveErr.code === "PGRST205")) {
          // Legacy schema — estimates live in invoices table
          const { error: legacyApproveErr } = await db
            .from("invoices")
            .update({ status: "approved" })
            .eq("id", lead.estimate_id)
            .eq("type", "estimate");
          if (legacyApproveErr) throw legacyApproveErr;
        } else if (approveErr) {
          // 42703 means column doesn't exist — likely legacy
          if (approveErr.code !== "42703") throw approveErr;
        }
      }

      const res = await fetch("/api/mcp/documents/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_id: lead.estimate_id,
          document_type: "estimate",
          to_email: lead.contact_email,
          custom_message: `Following up on our estimate ${lead.estimate_number} for "${lead.title}". Reply to discuss!`,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error || `Send failed (${res.status})`);
      }
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to re-send");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkStatus(lead: LeadWithResponse, status: string) {
    if (!lead.response_status) return;
    setActionLoading(lead.lead_id);
    setOpenMenuId(null);
    try {
      const db = supabase as any;
      const { error: updateErr } = await db
        .from("lead_responses")
        .update({ status })
        .eq("lead_id", lead.lead_id);

      if (updateErr) throw updateErr;
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(lead: LeadWithResponse) {
    if (!lead.response_status) return;
    setActionLoading(lead.lead_id);
    setOpenMenuId(null);
    try {
      const db = supabase as any;
      const { error: deleteErr } = await db
        .from("lead_responses")
        .delete()
        .eq("lead_id", lead.lead_id);

      if (deleteErr) throw deleteErr;
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setActionLoading(null);
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    function close() {
      setOpenMenuId(null);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  // ── Stats ────────────────────────────────────────────────────

  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.response_status === null).length;
  const estimatesSent = leads.filter((l) => l.response_status === "estimate_sent").length;
  const openedCount = leads.filter((l) => l.response_status === "opened" || !!l.opened_at).length;
  const clickedCount = leads.filter(
    (l) => l.response_status === "clicked" || !!l.clicked_at,
  ).length;
  const wonCount = leads.filter((l) => l.response_status === "won").length;
  const lostCount = leads.filter((l) => l.response_status === "lost").length;
  const failedCount = leads.filter((l) => l.response_status === "failed").length;
  const engagementRate = estimatesSent > 0 ? Math.round((openedCount / estimatesSent) * 100) : 0;

  const stageCounts: Record<string, number> = {
    new: newLeads,
    estimate_sent: estimatesSent,
    opened: openedCount,
    clicked: clickedCount,
    failed: failedCount,
    won: wonCount,
    lost: lostCount,
    closed: wonCount + lostCount,
  };

  const filteredLeads = (() => {
    if (activeStage === "all") return leads;
    if (activeStage === "new") return leads.filter((l) => !l.response_status);
    if (activeStage === "opened")
      return leads.filter(
        (l) =>
          l.response_status === "opened" ||
          (l.response_status === "estimate_sent" && !!l.opened_at),
      );
    if (activeStage === "clicked")
      return leads.filter((l) => l.response_status === "clicked" || !!l.clicked_at);
    if (activeStage === "closed")
      return leads.filter((l) => l.response_status === "won" || l.response_status === "lost");
    return leads.filter((l) => l.response_status === activeStage);
  })();

  if (loading) {
    return (
      <AppShell title="Lead Board">
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!sub.loading && sub.plan === "free") {
    return (
      <AppShell title="Lead Board">
        <div className="max-w-xl">
          <UpgradeCallout feature="Lead Gen Engine" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Lead Board">
      {/* Stats row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Leads", value: totalLeads, icon: Target, color: "text-blue-400" },
          { label: "New", value: newLeads, icon: Clock, color: "text-amber-400" },
          { label: "Won", value: wonCount, icon: Trophy, color: "text-amber-500" },
          { label: "Open Rate", value: `${engagementRate}%`, icon: Eye, color: "text-accent" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-surface p-5 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </span>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="mt-2 font-display text-3xl text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Refresh + filter row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveStage("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeStage === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-surface-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({totalLeads})
          </button>
          {FILTER_TABS.map((stage) => (
            <button
              key={stage.key}
              onClick={() => setActiveStage(stage.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeStage === stage.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <stage.icon className="h-3.5 w-3.5" />
              {stage.label} ({stageCounts[stage.key] || 0})
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mr-2 inline-block h-4 w-4" />
          {error}
        </div>
      )}

      {/* Pipeline columns */}
      <div className="grid gap-6 lg:grid-cols-6">
        {PIPELINE_STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => {
            if (stage.key === "new") return !l.response_status;
            if (stage.key === "opened")
              return (
                l.response_status === "opened" ||
                (l.response_status === "estimate_sent" && !!l.opened_at)
              );
            if (stage.key === "clicked") return l.response_status === "clicked" || !!l.clicked_at;
            if (stage.key === "closed")
              return l.response_status === "won" || l.response_status === "lost";
            return l.response_status === stage.key;
          });

          if (activeStage !== "all" && activeStage !== stage.key) return null;

          const leadsToShow = activeStage === "all" ? stageLeads : filteredLeads;

          return (
            <div key={stage.key} className="flex flex-col">
              <div className={`mb-3 flex items-center gap-2 rounded-xl ${stage.bg} px-4 py-3`}>
                <stage.icon className={`h-4 w-4 ${stage.color}`} />
                <span className="text-sm font-semibold text-foreground">{stage.label}</span>
                <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {leadsToShow.length}
                </span>
              </div>
              <div className="flex-1 space-y-3">
                {leadsToShow.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border bg-surface-muted/30 p-6 text-center">
                    <p className="text-xs text-muted-foreground">No leads in this stage</p>
                  </div>
                )}
                {leadsToShow.map((lead, i) => {
                  const isBusy = actionLoading === lead.lead_id;
                  const showActions =
                    lead.response_status &&
                    !["won", "lost", "failed"].includes(lead.response_status);
                  const menuOpen = openMenuId === lead.lead_id;

                  return (
                    <div
                      key={lead.lead_id || i}
                      className="group relative rounded-xl border border-border bg-surface p-4 shadow-soft transition-shadow hover:shadow-lifted"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/leads/$id"
                          params={{ id: lead.lead_id }}
                          className="text-sm font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors"
                        >
                          {lead.title}
                        </Link>
                        <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                          {SOURCE_LABELS[lead.source] || lead.source}
                        </span>
                      </div>

                      {lead.budget_range && (
                        <p className="mt-1 text-xs font-medium text-accent">{lead.budget_range}</p>
                      )}

                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {lead.description}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {lead.location}
                        </span>
                        {lead.contact_email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {lead.contact_email}
                          </span>
                        )}
                      </div>

                      {/* Estimate info */}
                      {lead.estimate_number && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/5 px-3 py-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="text-xs font-medium text-success">
                            {lead.estimate_number}
                          </span>
                          {lead.estimate_id && (
                            <Link
                              to="/estimates/$id"
                              params={{ id: lead.estimate_id }}
                              className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              View <ChevronRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      )}

                      {/* Tracking badges */}
                      {(lead.opened_at || lead.clicked_at) && (
                        <div className="mt-3 flex items-center gap-2">
                          {lead.opened_at && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                              <Eye className="h-3 w-3" />
                              Opened {timeAgo(lead.opened_at)}
                            </span>
                          )}
                          {lead.clicked_at && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                              <MousePointerClick className="h-3 w-3" />
                              Clicked {timeAgo(lead.clicked_at)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Error info */}
                      {lead.error_message && (
                        <div className="mt-3 rounded-lg bg-destructive/5 px-3 py-2">
                          <div className="flex items-start gap-1.5">
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                            <p className="text-[11px] text-destructive line-clamp-2">
                              {lead.error_message}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* External link */}
                      {lead.source === "craigslist" && (
                        <div className="mt-3 border-t border-border pt-3">
                          <a
                            href={craigslistUrl(lead)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" /> View on Craigslist
                          </a>
                        </div>
                      )}

                      <p className="mt-3 text-[10px] text-muted-foreground">
                        <Clock className="mr-1 inline-block h-3 w-3" />
                        {timeAgo(lead.lead_created_at)}
                      </p>

                      {/* ── Action buttons ────────────────────────── */}
                      {showActions && (
                        <div className="mt-3 flex items-center gap-1 border-t border-border pt-3 relative">
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResend(lead);
                                }}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
                                title="Re-send estimate"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Re-send
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(menuOpen ? null : lead.lead_id);
                                }}
                                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
                                title="More actions"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>

                              {menuOpen && (
                                <div
                                  className="absolute bottom-full right-0 z-20 mb-1 w-36 rounded-xl border border-border bg-surface p-1 shadow-lifted"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => handleMarkStatus(lead, "won")}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium text-foreground hover:bg-amber-500/10 hover:text-amber-500 transition-colors"
                                  >
                                    <Trophy className="h-3.5 w-3.5" />
                                    Mark Won
                                  </button>
                                  <button
                                    onClick={() => handleMarkStatus(lead, "lost")}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium text-foreground hover:bg-slate-400/10 hover:text-slate-400 transition-colors"
                                  >
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                    Mark Lost
                                  </button>
                                  <div className="my-1 border-t border-border" />
                                  <button
                                    onClick={() => handleDelete(lead)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrape runs */}
      {scrapeRuns.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl text-foreground">Recent Scrape Runs</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Time</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Sources</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Leads</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                    Estimates
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Emails</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scrapeRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-surface-muted/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {timeAgo(run.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {(run.sources || []).map((s) => SOURCE_LABELS[s] || s).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {run.leads_found}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-success">
                      {run.estimates_created}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-accent-foreground">
                      {run.emails_sent}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          run.status === "completed"
                            ? "bg-success/10 text-success"
                            : run.status === "failed"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-400/10 text-amber-400"
                        }`}
                      >
                        {run.status === "completed" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : run.status === "failed" ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        )}
                        {run.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalLeads === 0 && !loading && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-12 text-center shadow-soft">
          <Target className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-4 font-display text-xl text-foreground">No leads yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Leads will appear here when your scraping cron job finds matching posts on Craigslist,
            Nextdoor, or Facebook. Each lead gets an AI-generated estimate automatically.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/mcp"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Set up MCP <ChevronRight className="h-4 w-4" />
            </Link>
            <a
              href="https://console.cron-job.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground"
            >
              Configure cron job <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </AppShell>
  );
}
