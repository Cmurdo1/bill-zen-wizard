import { z } from "zod";

export const AnalyzeInput = z.object({
  estimateId: z.string().uuid(),
  description: z.string().trim().min(10, "Describe the job in at least a sentence.").max(4000),
  currency: z.string().trim().length(3).default("USD"),
});

export const SendInput = z.object({
  estimateId: z.string().uuid(),
  to: z.string().trim().email().max(255),
  message: z.string().trim().max(2000).optional(),
});

export const EstimateSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Step of the job, including measured/estimated quantities",
          },
          quantity: { type: "number" },
          unit: { type: "string", description: "sq ft, linear ft, hour, each, gallon, etc." },
          rate_cents: { type: "integer", description: "Unit price in cents" },
          basis: { type: "string", description: "How the quantity and price were derived" },
        },
        required: ["description", "quantity", "unit", "rate_cents", "basis"],
        additionalProperties: false,
      },
    },
    measurements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["label", "value", "confidence"],
        additionalProperties: false,
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
  },
  required: ["items", "measurements", "assumptions"],
  additionalProperties: false,
} as const;

export const ESTIMATOR_SYSTEM_PROMPT = [
  "You are a senior estimator for a trade contracting business. You produce PRECISE, CONSISTENT, itemized estimates.",
  "Rules you must follow exactly:",
  "1. Break the job into sequential steps (prep, materials, labor, equipment, disposal, cleanup) — one line item per step.",
  "2. When the contractor's rate book contains a matching item, you MUST use that exact rate. Never invent a different price for a rate-book item.",
  "3. Estimate measurements (square footage, linear feet, counts) from the photos using visible reference objects (doors ~80in tall, standard brick 8in, siding courses, outlet height 12in, stair rise 7in). State the reference used in 'basis'.",
  "4. Round measured areas UP to the nearest 5 sq ft and quantities to sensible purchase units. Add a standard 10% material waste factor and say so.",
  "5. rate_cents is the price PER UNIT in cents, never the line total.",
  "6. Never guess wildly: if a measurement cannot be derived from the photos, mark its confidence 'low' and list the missing information in assumptions.",
  "7. Deterministic output: given the same photos and description, produce the same numbers.",
  "8. Return 3–12 line items. Never include client personal information.",
].join("\n");

export type PricingRule = { label: string; unit: string; rate_cents: number; notes: string | null };

export function formatRateBook(rules: PricingRule[], currency: string) {
  if (!rules.length) {
    return "(none provided — use conservative regional market rates and say so in assumptions)";
  }
  return rules
    .map(
      (r) =>
        `- ${r.label}: ${(r.rate_cents / 100).toFixed(2)} ${currency} per ${r.unit}${r.notes ? ` (${r.notes})` : ""}`,
    )
    .join("\n");
}

export function isPaidPlan(status: string | null | undefined, end: string | null | undefined) {
  const activeUntil = end ? new Date(end) : null;
  const expired = activeUntil ? activeUntil.getTime() < Date.now() : false;
  return (
    !expired &&
    ["pro", "business", "active", "active_pro", "active_business", "trialing"].includes(
      status ?? "free",
    )
  );
}

export function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type EmailEstimate = {
  estimate_number: string;
  currency: string;
  job_description: string | null;
  notes: string | null;
  expiry_date: string | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
};

export function buildEstimateEmailHtml(
  estimate: EmailEstimate,
  items: Array<{
    description: string;
    quantity: number;
    rate_cents: number;
    amount_cents: number | null;
  }>,
  businessName: string,
  message?: string,
) {
  const currency = estimate.currency || "USD";
  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);

  const rows = items
    .map(
      (it) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(it.description)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${it.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${money(it.rate_cents)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${money(it.amount_cents ?? Math.round(it.quantity * it.rate_cents))}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
      <h1 style="font-size:20px;margin:0 0 4px">Estimate ${escapeHtml(estimate.estimate_number)}</h1>
      <p style="margin:0 0 16px;color:#6b7280">from ${escapeHtml(businessName)}</p>
      ${message ? `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ""}
      ${estimate.job_description ? `<p style="background:#f9fafb;padding:12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(estimate.job_description)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
        <thead>
          <tr style="text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase">
            <th style="padding:8px 12px">Item</th><th style="padding:8px 12px;text-align:right">Qty</th>
            <th style="padding:8px 12px;text-align:right">Rate</th><th style="padding:8px 12px;text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;margin-top:12px;font-size:14px">
        <tr><td style="text-align:right;padding:4px 12px;color:#6b7280">Subtotal</td><td style="text-align:right;padding:4px 12px;width:120px">${money(estimate.subtotal_cents)}</td></tr>
        <tr><td style="text-align:right;padding:4px 12px;color:#6b7280">Tax</td><td style="text-align:right;padding:4px 12px">${money(estimate.tax_cents)}</td></tr>
        <tr><td style="text-align:right;padding:8px 12px;font-weight:bold">Total</td><td style="text-align:right;padding:8px 12px;font-weight:bold">${money(estimate.total_cents)}</td></tr>
      </table>
      ${estimate.notes ? `<p style="margin-top:16px;color:#374151;white-space:pre-wrap">${escapeHtml(estimate.notes)}</p>` : ""}
      ${estimate.expiry_date ? `<p style="color:#6b7280;font-size:12px">This estimate is valid through ${escapeHtml(String(estimate.expiry_date))}.</p>` : ""}
      <p style="margin-top:24px;font-size:12px;color:#6b7280">Reply to this email with any questions or to approve the work.</p>
    </div>`;
}
