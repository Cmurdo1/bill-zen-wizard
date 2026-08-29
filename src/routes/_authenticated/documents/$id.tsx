import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { brandingPresetsClient } from "@/lib/branding-presets";
import { formatCurrency } from "@/lib/format";
import { LineItemsEditor } from "@/components/app/line-items-editor";
import { InvoicePreviewModal } from "@/components/app/invoice-preview-modal";
import { logActivity, fetchActivity, type ActivityRow } from "@/lib/activity";
import type { PrintInvoiceInput } from "@/lib/print-invoice";
import {
  ESTIMATE_STATUSES,
  INVOICE_STATUSES,
  StatusPill,
  computeTotals,
  type LineItem,
} from "@/lib/documents";
import { useServerFn } from "@tanstack/react-start";
import { sendInvoiceEmail } from "@/lib/invoices.functions";
import { sendEstimateEmail } from "@/lib/estimates.functions";
import { useSubscription } from "@/lib/subscription";
import { downloadBrandedInvoicePdf } from "@/lib/pdf-invoice";
import { fetchDocumentBranding } from "@/lib/document-branding";
import {
  createInvoiceRecord,
  fetchBusinessName,
  fetchInvoice,
  fetchInvoiceItems,
  insertInvoiceItems,
  isLegacyInvoiceSchema,
  replaceInvoiceItems,
  updateInvoiceRecord,
  updateInvoiceTotals,
  type UnifiedInvoice,
} from "@/lib/invoice-schema";
import {
  deleteEstimateRecord,
  fetchEstimate,
  fetchEstimateItems,
  isLegacyEstimateSchema,
  replaceEstimateItems,
  updateEstimateRecord,
  type UnifiedEstimate,
} from "@/lib/estimate-schema";
import { EstimateAiPanel } from "@/components/app/estimate-ai-panel";
import {
  ArrowLeft,
  Loader2,
  Save,
  Send,
  FileCheck,
  Trash2,
  ArrowRightCircle,
  CheckCircle2,
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

type Doc = UnifiedEstimate | UnifiedInvoice;
type Client = { id: string; name: string; email: string | null };

const DocumentSearch = z.object({
  type: z.enum(["estimate", "invoice"]).default("estimate"),
});

export const Route = createFileRoute("/_authenticated/documents/$id")({
  validateSearch: (search: unknown) => DocumentSearch.parse(search),
  head: () => ({
    meta: [{ title: "Document — Honest Invoice" }, { name: "robots", content: "noindex" }],
  }),
  component: DocumentDetailPage,
});

function DocumentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { type } = useSearch({ from: "/_authenticated/documents/$id" });
  const isEstimate = type === "estimate";
  const Label = isEstimate ? "Estimate" : "Invoice";

  const [doc, setDoc] = useState<Doc | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [presets, setPresets] = useState<{ id: string; name: string }[]>([]);
  const [legacy, setLegacy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const { canUseAI, isActive: subscribed } = useSubscription();
  const sendInvoice = useServerFn(sendInvoiceEmail);
  const sendEstimate = useServerFn(sendEstimateEmail);

  // Estimate-only flows
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);

  // Invoice-only flows
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PrintInvoiceInput | null>(null);
  const [sendAsEstimate, setSendAsEstimate] = useState(false);

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertIssue, setConvertIssue] = useState(() => new Date().toISOString().slice(0, 10));
  const [convertDue, setConvertDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [convertCurrency, setConvertCurrency] = useState("USD");

  useEffect(() => {
    void load();
    void fetchActivity(type, id).then(setActivity);
  }, [id, type]);

  async function load() {
    setLoading(true);
    try {
      if (isEstimate) {
        setLegacy(await isLegacyEstimateSchema());
        const [est, estItems, cliRes, presetRows] = await Promise.all([
          fetchEstimate(id),
          fetchEstimateItems(id),
          supabase.from("clients").select("id,name,email").order("name"),
          brandingPresetsClient()
            .select("id,name")
            .order("name", { ascending: true })
            .then(
              (r) => r as { data: { id: string; name: string }[] | null },
              () => ({ data: [] as { id: string; name: string }[] }),
            ),
        ]);
        if (!est) {
          setError("Estimate not found");
          return;
        }
        setDoc(est);
        setItems(estItems.length ? estItems : [{ description: "", quantity: 1, rate_cents: 0 }]);
        setClients((cliRes.data as Client[]) ?? []);
        setPresets((presetRows.data as { id: string; name: string }[]) ?? []);
      } else {
        setLegacy(await isLegacyInvoiceSchema());
        const [inv, invItems, cliRes, presetRows] = await Promise.all([
          fetchInvoice(id),
          fetchInvoiceItems(id),
          supabase.from("clients").select("id,name,email").order("name"),
          brandingPresetsClient()
            .select("id,name")
            .order("name", { ascending: true })
            .then(
              (r) => r as { data: { id: string; name: string }[] | null },
              () => ({ data: [] as { id: string; name: string }[] }),
            ),
        ]);
        if (!inv) {
          setError("Invoice not found");
          return;
        }
        setDoc(inv);
        setItems(invItems.length ? invItems : [{ description: "", quantity: 1, rate_cents: 0 }]);
        setClients((cliRes.data as Client[]) ?? []);
        setPresets((presetRows.data as { id: string; name: string }[]) ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not load ${label()}`);
    } finally {
      setLoading(false);
    }
  }

  function label() {
    return isEstimate ? "estimate" : "invoice";
  }

  async function save(overrides: Partial<Doc> = {}) {
    if (!doc) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const validItems = items.filter((i) => i.description.trim());
      const { subtotal, tax, total } = computeTotals(validItems, doc.tax_rate || 0);
      if (isEstimate) {
        const est = doc as UnifiedEstimate;
        await updateEstimateRecord(est.id, {
          client_id: est.client_id,
          issue_date: est.issue_date,
          expiry_date: est.expiry_date,
          notes: est.notes,
          job_description: est.job_description ?? null,
          tax_rate: est.tax_rate,
          subtotal_cents: subtotal,
          tax_cents: tax,
          total_cents: total,
          currency: est.currency,
          status: est.status,
          branding_preset_id: est.branding_preset_id,
          ...(overrides as Partial<UnifiedEstimate>),
        });
        await replaceEstimateItems(est.id, validItems);
        setDoc({
          ...est,
          ...(overrides as Partial<UnifiedEstimate>),
          subtotal_cents: subtotal,
          tax_cents: tax,
          total_cents: total,
        });
      } else {
        const inv = doc as UnifiedInvoice;
        await updateInvoiceRecord(inv.id, {
          client_id: inv.client_id,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          notes: inv.notes,
          tax_rate: inv.tax_rate,
          subtotal_cents: subtotal,
          tax_cents: tax,
          total_cents: total,
          currency: inv.currency,
          status: inv.status,
          branding_preset_id: inv.branding_preset_id,
          ...(overrides as Partial<UnifiedInvoice>),
        });
        await replaceInvoiceItems(inv.id, validItems);
        setDoc({
          ...inv,
          ...(overrides as Partial<UnifiedInvoice>),
          subtotal_cents: subtotal,
          tax_cents: tax,
          total_cents: total,
        });
      }
      setMsg("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(next: string) {
    if (!doc) return;
    const prev = doc.status;
    const overrides: Partial<Doc> = { status: next };
    // Legacy schema has no paid_at column — keep it in memory only there.
    if (!isEstimate && !legacy) {
      const inv = doc as UnifiedInvoice;
      const invOverrides = overrides as Partial<UnifiedInvoice>;
      if (next === "paid" && !inv.paid_at) invOverrides.paid_at = new Date().toISOString();
      if (next !== "paid") invOverrides.paid_at = null;
    }
    await save(overrides);
    if (prev !== next) {
      await logActivity(type, doc.id, `status:${next}`, `Changed from ${prev} to ${next}`);
      setActivity(await fetchActivity(type, doc.id));
    }
  }

  async function remove() {
    if (!doc) return;
    if (!confirm(`Delete this ${label()}? This can't be undone.`)) return;
    try {
      if (isEstimate) {
        await deleteEstimateRecord(doc.id);
      } else {
        await supabase.from("invoices").delete().eq("id", doc.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not delete ${label()}`);
      return;
    }
    navigate({ to: "/documents", search: { type } });
  }

  async function handleExportPDF() {
    if (!subscribed) {
      toast.error(`PDF export is a Pro feature. Upgrade to export ${label()}s.`);
      return;
    }
    if (!doc) return;

    try {
      const branding = await fetchDocumentBranding(doc.client_id, doc.branding_preset_id);
      const number = isEstimate
        ? (doc as UnifiedEstimate).estimate_number
        : (doc as UnifiedInvoice).invoice_number;
      const date = isEstimate
        ? ((doc as UnifiedEstimate).expiry_date ?? null)
        : (doc as UnifiedInvoice).due_date;
      await downloadBrandedInvoicePdf({
        ...doc,
        invoice_number: number,
        items: items.filter((i) => i.description.trim()),
        ...branding,
        due_date: date,
        documentType: isEstimate ? "estimate" : "invoice",
      });
      toast.success(`${Label} PDF exported successfully!`);
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    }
  }

  async function handleSendEmail() {
    if (!subscribed) {
      toast.error(`Email sending is a Pro feature. Upgrade to send ${label()}s via email.`);
      return;
    }
    if (!doc || !clients.find((c) => c.id === doc.client_id)?.email) {
      toast.error("Please assign a client with an email address first.");
      return;
    }

    setIsSendingEmail(true);
    try {
      const client = clients.find((c) => c.id === doc.client_id)!;
      if (isEstimate) {
        const est = doc as UnifiedEstimate;
        await sendEstimate({
          data: {
            estimateId: est.id,
            to: client.email!,
            message: "",
            business_name: await fetchBusinessName(est.branding_preset_id),
          },
        });
        await updateStatus("sent");
      } else {
        const inv = doc as UnifiedInvoice;
        const businessName = await fetchBusinessName(inv.branding_preset_id);
        await sendInvoice({
          data: {
            invoice_id: inv.id,
            client_email: client.email!,
            client_name: client.name,
            invoice_number: inv.invoice_number,
            total_amount: Number(inv.total_cents) / 100,
            due_date: inv.due_date,
            business_name: businessName,
            job_description: inv.notes,
            document_type: sendAsEstimate ? "estimate" : "invoice",
          },
        });
        await updateStatus("sent");
      }
      toast.success(
        `${sendAsEstimate && !isEstimate ? "Estimate" : Label} emailed to ${client.email}!`,
      );
    } catch (error) {
      console.error("Email sending error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send email. Please try again.",
      );
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function handleCopyLink() {
    if (!id) return;
    const url = isEstimate
      ? `${window.location.origin}/estimate/${id}`
      : `${window.location.origin}/pay/${id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setIsCopyingLink(true);
        toast.success(`${isEstimate ? "Estimate" : "Payment"} link copied to clipboard!`);
        setTimeout(() => setIsCopyingLink(false), 2000);
      })
      .catch(() => {
        toast.error("Failed to copy link");
      });
  }

  async function openPreview() {
    if (!doc || isEstimate) return;
    const inv = doc as UnifiedInvoice;
    const branding = await fetchDocumentBranding(inv.client_id, inv.branding_preset_id);
    setPreviewData({
      ...inv,
      items: items.filter((i) => i.description.trim()),
      ...branding,
      documentType: "invoice",
    });
    setPreviewOpen(true);
  }

  function openConvert() {
    const est = doc as UnifiedEstimate | null;
    if (!est) return;
    setConvertIssue(new Date().toISOString().slice(0, 10));
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setConvertDue(d.toISOString().slice(0, 10));
    setConvertCurrency(est.currency || "USD");
    setConvertOpen(true);
  }

  async function convertToInvoice() {
    const est = doc as UnifiedEstimate | null;
    if (!est) return;
    setError(null);
    if (!convertIssue) {
      setError("Issue date is required.");
      return;
    }
    if (!convertDue) {
      setError("Due date is required.");
      return;
    }
    if (new Date(convertDue) < new Date(convertIssue)) {
      setError("Due date must be on or after the issue date.");
      return;
    }
    const cur = convertCurrency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) {
      setError("Currency must be a 3-letter code (e.g. USD).");
      return;
    }
    const validItems = items.filter((i) => i.description.trim());
    if (!validItems.length) {
      setError("Add at least one line item before converting.");
      return;
    }

    setConverting(true);
    let createdInvoiceId: string | null = null;
    try {
      // Prevent double-convert: re-check server state (legacy: no link column).
      const fresh = await fetchEstimate(est.id);
      if (fresh?.converted_invoice_id) {
        setError("This estimate has already been converted.");
        setConvertOpen(false);
        navigate({
          to: "/documents/$id",
          params: { id: fresh.converted_invoice_id },
          search: { type: "invoice" },
        });
        return;
      }

      const inv = await createInvoiceRecord({
        client_id: est.client_id,
        job_description: est.job_description ?? null,
        notes: est.notes ?? null,
        due_date: convertDue,
        issue_date: convertIssue,
        currency: cur,
        branding_preset_id: est.branding_preset_id,
      });
      createdInvoiceId = inv.id;
      await insertInvoiceItems(inv.id, validItems);
      await updateInvoiceTotals(inv.id, est.tax_rate || 0);

      // Mark the estimate converted. On legacy there is no link column, so
      // only the status flips.
      await updateEstimateRecord(est.id, { status: "converted" });
      if (!legacy) {
        await supabase
          .from("estimates")
          .update({ converted_at: new Date().toISOString(), converted_invoice_id: inv.id })
          .eq("id", est.id);
      }

      await logActivity("estimate", est.id, "converted", `Created invoice ${inv.invoice_number}`);
      await logActivity(
        "invoice",
        inv.id,
        "created",
        `Converted from estimate ${est.estimate_number}`,
      );
      setConvertOpen(false);
      navigate({ to: "/documents/$id", params: { id: inv.id }, search: { type: "invoice" } });
    } catch (e) {
      // Roll back the created invoice so a failed convert doesn't leave an orphan.
      if (createdInvoiceId) {
        try {
          await supabase.from("invoices").delete().eq("id", createdInvoiceId);
        } catch {
          // best-effort rollback
        }
      }
      setError(e instanceof Error ? e.message : "Could not convert");
    } finally {
      setConverting(false);
    }
  }

  async function approve() {
    const est = doc as UnifiedEstimate | null;
    if (!est) return;
    setApproving(true);
    setError(null);
    try {
      await save();
      const stamp = new Date().toISOString();
      // Legacy has no approved_at column — keep it in memory only.
      if (!legacy) {
        const { error: aErr } = await supabase
          .from("estimates")
          .update({ approved_at: stamp })
          .eq("id", est.id);
        if (aErr) throw aErr;
      }
      setDoc({ ...est, approved_at: stamp });
      await logActivity("estimate", est.id, "approved", "Approved by owner, ready to send");
      setActivity(await fetchActivity("estimate", est.id));
      setMsg("Approved — ready to send to the client.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setApproving(false);
    }
  }

  function openSend() {
    const est = doc as UnifiedEstimate | null;
    if (!est) return;
    const client = clients.find((c) => c.id === est.client_id);
    setSendTo(est.sent_to_email ?? client?.email ?? "");
    setSendMessage("");
    setSendOpen(true);
  }

  async function doSend() {
    const est = doc as UnifiedEstimate | null;
    if (!est) return;
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sendTo.trim())) {
      setError("Enter a valid client email.");
      return;
    }
    setSending(true);
    try {
      await sendEstimate({
        data: {
          estimateId: est.id,
          to: sendTo.trim(),
          message: sendMessage.trim() || undefined,
          business_name: await fetchBusinessName(est.branding_preset_id),
        },
      });
      const stamp = new Date().toISOString();
      setDoc({ ...est, status: "sent", sent_at: stamp, sent_to_email: sendTo.trim() });
      await logActivity("estimate", est.id, "emailed", `Sent to ${sendTo.trim()}`);
      setActivity(await fetchActivity("estimate", est.id));
      setSendOpen(false);
      setMsg(`Estimate emailed to ${sendTo.trim()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send estimate");
    } finally {
      setSending(false);
    }
  }

  function handleTypeChange(next: "estimate" | "invoice") {
    if (next === type) return;
    if (isEstimate && next === "invoice") {
      openConvert();
      return;
    }
    toast.info("Invoices can't be converted to estimates — create a new estimate instead.");
  }

  if (loading) {
    return (
      <AppShell title={Label}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (!doc) {
    return (
      <AppShell title={Label}>
        <p className="text-muted-foreground">{error ?? `${Label} not found.`}</p>
        <Link
          to="/documents"
          search={{ type }}
          className="mt-4 inline-flex text-sm text-primary hover:underline"
        >
          ← Back to {isEstimate ? "estimates" : "invoices"}
        </Link>
      </AppShell>
    );
  }

  const { subtotal, tax, total } = computeTotals(
    items.filter((i) => i.description.trim()),
    doc.tax_rate || 0,
  );
  const number = isEstimate
    ? (doc as UnifiedEstimate).estimate_number
    : (doc as UnifiedInvoice).invoice_number;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/documents"
          search={{ type }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All {isEstimate ? "estimates" : "invoices"}
        </Link>
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={(v) => handleTypeChange(v as "estimate" | "invoice")}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="estimate">Estimate</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={remove}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          {!isEstimate && (
            <button
              onClick={openPreview}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-muted"
            >
              <Eye className="h-3.5 w-3.5" /> Preview / PDF
            </button>
          )}
          {!isEstimate && (
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
                  !doc.client_id ||
                  !clients.find((c) => c.id === doc.client_id)?.email
                }
                className="gap-2"
                title={
                  !doc.client_id || !clients.find((c) => c.id === doc.client_id)?.email
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
          )}
          {isEstimate && (
            <Button
              variant="outline"
              onClick={handleSendEmail}
              disabled={
                isSendingEmail ||
                !doc.client_id ||
                !clients.find((c) => c.id === doc.client_id)?.email
              }
              className="gap-2"
              title={
                !doc.client_id || !clients.find((c) => c.id === doc.client_id)?.email
                  ? "Client needs an email address"
                  : "Send estimate via email"
              }
            >
              {isSendingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Email
            </Button>
          )}
          <Button variant="outline" onClick={handleExportPDF} className="gap-2">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyLink}
            className="gap-2"
            title={
              isEstimate
                ? "Copy estimate link to share with client"
                : "Copy payment link to share with client"
            }
          >
            {isCopyingLink ? (
              <Copy className="h-4 w-4 text-primary" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
            {isCopyingLink ? "Copied!" : isEstimate ? "Share Link" : "Payment Link"}
          </Button>
          {doc.status === "draft" && (
            <button
              onClick={() => updateStatus("sent")}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-muted"
            >
              <Send className="h-3.5 w-3.5" /> Mark sent
            </button>
          )}
          {isEstimate && (doc.status === "sent" || doc.status === "draft") && (
            <button
              onClick={() => updateStatus("accepted")}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-semibold text-success-foreground hover:opacity-90"
            >
              <FileCheck className="h-3.5 w-3.5" /> Mark accepted
            </button>
          )}
          {!isEstimate && doc.status !== "paid" && doc.status !== "void" && (
            <button
              onClick={() => updateStatus("paid")}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-semibold text-success-foreground hover:opacity-90"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark paid
            </button>
          )}
          {isEstimate &&
            (doc as UnifiedEstimate).status !== "converted" &&
            !(doc as UnifiedEstimate).converted_invoice_id && (
              <button
                onClick={openConvert}
                disabled={converting}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {converting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRightCircle className="h-3.5 w-3.5" />
                )}{" "}
                Convert to invoice
              </button>
            )}
          {isEstimate && (doc as UnifiedEstimate).converted_invoice_id && (
            <Link
              to="/documents/$id"
              params={{ id: (doc as UnifiedEstimate).converted_invoice_id! }}
              search={{ type: "invoice" }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-muted"
            >
              <ArrowRightCircle className="h-3.5 w-3.5" /> View invoice
            </Link>
          )}
          {isEstimate && !(doc as UnifiedEstimate).approved_at && !legacy && (
            <button
              onClick={approve}
              disabled={approving || saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-success bg-success/10 px-3 text-xs font-semibold text-success hover:bg-success/20 disabled:opacity-60"
            >
              {approving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}{" "}
              Approve
            </button>
          )}
          {isEstimate && ((doc as UnifiedEstimate).approved_at || legacy) && (
            <button
              onClick={openSend}
              disabled={sending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Mail className="h-3.5 w-3.5" />{" "}
              {(doc as UnifiedEstimate).sent_at ? "Resend to client" : "Send to client"}
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
            <h1 className="font-display text-3xl tracking-tight text-foreground">{number}</h1>
            <StatusPill status={doc.status} />
          </div>
          {!isEstimate && !legacy && (
            <p className="mt-1 text-xs text-muted-foreground">
              Payment link token:{" "}
              <code className="rounded bg-surface-muted px-1.5 py-0.5">{doc.id}</code>
            </p>
          )}
        </div>
        <select
          value={doc.status}
          onChange={(e) => updateStatus(e.target.value)}
          disabled={saving}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-semibold capitalize"
        >
          {(isEstimate ? ESTIMATE_STATUSES : INVOICE_STATUSES).map((s) => (
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
                  value={doc.client_id ?? ""}
                  onChange={(e) => setDoc({ ...doc, client_id: e.target.value || null })}
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
                      value={doc.currency}
                      onChange={(e) => setDoc({ ...doc, currency: e.target.value.toUpperCase() })}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </Field>
                  <Field label="Issue date">
                    <input
                      type="date"
                      value={doc.issue_date.slice(0, 10)}
                      onChange={(e) => setDoc({ ...doc, issue_date: e.target.value })}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </Field>
                </>
              )}
              {isEstimate ? (
                <Field label="Expires">
                  <input
                    type="date"
                    value={(doc as UnifiedEstimate).expiry_date?.slice(0, 10) ?? ""}
                    onChange={(e) => setDoc({ ...doc, expiry_date: e.target.value || null } as Doc)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </Field>
              ) : (
                <Field label="Due date">
                  <input
                    type="date"
                    value={(doc as UnifiedInvoice).due_date?.slice(0, 10) ?? ""}
                    onChange={(e) => setDoc({ ...doc, due_date: e.target.value || null } as Doc)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </Field>
              )}
              <Field label="Brand">
                <select
                  value={doc.branding_preset_id ?? ""}
                  onChange={(e) => setDoc({ ...doc, branding_preset_id: e.target.value || null })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Account default</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {isEstimate && (
            <EstimateAiPanel
              estimateId={doc.id}
              currency={doc.currency || "USD"}
              description={(doc as UnifiedEstimate).job_description ?? ""}
              onDescriptionChange={(v) => setDoc({ ...doc, job_description: v })}
              onItems={(next) =>
                setItems(next.length ? next : [{ description: "", quantity: 1, rate_cents: 0 }])
              }
              canUseAI={canUseAI}
            />
          )}

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Line items
            </h2>
            <div className="mt-4">
              <LineItemsEditor items={items} onChange={setItems} currency={doc.currency} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {isEstimate ? "Scope / Notes" : "Notes"}
            </h2>
            <textarea
              value={doc.notes ?? ""}
              onChange={(e) => setDoc({ ...doc, notes: e.target.value })}
              rows={4}
              className="mt-3 block w-full rounded-lg border border-border bg-background p-3 text-sm"
              placeholder={
                isEstimate
                  ? "Scope of work, assumptions, exclusions…"
                  : "Payment terms, thank-you note, etc."
              }
            />
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Totals
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(subtotal, doc.currency)} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax rate</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={(doc.tax_rate * 100).toFixed(2)}
                    onChange={(e) => setDoc({ ...doc, tax_rate: Number(e.target.value) / 100 })}
                    className="h-8 w-20 rounded-md border border-border bg-background px-2 text-right text-xs"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <Row label="Tax" value={formatCurrency(tax, doc.currency)} />
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total, doc.currency)}</span>
              </div>
            </dl>
            {!isEstimate && (doc as UnifiedInvoice).paid_at && (
              <p className="mt-3 text-xs text-success">
                Paid on {new Date((doc as UnifiedInvoice).paid_at!).toLocaleString()}
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

      {isEstimate && sendOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => !sending && setSendOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl">Send estimate to client</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You approved this estimate — it will be emailed exactly as shown.
            </p>
            <div className="mt-4 grid gap-3">
              <Field label="Client email">
                <input
                  type="email"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Message (optional)">
                <textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm"
                />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSendOpen(false)}
                disabled={sending}
                className="h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                onClick={doSend}
                disabled={sending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}{" "}
                Send estimate
              </button>
            </div>
          </div>
        </div>
      )}

      {isEstimate && convertOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => !converting && setConvertOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl">Convert to invoice</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the details for the new draft invoice.
            </p>
            <div className="mt-4 grid gap-3">
              <Field label="Issue date">
                <input
                  type="date"
                  value={convertIssue}
                  onChange={(e) => setConvertIssue(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  value={convertDue}
                  onChange={(e) => setConvertDue(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Currency">
                <input
                  value={convertCurrency}
                  onChange={(e) => setConvertCurrency(e.target.value.toUpperCase())}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConvertOpen(false)}
                disabled={converting}
                className="h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                onClick={convertToInvoice}
                disabled={converting}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
              >
                {converting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRightCircle className="h-3.5 w-3.5" />
                )}{" "}
                Create invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {!isEstimate && (
        <InvoicePreviewModal
          open={previewOpen}
          invoice={previewData}
          onClose={() => setPreviewOpen(false)}
        />
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
