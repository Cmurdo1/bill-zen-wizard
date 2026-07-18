import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "./format";
import type { PrintInvoiceInput } from "./print-invoice";

export function generateInvoicePdf(inv: PrintInvoiceInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const M = 48;
  let y = M;

  const bizName = inv.business?.company_name || inv.business?.full_name || "Your Business";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("Invoice", M, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`${inv.invoice_number}  ·  ${inv.status.toUpperCase()}`, M, y + 26);

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const pw = doc.internal.pageSize.getWidth();
  doc.text(bizName, pw - M, y + 8, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const bizLines: string[] = [];
  if (inv.business?.email) bizLines.push(inv.business.email);
  if (inv.business?.business_address) bizLines.push(...inv.business.business_address.split("\n"));
  bizLines.forEach((line, i) => doc.text(line, pw - M, y + 24 + i * 12, { align: "right" }));

  y += 70;
  doc.setDrawColor(229, 231, 235);
  doc.line(M, y, pw - M, y);
  y += 20;

  // Bill to / meta
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.text("BILL TO", M, y);
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(inv.client?.name || "—", M, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const clientLines: string[] = [];
  if (inv.client?.email) clientLines.push(inv.client.email);
  if (inv.client?.address_line1) clientLines.push(inv.client.address_line1);
  if (inv.client?.address_line2) clientLines.push(inv.client.address_line2);
  const cityLine = [inv.client?.city, inv.client?.state, inv.client?.postal_code].filter(Boolean).join(", ");
  if (cityLine) clientLines.push(cityLine);
  if (inv.client?.country) clientLines.push(inv.client.country);
  clientLines.forEach((line, i) => doc.text(line, M, y + 30 + i * 12));

  // Meta right side
  doc.setTextColor(107, 114, 128);
  doc.text(`Issued: ${formatDate(inv.issue_date)}`, pw - M, y, { align: "right" });
  doc.text(`Due: ${formatDate(inv.due_date)}`, pw - M, y + 14, { align: "right" });
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
    headStyles: { fillColor: [17, 24, 39], textColor: 255, fontSize: 9 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: M, right: M },
  });

  // Totals
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  const rightX = pw - M;
  const labelX = pw - M - 180;
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text("Subtotal", labelX, finalY);
  doc.setTextColor(17, 24, 39);
  doc.text(formatCurrency(inv.subtotal_cents, inv.currency), rightX, finalY, { align: "right" });
  doc.setTextColor(107, 114, 128);
  doc.text(`Tax (${(inv.tax_rate * 100).toFixed(2)}%)`, labelX, finalY + 16);
  doc.setTextColor(17, 24, 39);
  doc.text(formatCurrency(inv.tax_cents, inv.currency), rightX, finalY + 16, { align: "right" });
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(1.2);
  doc.line(labelX, finalY + 26, rightX, finalY + 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total", labelX, finalY + 44);
  doc.text(formatCurrency(inv.total_cents, inv.currency), rightX, finalY + 44, { align: "right" });

  if (inv.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("Notes", M, finalY + 80);
    doc.setTextColor(17, 24, 39);
    const wrapped = doc.splitTextToSize(inv.notes, pw - M * 2);
    doc.text(wrapped, M, finalY + 94);
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
