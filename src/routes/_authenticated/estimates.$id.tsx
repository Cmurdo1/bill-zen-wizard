import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { LineItemsEditor } from "@/components/app/line-items-editor";
import {
  ESTIMATE_STATUSES,
  StatusPill,
  computeTotals,
  type LineItem,
  type EstimateStatus,
} from "@/lib/documents";
import { ArrowLeft, Loader2, Save, Send, FileCheck, Trash2, ArrowRightCircle } from "lucide-react";
import { logActivity, fetchActivity, type ActivityRow } from "@/lib/activity";
import { EstimateAiPanel } from "@/components/app/estimate-ai-panel";
import { useServerFn } from "@tanstack/react-start";
import { sendEstimateEmail } from "@/lib/estimates.functions";
import { useSubscription } from "@/lib/subscription";
import { CheckCircle2, Mail, Eye } from "lucide-react";
import { InvoicePreviewModal } from "@/components/app/invoice-preview-modal";
import type { PrintInvoiceInput } from "@/lib/print-invoice";
import { fetchDocumentBranding } from "@/lib/branding";


type Estimate = {
  id: string;
  estimate_number: string;
  status: string;
  client_id: string | null;
  issue_date: string;
  expiry_date: string | null;
  notes: string | null;
  tax_rate: number;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  converted_at?: string | null;
  converted_invoice_id?: string | null;
  job_description?: string | null;
  approved_at?: string | null;
  sent_at?: string | null;
  sent_to_email?: string | null;
};
type Client = { id: string; name: string; email: string | null };

