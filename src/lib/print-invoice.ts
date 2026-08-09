import { formatCurrency, formatDate } from "./format";
import type { LineItem } from "./documents";

export type PrintInvoiceInput = {
  invoice_number: string;
  estimate_number?: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  expiry_date?: string | null;
  currency: string;
  tax_rate: number;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  notes: string | null;
  client?: {
    name?: string | null;
    email?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  business?: {
    company_name?: string | null;
    full_name?: string | null;
    email?: string | null;
    business_address?: string | null;
    logo_url?: string | null;
    logo_data_url?: string | null;
    brand_color?: string | null;
  } | null;
  items: LineItem[];
  documentType?: "invoice" | "estimate";
};

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function printInvoice(inv: PrintInvoiceInput) {
  const isEstimate = inv.documentType === "estimate";
  const docNumber = isEstimate ? inv.estimate_number : inv.invoice_number;
  const docLabel = isEstimate ? "Estimate" : "Invoice";
  const dateLabel = isEstimate ? "Expiry" : "Due";

  const clientAddr = [
    inv.client?.address_line1,
    inv.client?.address_line2,
    [inv.client?.city, inv.client?.state, inv.client?.postal_code].filter(Boolean).join(", "),
    inv.client?.country,
  ]
    .filter(Boolean)
    .map(esc)
    .join("<br/>");
  const bizName = inv.business?.company_name || inv.business?.full_name || "Your Business";
  const brandColor = /^#[0-9a-f]{6}$/i.test(inv.business?.brand_color ?? "")
    ? inv.business?.brand_color
    : "#0b2654";
  const logo = inv.business?.logo_url
    ? `<img src="${esc(inv.business.logo_url)}" alt="${esc(bizName)} logo" style="max-width:180px;max-height:64px;object-fit:contain;margin-bottom:10px" />`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>${esc(docNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: ${brandColor}; margin: 40px; }
  h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.02em; color: ${brandColor}; }
  .muted { color: #575e69; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; background: ${brandColor}; color: #fff; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e4e1da; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #575e69; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 16px; margin-left: auto; width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
  .totals .grand { border-top: 2px solid ${brandColor}; margin-top: 6px; padding-top: 10px; font-weight: 700; font-size: 16px; }
  .notes { margin-top: 32px; padding: 16px; background: #f6f3ee; border-radius: 8px; white-space: pre-wrap; }
  @media print { body { margin: 24mm; } .no-print { display: none; } }
</style></head><body>
<div class="row">
  <div>
    <h1>${docLabel}</h1>
    <div class="muted">${esc(docNumber)} · <span class="badge">${esc(inv.status)}</span></div>
  </div>
  <div style="text-align:right">
    ${logo}
    <div style="font-weight:700; font-size:16px; color:${brandColor}">${esc(bizName)}</div>
    ${inv.business?.email ? `<div class="muted">${esc(inv.business.email)}</div>` : ""}
    ${inv.business?.business_address ? `<div class="muted">${esc(inv.business.business_address).replace(/\n/g, "<br/>")}</div>` : ""}
  </div>
</div>

<div class="row" style="margin-top:32px">
  <div>
    <div class="muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.08em">Bill to</div>
    <div style="margin-top:6px; font-weight:600">${esc(inv.client?.name) || "—"}</div>
    ${inv.client?.email ? `<div class="muted">${esc(inv.client.email)}</div>` : ""}
    ${clientAddr ? `<div class="muted" style="margin-top:4px">${clientAddr}</div>` : ""}
  </div>
  <div style="text-align:right">
    <div><span class="muted">Issued:</span> ${esc(formatDate(inv.issue_date))}</div>
    <div><span class="muted">${dateLabel}:</span> ${esc(formatDate(isEstimate ? inv.expiry_date : inv.due_date))}</div>
    <div><span class="muted">Currency:</span> ${esc(inv.currency)}</div>
  </div>
</div>

<table>
  <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
  <tbody>
    ${inv.items
      .map(
        (i) => `<tr>
      <td>${esc(i.description)}</td>
      <td class="num">${i.quantity}</td>
      <td class="num">${esc(formatCurrency(i.rate_cents, inv.currency))}</td>
      <td class="num">${esc(formatCurrency(Math.round(i.quantity * i.rate_cents), inv.currency))}</td>
    </tr>`,
      )
      .join("")}
  </tbody>
</table>

<div class="totals">
  <div><span class="muted">Subtotal</span><span>${esc(formatCurrency(inv.subtotal_cents, inv.currency))}</span></div>
  <div><span class="muted">Tax (${(inv.tax_rate * 100).toFixed(2)}%)</span><span>${esc(formatCurrency(inv.tax_cents, inv.currency))}</span></div>
  <div class="grand"><span>Total</span><span>${esc(formatCurrency(inv.total_cents, inv.currency))}</span></div>
</div>

${inv.notes ? `<div class="notes">${esc(inv.notes)}</div>` : ""}

<script>window.addEventListener("load", () => setTimeout(() => window.print(), 250));</script>
</body></html>`;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
