import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "./format";
import { DEFAULT_ACCENT_COLOR, DEFAULT_BRAND_COLOR, hexToRgb } from "./branding";
import type { PrintInvoiceInput } from "./print-invoice";

const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [107, 114, 128];

export function generateInvoicePdf(inv: PrintInvoiceInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const M = 48;
  let y = M;

  const b = inv.branding ?? null;
  const brand = hexToRgb(b?.brandColor ?? DEFAULT_BRAND_COLOR, INK);
  const accent = hexToRgb(b?.accentColor ?? DEFAULT_ACCENT_COLOR, INK);
  const label = inv.doc_label ?? "Invoice";

  const bizName = inv.business?.company_name || inv.business?.full_name || "Your Business";
  const pw = doc.internal.pageSize.getWidth();

  // Branded top rule
  if (b) {
    doc.setFillColor(brand[0], brand[1], brand[2]);
    doc.rect(0, 0, pw, 8, "F");
    y += 6;
  }

  // Logo
  let titleX = M;
  if (b?.logoDataUrl) {
    try {
      const fmt = b.logoDataUrl.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(b.logoDataUrl, fmt, M, y - 6, 46, 46);
      titleX = M + 60;
    } catch {
      titleX = M;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(brand[0], brand[1], brand[2]);
  doc.text(label, titleX, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${inv.invoice_number}  ·  ${inv.status.toUpperCase()}`, titleX, y + 26);

  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(bizName, pw - M, y + 8, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const bizLines: string[] = [];
  if (b?.tagline) bizLines.push(b.tagline);
  if (inv.business?.email) bizLines.push(inv.business.email);
  if (inv.business?.business_address) bizLines.push(...inv.business.business_address.split("\n"));
  bizLines.forEach((line, i) => doc.text(line, pw - M, y + 24 + i * 12, { align: "right" }));

  y += Math.max(70, 24 + bizLines.length * 12 + 12);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(1);
  doc.line(M, y, pw - M, y);
  y += 20;

  // Bill to / meta
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.setFontSize(9);
  doc.text("BILL TO", M, y);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(inv.client?.name || "—", M, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const clientLines: string[] = [];
  if (inv.client?.email) clientLines.push(inv.client.email);
  if (inv.client?.address_line1) clientLines.push(inv.client.address_line1);
  if (inv.client?.address_line2) clientLines.push(inv.client.address_line2);
  const cityLine = [inv.client?.city, inv.client?.state, inv.client?.postal_code].filter(Boolean).join(", ");
  if (cityLine) clientLines.push(cityLine);
  if (inv.client?.country) clientLines.push(inv.client.country);
  clientLines.forEach((line, i) => doc.text(line, M, y + 30 + i * 12));

  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Issued: ${formatDate(inv.issue_date)}`, pw - M, y, { align: "right" });
  doc.text(`Due: ${formatDate(inv.due_date)}`, pw - M, y + 14, { align: "right" });
  doc.text(`Currency: ${inv.currency}`, pw - M, y + 28, { align: "right" });

  y += 60 + clientLines.length * 12;

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
    headStyles: { fillColor: brand, textColor: 255, fontSize: 9 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: M, right: M },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  const rightX = pw - M;
  const labelX = pw - M - 180;
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Subtotal", labelX, finalY);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(formatCurrency(inv.subtotal_cents, inv.currency), rightX, finalY, { align: "right" });
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Tax (${(inv.tax_rate * 100).toFixed(2)}%)`, labelX, finalY + 16);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(formatCurrency(inv.tax_cents, inv.currency), rightX, finalY + 16, { align: "right" });
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(1.6);
  doc.line(labelX, finalY + 26, rightX, finalY + 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(brand[0], brand[1], brand[2]);
  doc.text("Total", labelX, finalY + 44);
  doc.text(formatCurrency(inv.total_cents, inv.currency), rightX, finalY + 44, { align: "right" });
  doc.setTextColor(INK[0], INK[1], INK[2]);

  if (inv.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Notes", M, finalY + 80);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const wrapped = doc.splitTextToSize(inv.notes, pw - M * 2);
    doc.text(wrapped, M, finalY + 94);
  }

  if (b?.footerText) {
    const ph = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const footer = doc.splitTextToSize(b.footerText, pw - M * 2);
    doc.text(footer, pw / 2, ph - M + 6, { align: "center" });
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(2);
    doc.line(M, ph - M - 12, pw - M, ph - M - 12);
  }

  return doc;
}

export function downloadInvoicePdf(inv: PrintInvoiceInput) {
  const doc = generateInvoicePdf(inv);
  doc.save(`${inv.invoice_number}.pdf`);
}

export function invoicePdfDataUrl(inv: PrintInvoiceInput): string {
  const doc = generateInvoicePdf(inv);
  return doc.output("datauristring");
}