export const Route = createFileRoute("/_authenticated/estimates/$id")({
  head: () => ({ meta: [{ title: "Estimate — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: EstimateDetailPage,
});

function EstimateDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const { canUseAI, plan } = useSubscription();
  const sendEmail = useServerFn(sendEstimateEmail);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => { void load(); void fetchActivity("estimate", id).then(setActivity); }, [id]);

  async function load() {
    setLoading(true);
    const [estRes, itemsRes, cliRes] = await Promise.all([
      supabase.from("estimates").select("*").eq("id", id).maybeSingle(),
      supabase.from("estimate_items").select("description,quantity,rate_cents,sort_order").eq("estimate_id", id).order("sort_order"),
      supabase.from("clients").select("id,name,email").order("name"),
    ]);
    if (!estRes.data) {
      setError("Estimate not found");
      setLoading(false);
      return;
    }
    setEstimate(estRes.data as Estimate);
    setItems(((itemsRes.data as LineItem[]) ?? []).length ? (itemsRes.data as LineItem[]) : [{ description: "", quantity: 1, rate_cents: 0 }]);
    setClients((cliRes.data as Client[]) ?? []);
    setLoading(false);
  }

  async function save(overrides: Partial<Estimate> = {}) {
    if (!estimate) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const validItems = items.filter((i) => i.description.trim());
      const { subtotal, tax, total } = computeTotals(validItems, estimate.tax_rate || 0);
      const patch = {
        client_id: estimate.client_id,
        issue_date: estimate.issue_date,
        expiry_date: estimate.expiry_date,
        notes: estimate.notes,
        job_description: estimate.job_description ?? null,
        tax_rate: estimate.tax_rate,
        subtotal_cents: subtotal,
        tax_cents: tax,
        total_cents: total,
        currency: estimate.currency,
        status: estimate.status,
        ...overrides,
      };
      const { error: uErr } = await supabase.from("estimates").update(patch).eq("id", estimate.id);
      if (uErr) throw uErr;

      const { error: dErr } = await supabase.from("estimate_items").delete().eq("estimate_id", estimate.id);
      if (dErr) throw dErr;
      if (validItems.length) {
        const rows = validItems.map((it, i) => ({
          estimate_id: estimate.id,
          description: it.description,
          quantity: it.quantity,
          rate_cents: it.rate_cents,
          amount_cents: Math.round(it.quantity * it.rate_cents),
          sort_order: i,
        }));
        const { error: iErr } = await supabase.from("estimate_items").insert(rows);
        if (iErr) throw iErr;
      }
      setEstimate({ ...estimate, ...patch });
      setMsg("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(next: EstimateStatus) {
    if (!estimate) return;
    const prev = estimate.status;
    await save({ status: next });
    if (prev !== next) {
      await logActivity("estimate", estimate.id, `status:${next}`, `Changed from ${prev} to ${next}`);
      setActivity(await fetchActivity("estimate", estimate.id));
    }
  }

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertIssue, setConvertIssue] = useState(() => new Date().toISOString().slice(0, 10));
  const [convertDue, setConvertDue] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); });
  const [convertCurrency, setConvertCurrency] = useState("USD");

  function openConvert() {
    if (!estimate) return;
    setConvertIssue(new Date().toISOString().slice(0, 10));
    const d = new Date(); d.setDate(d.getDate() + 30);
    setConvertDue(d.toISOString().slice(0, 10));
    setConvertCurrency(estimate.currency || "USD");
    setConvertOpen(true);
  }

  async function convertToInvoice() {
    if (!estimate) return;
    setError(null);
    // Validation
    if (!convertIssue) { setError("Issue date is required."); return; }
    if (!convertDue) { setError("Due date is required."); return; }
    if (new Date(convertDue) < new Date(convertIssue)) { setError("Due date must be on or after the issue date."); return; }
    const cur = convertCurrency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) { setError("Currency must be a 3-letter code (e.g. USD)."); return; }
    const validItems = items.filter((i) => i.description.trim());
    if (!validItems.length) { setError("Add at least one line item before converting."); return; }

    setConverting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Prevent double-convert: re-check server state
      const { data: fresh } = await supabase.from("estimates").select("converted_invoice_id,status").eq("id", estimate.id).maybeSingle();
      const freshRow = fresh as { converted_invoice_id: string | null; status: string } | null;
      if (freshRow?.converted_invoice_id) {
        setError("This estimate has already been converted.");
        setConvertOpen(false);
        navigate({ to: "/invoices/$id", params: { id: freshRow.converted_invoice_id } });
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("invoice_prefix,next_invoice_number").eq("id", user.id).maybeSingle();
      const prefix = profile?.invoice_prefix ?? "INV";
      const num = profile?.next_invoice_number ?? 1001;

      const { data: inv, error: iErr } = await supabase.from("invoices").insert({
        user_id: user.id,
        client_id: estimate.client_id,
        invoice_number: `${prefix}-${num}`,
        status: "draft",
        issue_date: convertIssue,
        due_date: convertDue,
        subtotal_cents: estimate.subtotal_cents,
        tax_rate: estimate.tax_rate,
        tax_cents: estimate.tax_cents,
        total_cents: estimate.total_cents,
        currency: cur,
        notes: estimate.notes,
      }).select("id").single();
      if (iErr) throw iErr;

      if (inv) {
        await supabase.from("invoice_items").insert(validItems.map((it, i) => ({
          invoice_id: inv.id,
          description: it.description,
          quantity: it.quantity,
          rate_cents: it.rate_cents,
          amount_cents: Math.round(it.quantity * it.rate_cents),
          sort_order: i,
        })));
        await supabase.from("profiles").upsert({ id: user.id, next_invoice_number: num + 1 });
        await supabase.from("estimates").update({
          status: "converted",
          converted_at: new Date().toISOString(),
          converted_invoice_id: inv.id,
        }).eq("id", estimate.id);
        await logActivity("estimate", estimate.id, "converted", `Created invoice ${prefix}-${num}`);
        await logActivity("invoice", inv.id, "created", `Converted from estimate ${estimate.estimate_number}`);
        setConvertOpen(false);
        navigate({ to: "/invoices/$id", params: { id: inv.id } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not convert");
    } finally {
      setConverting(false);
    }
  }

  async function approve() {
    if (!estimate) return;
    setApproving(true);
    setError(null);
    try {
      await save();
      const stamp = new Date().toISOString();
      const { error: aErr } = await supabase.from("estimates").update({ approved_at: stamp }).eq("id", estimate.id);
      if (aErr) throw aErr;
      setEstimate({ ...estimate, approved_at: stamp });
      await logActivity("estimate", estimate.id, "approved", "Approved by owner, ready to send");
      setActivity(await fetchActivity("estimate", estimate.id));
      setMsg("Approved — ready to send to the client.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setApproving(false);
    }
  }

  function openSend() {
    if (!estimate) return;
    const client = clients.find((c) => c.id === estimate.client_id);
    setSendTo(estimate.sent_to_email ?? client?.email ?? "");
    setSendMessage("");
    setSendOpen(true);
  }

  async function doSend() {
    if (!estimate) return;
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sendTo.trim())) { setError("Enter a valid client email."); return; }
    setSending(true);
    try {
      await sendEmail({ data: { estimateId: estimate.id, to: sendTo.trim(), message: sendMessage.trim() || undefined } });
      const stamp = new Date().toISOString();
      setEstimate({ ...estimate, status: "sent", sent_at: stamp, sent_to_email: sendTo.trim() });
      await logActivity("estimate", estimate.id, "emailed", `Sent to ${sendTo.trim()}`);
      setActivity(await fetchActivity("estimate", estimate.id));
      setSendOpen(false);
      setMsg(`Estimate emailed to ${sendTo.trim()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send estimate");
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    if (!estimate) return;
    if (!confirm("Delete this estimate? This can't be undone.")) return;
    await supabase.from("estimates").delete().eq("id", estimate.id);
    navigate({ to: "/estimates" });
  }

  if (loading) {
    return (
      <AppShell title="Estimate">
        <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      </AppShell>
    );
  }
  if (!estimate) {
    return (
      <AppShell title="Estimate">
        <p className="text-muted-foreground">{error ?? "Estimate not found."}</p>
        <Link to="/estimates" className="mt-4 inline-flex text-sm text-primary hover:underline">← Back to estimates</Link>
      </AppShell>
    );
  }

  const { subtotal, tax, total } = computeTotals(items.filter((i) => i.description.trim()), estimate.tax_rate || 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/estimates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All estimates
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={remove} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-destructive hover:bg-destructive/5">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          {estimate.status === "draft" && (
            <button onClick={() => updateStatus("sent")} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-muted">
              <Send className="h-3.5 w-3.5" /> Mark sent
            </button>
          )}
          {(estimate.status === "sent" || estimate.status === "draft") && (
            <button onClick={() => updateStatus("accepted")} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-semibold text-success-foreground hover:opacity-90">
              <FileCheck className="h-3.5 w-3.5" /> Mark accepted
            </button>
          )}
          {estimate.status !== "converted" && !estimate.converted_invoice_id && (
            <button onClick={openConvert} disabled={converting} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60">
              {converting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightCircle className="h-3.5 w-3.5" />} Convert to invoice
            </button>
          )}
          {estimate.converted_invoice_id && (
            <Link
              to="/invoices/$id"
              params={{ id: estimate.converted_invoice_id }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-muted"
            >
              <ArrowRightCircle className="h-3.5 w-3.5" /> View invoice
            </Link>
          )}
          {!estimate.approved_at && (
            <button onClick={approve} disabled={approving || saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-success bg-success/10 px-3 text-xs font-semibold text-success hover:bg-success/20 disabled:opacity-60">
              {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve
            </button>
          )}
          {estimate.approved_at && (
            <button onClick={openSend} disabled={sending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60">
              <Mail className="h-3.5 w-3.5" /> {estimate.sent_at ? "Resend to client" : "Send to client"}
            </button>
          )}
          <button onClick={() => save()} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl tracking-tight text-foreground">{estimate.estimate_number}</h1>
          <StatusPill status={estimate.status} />
        </div>
        <select
          value={estimate.status}
          onChange={(e) => updateStatus(e.target.value as EstimateStatus)}
          disabled={saving}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-semibold capitalize"
        >
          {ESTIMATE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Details</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Client">
                <select
                  value={estimate.client_id ?? ""}
                  onChange={(e) => setEstimate({ ...estimate, client_id: e.target.value || null })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">— No client —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Currency">
                <input
                  value={estimate.currency}
                  onChange={(e) => setEstimate({ ...estimate, currency: e.target.value.toUpperCase() })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Issue date">
                <input
                  type="date"
                  value={estimate.issue_date.slice(0, 10)}
                  onChange={(e) => setEstimate({ ...estimate, issue_date: e.target.value })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Expires">
                <input
                  type="date"
                  value={estimate.expiry_date?.slice(0, 10) ?? ""}
                  onChange={(e) => setEstimate({ ...estimate, expiry_date: e.target.value || null })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
            </div>
          </section>

          <EstimateAiPanel
            estimateId={estimate.id}
            currency={estimate.currency || "USD"}
            description={estimate.job_description ?? ""}
            onDescriptionChange={(v) => setEstimate({ ...estimate, job_description: v })}
            onItems={(next) => setItems(next.length ? next : [{ description: "", quantity: 1, rate_cents: 0 }])}
            canUseAI={canUseAI}
          />

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Line items</h2>
            <div className="mt-4">
              <LineItemsEditor items={items} onChange={setItems} currency={estimate.currency} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Scope / Notes</h2>
            <textarea
              value={estimate.notes ?? ""}
              onChange={(e) => setEstimate({ ...estimate, notes: e.target.value })}
              rows={4}
              className="mt-3 block w-full rounded-lg border border-border bg-background p-3 text-sm"
              placeholder="Scope of work, assumptions, exclusions…"
            />
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Totals</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(subtotal, estimate.currency)} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax rate</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={(estimate.tax_rate * 100).toFixed(2)}
                    onChange={(e) => setEstimate({ ...estimate, tax_rate: Number(e.target.value) / 100 })}
                    className="h-8 w-20 rounded-md border border-border bg-background px-2 text-right text-xs"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <Row label="Tax" value={formatCurrency(tax, estimate.currency)} />
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total, estimate.currency)}</span>
              </div>
            </dl>
          </div>

          {msg && <p className="rounded-lg bg-success/10 px-3 py-2 text-xs font-semibold text-success">{msg}</p>}
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Activity</h2>
            {activity.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="mt-3 space-y-2 text-xs">
                {activity.map((a) => (
                  <li key={a.id} className="border-l-2 border-border pl-3">
                    <div className="font-semibold text-foreground">{a.action}</div>
                    {a.detail && <div className="text-muted-foreground">{a.detail}</div>}
                    <div className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>

      {sendOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !sending && setSendOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl">Send estimate to client</h3>
            <p className="mt-1 text-sm text-muted-foreground">You approved this estimate — it will be emailed exactly as shown.</p>
            <div className="mt-4 grid gap-3">
              <Field label="Client email">
                <input type="email" value={sendTo} onChange={(e) => setSendTo(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
              </Field>
              <Field label="Message (optional)">
                <textarea value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-lg border border-border bg-background p-3 text-sm" />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setSendOpen(false)} disabled={sending} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-surface-muted">Cancel</button>
              <button onClick={doSend} disabled={sending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Send estimate
              </button>
            </div>
          </div>
        </div>
      )}

      {convertOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !converting && setConvertOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl">Convert to invoice</h3>
            <p className="mt-1 text-sm text-muted-foreground">Choose the details for the new draft invoice.</p>
            <div className="mt-4 grid gap-3">
              <Field label="Issue date">
                <input type="date" value={convertIssue} onChange={(e) => setConvertIssue(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
              </Field>
              <Field label="Due date">
                <input type="date" value={convertDue} onChange={(e) => setConvertDue(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
              </Field>
              <Field label="Currency">
                <input value={convertCurrency} onChange={(e) => setConvertCurrency(e.target.value.toUpperCase())} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConvertOpen(false)} disabled={converting} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-surface-muted">Cancel</button>
              <button onClick={convertToInvoice} disabled={converting} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
                {converting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightCircle className="h-3.5 w-3.5" />} Create invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>

  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
