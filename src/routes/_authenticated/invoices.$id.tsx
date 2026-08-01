import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { LineItemsEditor } from "@/components/app/line-items-editor";
import { InvoicePreviewModal } from "@/components/app/invoice-preview-modal";
import { logActivity, fetchActivity, type ActivityRow } from "@/lib/activity";
import type { PrintInvoiceInput } from "@/lib/print-invoice";
import { fetchDocumentBranding } from "@/lib/branding";
import { useSubscription } from "@/lib/subscription";

import {
  INVOICE_STATUSES,
  StatusPill,
  computeTotals,
  type LineItem,
  type InvoiceStatus,
} from "@/lib/documents";
import { ArrowLeft, Loader2, Save, Send, CheckCircle2, Trash2, Eye } from "lucide-react";

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  client_id: string | null;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  tax_rate: number;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  paid_at: string | null;
  payment_link_token: string;
};
type Client = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PrintInvoiceInput | null>(null);

  useEffect(() => { void load(); void fetchActivity("invoice", id).then(setActivity); }, [id]);

  async function load() {
    setLoading(true);
    const [invRes, itemsRes, cliRes] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
      supabase.from("invoice_items").select("description,quantity,rate_cents,sort_order").eq("invoice_id", id).order("sort_order"),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    if (!invRes.data) {
      setError("Invoice not found");
      setLoading(false);
      return;
    }
    setInvoice(invRes.data as Invoice);
    setItems(((itemsRes.data as LineItem[]) ?? []).length ? (itemsRes.data as LineItem[]) : [{ description: "", quantity: 1, rate_cents: 0 }]);
    setClients((cliRes.data as Client[]) ?? []);
    setLoading(false);
  }

  async function save(overrides: Partial<Invoice> = {}) {
    if (!invoice) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const validItems = items.filter((i) => i.description.trim());
      const { subtotal, tax, total } = computeTotals(validItems, invoice.tax_rate || 0);
      const patch = {
        client_id: invoice.client_id,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        notes: invoice.notes,
        tax_rate: invoice.tax_rate,
        subtotal_cents: subtotal,
        tax_cents: tax,
        total_cents: total,
        currency: invoice.currency,
        status: invoice.status,
        ...overrides,
      };
      const { error: uErr } = await supabase.from("invoices").update(patch).eq("id", invoice.id);
      if (uErr) throw uErr;

      const { error: dErr } = await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);
      if (dErr) throw dErr;
      if (validItems.length) {
        const rows = validItems.map((it, i) => ({
          invoice_id: invoice.id,
          description: it.description,
          quantity: it.quantity,
          rate_cents: it.rate_cents,
          amount_cents: Math.round(it.quantity * it.rate_cents),
          sort_order: i,
        }));
        const { error: iErr } = await supabase.from("invoice_items").insert(rows);
        if (iErr) throw iErr;
      }
      setInvoice({ ...invoice, ...patch });
      setMsg("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(next: InvoiceStatus) {
    if (!invoice) return;
    const prev = invoice.status;
    const overrides: Partial<Invoice> = { status: next };
    if (next === "paid" && !invoice.paid_at) overrides.paid_at = new Date().toISOString();
    if (next !== "paid") overrides.paid_at = null;
    await save(overrides);
    if (prev !== next) {
      await logActivity("invoice", invoice.id, `status:${next}`, `Changed from ${prev} to ${next}`);
      setActivity(await fetchActivity("invoice", invoice.id));
    }
  }

  async function remove() {
    if (!invoice) return;
    if (!confirm("Delete this invoice? This can't be undone.")) return;
    await supabase.from("invoices").delete().eq("id", invoice.id);
    navigate({ to: "/invoices" });
  }

  async function openPreview() {
    if (!invoice) return;
    const [clientRes, profRes] = await Promise.all([
      invoice.client_id
        ? supabase.from("clients").select("name,email,address_line1,address_line2,city,state,postal_code,country").eq("id", invoice.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("profiles").select("company_name,full_name,address_line1,address_line2,city,state,postal_code,country").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle(),
    ]);
    const p = profRes.data as { company_name?: string | null; full_name?: string | null; address_line1?: string | null; address_line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null } | null;
    const business_address = p
      ? [p.address_line1, p.address_line2, [p.city, p.state, p.postal_code].filter(Boolean).join(", "), p.country].filter(Boolean).join("\n")
      : "";
    setPreviewData({
      ...invoice,
      items: items.filter((i) => i.description.trim()),
      client: clientRes.data,
      business: { company_name: p?.company_name, full_name: p?.full_name, business_address },
    });
    setPreviewOpen(true);
  }

  if (loading) {
    return (
      <AppShell title="Invoice">
        <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      </AppShell>
    );
  }
  if (!invoice) {
    return (
      <AppShell title="Invoice">
        <p className="text-muted-foreground">{error ?? "Invoice not found."}</p>
        <Link to="/invoices" className="mt-4 inline-flex text-sm text-primary hover:underline">← Back to invoices</Link>
      </AppShell>
    );
  }

  const { subtotal, tax, total } = computeTotals(items.filter((i) => i.description.trim()), invoice.tax_rate || 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All invoices
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={remove} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-destructive hover:bg-destructive/5">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={openPreview} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-muted">
            <Eye className="h-3.5 w-3.5" /> Preview / PDF
          </button>
          {invoice.status === "draft" && (
            <button onClick={() => updateStatus("sent")} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-muted">
              <Send className="h-3.5 w-3.5" /> Mark sent
            </button>
          )}
          {invoice.status !== "paid" && invoice.status !== "void" && (
            <button onClick={() => updateStatus("paid")} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-semibold text-success-foreground hover:opacity-90">
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark paid
            </button>
          )}
          <button onClick={() => save()} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl tracking-tight text-foreground">{invoice.invoice_number}</h1>
            <StatusPill status={invoice.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Payment link token: <code className="rounded bg-surface-muted px-1.5 py-0.5">{invoice.payment_link_token}</code>
          </p>
        </div>
        <select
          value={invoice.status}
          onChange={(e) => updateStatus(e.target.value as InvoiceStatus)}
          disabled={saving}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-semibold capitalize"
        >
          {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Details</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Client">
                <select
                  value={invoice.client_id ?? ""}
                  onChange={(e) => setInvoice({ ...invoice, client_id: e.target.value || null })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">— No client —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Currency">
                <input
                  value={invoice.currency}
                  onChange={(e) => setInvoice({ ...invoice, currency: e.target.value.toUpperCase() })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Issue date">
                <input
                  type="date"
                  value={invoice.issue_date.slice(0, 10)}
                  onChange={(e) => setInvoice({ ...invoice, issue_date: e.target.value })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  value={invoice.due_date?.slice(0, 10) ?? ""}
                  onChange={(e) => setInvoice({ ...invoice, due_date: e.target.value || null })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Line items</h2>
            <div className="mt-4">
              <LineItemsEditor items={items} onChange={setItems} currency={invoice.currency} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Notes</h2>
            <textarea
              value={invoice.notes ?? ""}
              onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
              rows={4}
              className="mt-3 block w-full rounded-lg border border-border bg-background p-3 text-sm"
              placeholder="Payment terms, thank-you note, etc."
            />
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Totals</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(subtotal, invoice.currency)} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax rate</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={(invoice.tax_rate * 100).toFixed(2)}
                    onChange={(e) => setInvoice({ ...invoice, tax_rate: Number(e.target.value) / 100 })}
                    className="h-8 w-20 rounded-md border border-border bg-background px-2 text-right text-xs"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <Row label="Tax" value={formatCurrency(tax, invoice.currency)} />
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total, invoice.currency)}</span>
              </div>
            </dl>
            {invoice.paid_at && (
              <p className="mt-3 text-xs text-success">Paid on {new Date(invoice.paid_at).toLocaleString()}</p>
            )}
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

      <InvoicePreviewModal open={previewOpen} invoice={previewData} onClose={() => setPreviewOpen(false)} />
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
