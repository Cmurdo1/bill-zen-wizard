import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "./format";
import type { PrintInvoiceInput } from "./print-invoice";
import { resolveLogoDataUrl } from "./document-branding";

export function generateInvoicePdf(inv: PrintInvoiceInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const M = 48;
  let y = M;

  // Honest Invoice design tokens (from styles.css oklch values)
  const NAVY: [number, number, number] = [11, 38, 84]; // --primary
  const MUTED: [number, number, number] = [87, 94, 105]; // --muted-foreground
  const BORDER: [number, number, number] = [228, 225, 218]; // --border
  const WHITE: [number, number, number] = [255, 255, 255];

  const isEstimate = inv.documentType === "estimate";
  const docNumber = isEstimate ? inv.estimate_number : inv.invoice_number;
  const docLabel = isEstimate ? "Estimate" : "Invoice";
  const dateLabel = isEstimate ? "Expiry" : "Due";
  const dateValue = isEstimate ? inv.expiry_date : inv.due_date;

  const bizName = inv.business?.company_name || inv.business?.full_name || "Your Business";
  const brandColor = parseHexColor(inv.business?.brand_color, NAVY);
  const pw = doc.internal.pageSize.getWidth();

  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pw, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...NAVY);
  doc.text(docLabel, M, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`${docNumber}  ·  ${inv.status.toUpperCase()}`, M, y + 26);

  doc.setTextColor(...brandColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  if (inv.business?.logo_data_url) {
    try {
      doc.addImage(inv.business.logo_data_url, pw - M - 112, y - 12, 112, 40, undefined, "FAST");
    } catch {
      // A remote logo can fail to load or be in an unsupported format; text branding remains.
    }
  }
  doc.text(bizName, pw - M, y + 34, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const bizLines: string[] = [];
  if (inv.business?.email) bizLines.push(inv.business.email);
  if (inv.business?.business_address) bizLines.push(...inv.business.business_address.split("\n"));
  bizLines.forEach((line, i) => doc.text(line, pw - M, y + 24 + i * 12, { align: "right" }));

  y += 70;
  doc.setDrawColor(...BORDER);
  doc.line(M, y, pw - M, y);
  y += 20;

  // Bill to / meta
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text("BILL TO", M, y);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(inv.client?.name || "—", M, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const clientLines: string[] = [];
  if (inv.client?.email) clientLines.push(inv.client.email);
  if (inv.client?.address_line1) clientLines.push(inv.client.address_line1);
  if (inv.client?.address_line2) clientLines.push(inv.client.address_line2);
  const cityLine = [inv.client?.city, inv.client?.state, inv.client?.postal_code]
    .filter(Boolean)
    .join(", ");
  if (cityLine) clientLines.push(cityLine);
  if (inv.client?.country) clientLines.push(inv.client.country);
  clientLines.forEach((line, i) => doc.text(line, M, y + 30 + i * 12));

  // Meta right side
  doc.setTextColor(...MUTED);
  doc.text(`Issued: ${formatDate(inv.issue_date)}`, pw - M, y, { align: "right" });
  doc.text(`${dateLabel}: ${formatDate(dateValue)}`, pw - M, y + 14, { align: "right" });
  doc.text(`Currency: ${inv.currency}`, pw - M, y + 28, { align: "right" });

  y += 60 + clientLines.length * 12;

  // Line items table
  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Rate", "Amount"]],
    body: inv.items.map((i) => [
      i.description,
      String(i.quantity),
      formatCurrency(i.rate_cents, inv.currency),
      formatCurrency(Math.round(i.quantity * i.rate_cents), inv.currency),
    ]),
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: brandColor, textColor: WHITE, fontSize: 9 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: M, right: M },
  });

  // Totals
  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  const rightX = pw - M;
  const labelX = pw - M - 180;
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("Subtotal", labelX, finalY);
  doc.setTextColor(...NAVY);
  doc.text(formatCurrency(inv.subtotal_cents, inv.currency), rightX, finalY, { align: "right" });
  doc.setTextColor(...MUTED);
  doc.text(`Tax (${(inv.tax_rate * 100).toFixed(2)}%)`, labelX, finalY + 16);
  doc.setTextColor(...NAVY);
  doc.text(formatCurrency(inv.tax_cents, inv.currency), rightX, finalY + 16, { align: "right" });
  doc.setDrawColor(...brandColor);
  doc.setLineWidth(1.2);
  doc.line(labelX, finalY + 26, rightX, finalY + 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text("Total", labelX, finalY + 44);
  doc.text(formatCurrency(inv.total_cents, inv.currency), rightX, finalY + 44, { align: "right" });

  if (inv.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Notes", M, finalY + 80);
    doc.setTextColor(...NAVY);
    const wrapped = doc.splitTextToSize(inv.notes, pw - M * 2);
    doc.text(wrapped, M, finalY + 94);
  }

  return doc;
}

function parseHexColor(value: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  const match = value?.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return fallback;
  return [
    parseInt(match[1].slice(0, 2), 16),
    parseInt(match[1].slice(2, 4), 16),
    parseInt(match[1].slice(4, 6), 16),
  ];
}

export async function downloadBrandedInvoicePdf(inv: PrintInvoiceInput) {
  const logoDataUrl = await resolveLogoDataUrl(inv.business?.logo_url);
  downloadInvoicePdf({
    ...inv,
    business: inv.business ? { ...inv.business, logo_data_url: logoDataUrl } : inv.business,
  });
}

export async function downloadInvoicePdf(inv: PrintInvoiceInput) {
  const doc = generateInvoicePdf(inv);
  const filename =
    inv.documentType === "estimate" && inv.estimate_number
      ? `${inv.estimate_number}.pdf`
      : `${inv.invoice_number}.pdf`;
  doc.save(filename);
}

export function invoicePdfDataUrl(inv: PrintInvoiceInput): string {
  const doc = generateInvoicePdf(inv);
  return doc.output("datauristring");
}
