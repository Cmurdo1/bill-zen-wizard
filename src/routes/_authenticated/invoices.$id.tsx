import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { LineItemsEditor } from "@/components/app/line-items-editor";
import { InvoicePreviewModal } from "@/components/app/invoice-preview-modal";
import { logActivity, fetchActivity, type ActivityRow } from "@/lib/activity";
import type { PrintInvoiceInput } from "@/lib/print-invoice";
import {
  INVOICE_STATUSES,
  StatusPill,
  computeTotals,
  type LineItem,
  type InvoiceStatus,
} from "@/lib/documents";
import { useServerFn } from "@tanstack/react-start";
import { sendInvoiceEmail } from "@/lib/invoices.functions";
import { useSubscription } from "@/lib/subscription";
import { downloadBrandedInvoicePdf } from "@/lib/pdf-invoice";
import { fetchDocumentBranding } from "@/lib/document-branding";
import {
  fetchBusinessName,
  fetchInvoice,
  fetchInvoiceItems,
  isLegacyInvoiceSchema,
  replaceInvoiceItems,
  updateInvoiceRecord,
  type UnifiedInvoice,
} from "@/lib/invoice-schema";
import {
  ArrowLeft,
  Loader2,
  Save,
  Send,
  CheckCircle2,
  Trash2,
  Eye,
  Mail,
  Link as LinkIcon,
  Copy,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Invoice = UnifiedInvoice;
type Client = { id: string; name: string; email: string | null };

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({
    meta: [{ title: "Invoice — Honest Invoice" }, { name: "robots", content: "noindex" }],
  }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [legacy, setLegacy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PrintInvoiceInput | null>(null);
  const [sendAsEstimate, setSendAsEstimate] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const { isActive: subscribed } = useSubscription();
  const sendEmail = useServerFn(sendInvoiceEmail);

  useEffect(() => {
    void load();
    void fetchActivity("invoice", id).then(setActivity);
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      setLegacy(await isLegacyInvoiceSchema());
      const [inv, invItems, cliRes] = await Promise.all([
        fetchInvoice(id),
        fetchInvoiceItems(id),
        supabase.from("clients").select("id,name").order("name"),
      ]);
      if (!inv) {
        setError("Invoice not found");
        return;
      }
      setInvoice(inv);
      setItems(invItems.length ? invItems : [{ description: "", quantity: 1, rate_cents: 0 }]);
      setClients((cliRes.data as Client[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invoice");
    } finally {
      setLoading(false);
    }
  }

  async function save(overrides: Partial<Invoice> = {}) {
    if (!invoice) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const validItems = items.filter((i) => i.description.trim());
      const { subtotal, tax, total } = computeTotals(validItems, invoice.tax_rate || 0);
      await updateInvoiceRecord(invoice.id, {
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
      });
      await replaceInvoiceItems(invoice.id, validItems);
      setInvoice({
        ...invoice,
        ...overrides,
        subtotal_cents: subtotal,
        tax_cents: tax,
        total_cents: total,
      });
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
    // Legacy schema has no paid_at column — keep it in memory only there.
    if (!legacy) {
      if (next === "paid" && !invoice.paid_at) overrides.paid_at = new Date().toISOString();
      if (next !== "paid") overrides.paid_at = null;
    }
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

  const handleExportPDF = async () => {
    if (!subscribed) {
      toast.error("PDF export is a Pro feature. Upgrade to export invoices.");
      return;
    }
    if (!invoice) return;

    try {
      const branding = await fetchDocumentBranding(invoice.client_id);
      await downloadBrandedInvoicePdf({
        ...invoice,
        items: items.filter((i) => i.description.trim()),
        ...branding,
        documentType: "invoice",
      });
      toast.success(`${sendAsEstimate ? "Estimate" : "Invoice"} PDF exported successfully!`);
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    }
  };

  const handleSendEmail = async () => {
    if (!subscribed) {
      toast.error("Email sending is a Pro feature. Upgrade to send invoices via email.");
      return;
    }
    if (!invoice || !clients.find((c) => c.id === invoice.client_id)?.email) {
      toast.error("Please assign a client with an email address first.");
      return;
    }

    setIsSendingEmail(true);
    try {
      const client = clients.find((c) => c.id === invoice.client_id)!;
      const businessName = await fetchBusinessName();
      await sendEmail({
        data: {
          invoice_id: invoice.id,
          client_email: client.email!,
          client_name: client.name,
          invoice_number: invoice.invoice_number,
          total_amount: Number(invoice.total_cents) / 100,
          due_date: invoice.due_date,
          business_name: businessName,
          job_description: invoice.notes,
          document_type: sendAsEstimate ? "estimate" : "invoice",
        },
      });

      await updateStatus("sent");
      const docType = sendAsEstimate ? "Estimate" : "Invoice";
      toast.success(`${docType} emailed to ${client.email}!`);
    } catch (error) {
      console.error("Email sending error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send email. Please try again.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCopyPaymentLink = () => {
    if (!id) return;
    const url = `${window.location.origin}/pay/${id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setIsCopyingLink(true);
        toast.success("Payment link copied to clipboard!");
        setTimeout(() => setIsCopyingLink(false), 2000);
      })
      .catch(() => {
        toast.error("Failed to copy link");
      });
  };

  async function openPreview() {
    if (!invoice) return;
    const branding = await fetchDocumentBranding(invoice.client_id);
    setPreviewData({
      ...invoice,
      items: items.filter((i) => i.description.trim()),
      ...branding,
      documentType: "invoice",
    });
    setPreviewOpen(true);
  }

  if (loading) {
    return (
      <AppShell title="Invoice">
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (!invoice) {
    return (
      <AppShell title="Invoice">
        <p className="text-muted-foreground">{error ?? "Invoice not found."}</p>
        <Link to="/invoices" className="mt-4 inline-flex text-sm text-primary hover:underline">
          ← Back to invoices
        </Link>
      </AppShell>
    );
  }

  const { subtotal, tax, total } = computeTotals(
    items.filter((i) => i.description.trim()),
    invoice.tax_rate || 0,
  );

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All invoices
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={remove}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button
            onClick={openPreview}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-muted"
          >
            <Eye className="h-3.5 w-3.5" /> Preview / PDF
          </button>
          <div className="flex items-center gap-2">
            <Select
              value={sendAsEstimate ? "estimate" : "invoice"}
              onValueChange={(v) => setSendAsEstimate(v === "estimate")}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="estimate">Estimate</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleSendEmail}
              disabled={
                isSendingEmail ||
                !invoice.client_id ||
                !clients.find((c) => c.id === invoice.client_id)?.email
              }
              className="gap-2"
              title={
                !invoice.client_id || !clients.find((c) => c.id === invoice.client_id)?.email
                  ? "Client needs an email address"
                  : `Send ${sendAsEstimate ? "estimate" : "invoice"} via email`
              }
            >
              {isSendingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Email
            </Button>
          </div>
          <Button variant="outline" onClick={handleExportPDF} className="gap-2">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyPaymentLink}
            className="gap-2"
            title="Copy payment link to share with client"
          >
            {isCopyingLink ? (
              <Copy className="h-4 w-4 text-primary" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
            {isCopyingLink ? "Copied!" : "Payment Link"}
          </Button>
          {invoice.status === "draft" && (
            <button
              onClick={() => updateStatus("sent")}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-muted"
            >
              <Send className="h-3.5 w-3.5" /> Mark sent
            </button>
          )}
          {invoice.status !== "paid" && invoice.status !== "void" && (
            <button
              onClick={() => updateStatus("paid")}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-semibold text-success-foreground hover:opacity-90"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark paid
            </button>
          )}
          <button
            onClick={() => save()}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}{" "}
            Save
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl tracking-tight text-foreground">
              {invoice.invoice_number}
            </h1>
            <StatusPill status={invoice.status} />
          </div>
          {!legacy && (
            <p className="mt-1 text-xs text-muted-foreground">
              Payment link token:{" "}
              <code className="rounded bg-surface-muted px-1.5 py-0.5">
                {invoice.id}
              </code>
            </p>
          )}
        </div>
        <select
          value={invoice.status}
          onChange={(e) => updateStatus(e.target.value as InvoiceStatus)}
          disabled={saving}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-semibold capitalize"
        >
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Details
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Client">
                <select
                  value={invoice.client_id ?? ""}
                  onChange={(e) => setInvoice({ ...invoice, client_id: e.target.value || null })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">— No client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {!legacy && (
                <>
                  <Field label="Currency">
                    <input
                      value={invoice.currency}
                      onChange={(e) =>
                        setInvoice({ ...invoice, currency: e.target.value.toUpperCase() })
                      }
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
                </>
              )}
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
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Line items
            </h2>
            <div className="mt-4">
              <LineItemsEditor items={items} onChange={setItems} currency={invoice.currency} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Notes
            </h2>
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
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Totals
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(subtotal, invoice.currency)} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax rate</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={(invoice.tax_rate * 100).toFixed(2)}
                    onChange={(e) =>
                      setInvoice({ ...invoice, tax_rate: Number(e.target.value) / 100 })
                    }
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
              <p className="mt-3 text-xs text-success">
                Paid on {new Date(invoice.paid_at).toLocaleString()}
              </p>
            )}
          </div>

          {msg && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-xs font-semibold text-success">
              {msg}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {error}
            </p>
          )}

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Activity
            </h2>
            {activity.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="mt-3 space-y-2 text-xs">
                {activity.map((a) => (
                  <li key={a.id} className="border-l-2 border-border pl-3">
                    <div className="font-semibold text-foreground">{a.action}</div>
                    {a.detail && <div className="text-muted-foreground">{a.detail}</div>}
                    <div className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>

      <InvoicePreviewModal
        open={previewOpen}
        invoice={previewData}
        onClose={() => setPreviewOpen(false)}
      />
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
