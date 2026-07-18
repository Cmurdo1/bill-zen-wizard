import { useEffect, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import type { PrintInvoiceInput } from "@/lib/print-invoice";
import { downloadInvoicePdf, invoicePdfDataUrl } from "@/lib/pdf-invoice";

export function InvoicePreviewModal({
  invoice,
  open,
  onClose,
}: {
  invoice: PrintInvoiceInput | null;
  open: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invoice) { setUrl(null); return; }
    try {
      setUrl(invoicePdfDataUrl(invoice));
    } catch {
      setUrl(null);
    }
  }, [open, invoice]);

  if (!open || !invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h3 className="font-display text-lg text-foreground">Invoice preview</h3>
            <p className="text-xs text-muted-foreground">{invoice.invoice_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadInvoicePdf(invoice)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" /> Download PDF
            </button>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-surface-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 bg-surface-muted">
          {url ? (
            <iframe title="Invoice preview" src={url} className="h-full w-full border-0" />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
