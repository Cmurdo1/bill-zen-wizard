import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  completeMcpIdempotencyKey,
  createMcpContext,
  hashMcpRequestBody,
  enforceMcpActionRateLimit,
  isLegacyInvoiceSchema,
  mcpErrorResponse,
  McpHttpError,
  releaseMcpIdempotencyKey,
  reserveMcpIdempotencyKey,
  assertMcpScope,
  logMcpAction,
} from "@/lib/mcp-api-shared";
import { escapeHtml } from "@/lib/estimate-ai";

const SendDocumentInput = z.object({
  document_id: z.string().uuid(),
  document_type: z.enum(["invoice", "estimate"]),
  to_email: z.string().email(),
  custom_message: z.string().optional(),
});

function buildDocumentEmailHtml(params: {
  documentType: "invoice" | "estimate";
  number: string;
  businessName: string;
  currency: string;
  jobDescription: string | null;
  notes: string | null;
  dueDate: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  items: Array<{ description: string; quantity: number; rateCents: number; amountCents: number }>;
  message?: string;
}) {
  const {
    documentType,
    number,
    businessName,
    currency,
    jobDescription,
    notes,
    dueDate,
    subtotalCents,
    taxCents,
    totalCents,
    items,
    message,
  } = params;

  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);

  const label = documentType === "invoice" ? "Invoice" : "Estimate";
  const rows = items
    .map(
      (it) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(it.description)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${it.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${money(it.rateCents)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${money(it.amountCents)}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
      <h1 style="font-size:20px;margin:0 0 4px">${label} ${escapeHtml(number)}</h1>
      <p style="margin:0 0 16px;color:#6b7280">from ${escapeHtml(businessName)}</p>
      ${message ? `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ""}
      ${jobDescription ? `<p style="background:#f9fafb;padding:12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(jobDescription)}</p>` : ""}
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
        <tr><td style="text-align:right;padding:4px 12px;color:#6b7280">Subtotal</td><td style="text-align:right;padding:4px 12px;width:120px">${money(subtotalCents)}</td></tr>
        <tr><td style="text-align:right;padding:4px 12px;color:#6b7280">Tax</td><td style="text-align:right;padding:4px 12px">${money(taxCents)}</td></tr>
        <tr><td style="text-align:right;padding:8px 12px;font-weight:bold">Total</td><td style="text-align:right;padding:8px 12px;font-weight:bold">${money(totalCents)}</td></tr>
      </table>
      ${notes ? `<p style="margin-top:16px;color:#374151;white-space:pre-wrap">${escapeHtml(notes)}</p>` : ""}
      ${dueDate ? `<p style="color:#6b7280;font-size:12px">${documentType === "invoice" ? "Due" : "Valid through"} ${escapeHtml(String(dueDate))}.</p>` : ""}
      <p style="margin-top:24px;font-size:12px;color:#6b7280">Reply to this email with any questions.</p>
    </div>`;
}

export const Route = createFileRoute("/api/mcp/documents/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let idempotencyKey: string | null = null;
        let idempotencyContext: Awaited<ReturnType<typeof createMcpContext>> | null = null;
        let sendSucceeded = false;
        try {
          const context = await createMcpContext(request);
          idempotencyContext = context;
          const { userId, supabase } = context;
          assertMcpScope(context, "send");
          await enforceMcpActionRateLimit(context, "send");
          const reservation = await reserveMcpIdempotencyKey(
            context,
            request,
            "documents.send",
            await hashMcpRequestBody(request),
          );
          idempotencyKey = reservation.key;
          if (reservation.replay) return reservation.replay;

          const body = await request.json();
          const parsed = SendDocumentInput.parse(body);
          // Recipient addresses are matched case-insensitively by email providers
          // (Resend's allow-list is exact-match), so normalize to lowercase.
          parsed.to_email = parsed.to_email.toLowerCase();

          const tableName = parsed.document_type === "invoice" ? "invoices" : "estimates";
          const itemsTableName =
            parsed.document_type === "invoice" ? "invoice_items" : "estimate_items";
          const numberField =
            parsed.document_type === "invoice" ? "invoice_number" : "estimate_number";

          const { data: doc, error: docError } = await supabase
            .from(tableName)
            .select("*")
            .eq("id", parsed.document_id)
            .eq("user_id", userId)
            .maybeSingle();

          if (docError) throw docError;
          if (!doc) throw new McpHttpError(404, "Document not found");

          // Schema-adaptive reads intentionally bypass the generated types so the
          // route works on both the repo (cents) and legacy (dollars) schemas.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = supabase as any;
          const row = doc as Record<string, unknown>;

          const [{ data: items }, { data: profile }] = await Promise.all([
            db
              .from(itemsTableName)
              .select("*")
              .eq(
                parsed.document_type === "invoice" ? "invoice_id" : "estimate_id",
                parsed.document_id,
              )
              .order("sort_order"),
            supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
          ]);

          const p = profile as Record<string, unknown> | null;
          const businessName =
            String(p?.business_name || p?.company_name || p?.full_name || "") || "Your contractor";
          const legacy = await isLegacyInvoiceSchema(supabase);

          const currency = String(row.currency || "USD");
          const subtotalCents = legacy
            ? Math.round(Number(row.subtotal_amount ?? row.total_amount ?? 0) * 100)
            : Number(row.subtotal_cents ?? 0);
          const taxCents = legacy
            ? Math.round(Number(row.tax_amount ?? 0) * 100)
            : Number(row.tax_cents ?? 0);
          const totalCents = legacy
            ? Math.round(Number(row.total_amount ?? 0) * 100)
            : Number(row.total_cents ?? 0);

          const emailItems = (items ?? []).map((it: Record<string, unknown>) => {
            const rateCents = legacy
              ? Math.round(Number(it.unit_price ?? 0) * 100)
              : Number(it.rate_cents ?? 0);
            const amountCents = legacy
              ? Math.round(Number(it.total ?? 0) * 100)
              : Number(it.amount_cents ?? Math.round(Number(it.quantity) * rateCents));
            return {
              description: String(it.description ?? ""),
              quantity: Number(it.quantity ?? 1),
              rateCents,
              amountCents,
            };
          });

          const docNumber = String(row[numberField] ?? "");
          const html = buildDocumentEmailHtml({
            documentType: parsed.document_type,
            number: docNumber,
            businessName,
            currency,
            jobDescription: row.job_description ? String(row.job_description) : null,
            notes: row.notes ? String(row.notes) : null,
            dueDate: row.due_date
              ? String(row.due_date)
              : row.expiry_date
                ? String(row.expiry_date)
                : null,
            subtotalCents,
            taxCents,
            totalCents,
            items: emailItems,
            message: parsed.custom_message,
          });

          const subject = `${parsed.document_type === "invoice" ? "Invoice" : "Estimate"} ${docNumber} from ${businessName}`;

          const resendKey = process.env["RESEND_API_KEY"];

          if (!resendKey) {
            throw new McpHttpError(
              500,
              "Email is not configured yet. Set RESEND_API_KEY to send document emails.",
            );
          }

          // Self-contained HTML straight through Resend's API.
          const from = process.env["RESEND_FROM"] || `${businessName} <onboarding@resend.dev>`;
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from,
              to: [parsed.to_email],
              ...(p?.email ? { reply_to: String(p.email) } : {}),
              subject,
              html,
            }),
          });

          if (!emailRes.ok) {
            const errBody = await emailRes.text();
            throw new Error(`Email send failed [${emailRes.status}]: ${errBody.slice(0, 300)}`);
          }
          sendSucceeded = true;

          // Mark as sent. Legacy deployments track a sent counter; new schema stores sent_at.
          if (legacy) {
            await db
              .from(tableName)
              .update({ status: "sent", sent_count: (Number(row.sent_count) || 0) + 1 })
              .eq("id", parsed.document_id)
              .eq("user_id", userId);
          } else {
            await db
              .from(tableName)
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", parsed.document_id)
              .eq("user_id", userId);
          }

          const responseBody = { success: true, sent_to: parsed.to_email };
          await completeMcpIdempotencyKey(
            context,
            "documents.send",
            idempotencyKey,
            200,
            responseBody,
          );
          await logMcpAction(context, "send", parsed.document_type, parsed.document_id, {
            sent_to: parsed.to_email,
          });

          return new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          if (idempotencyContext && !sendSucceeded) {
            await releaseMcpIdempotencyKey(idempotencyContext, "documents.send", idempotencyKey);
          }
          if (e instanceof z.ZodError) {
            return new Response(JSON.stringify({ error: "Invalid input", details: e.errors }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          return mcpErrorResponse(e);
        }
      },
    },
  },
});
