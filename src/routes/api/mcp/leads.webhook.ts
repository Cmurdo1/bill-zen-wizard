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
import { extractLineItemsWithAI } from "@/lib/ai-extract";

/**
 * POST /api/mcp/leads/webhook
 *
 * Receives a scraped lead (from Craigslist, Nextdoor, etc.) and auto-creates
 * an estimate, then sends it to the lead's contact email. Used by external
 * scraping services and MCP agents to respond to leads in real-time.
 *
 * Requires a valid Supabase user JWT in the Authorization header.
 * Requires an active Pro or Business plan. The authenticated account owns the
 * lead and estimate; Business is required for automated scraping.
 *
 * Webhook payload shape:
 * {
 *   "title": "Need HVAC condenser replaced",
 *   "description": "3-ton Lennox, 6 hours labor expected...",
 *   "location": "Atlanta, GA",
 *   "contact_email": "customer@example.com",
 *   "contact_phone": "+15551234567",       // optional
 *   "budget_range": "2000-4000",           // optional
 *   "source": "craigslist",                // craigslist | nextdoor | facebook
 *   "client_name": "Jane Smith",           // optional — falls back to contact_email prefix
 *   "tax_rate": 7.25,                      // optional — defaults to 0
 *   "auto_send": true                      // optional — auto-email the estimate
 * }
 */

const LeadWebhookInput = z.object({
  title: z.string().min(3).max(500),
  description: z.string().min(10).max(5000),
  location: z.string().min(1).max(200),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  budget_range: z.string().optional(),
  source: z.enum(["craigslist", "nextdoor", "facebook", "manual"]).default("manual"),
  client_name: z.string().optional(),
  tax_rate: z.number().min(0).max(100).default(0),
  auto_send: z.boolean().default(true),
});

export const Route = createFileRoute("/api/mcp/leads/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let leadId: string | null = null;
        let idempotencyKey: string | null = null;
        let idempotencyContext: Awaited<ReturnType<typeof createMcpContext>> | null = null;
        let leadProcessSucceeded = false;

        try {
          const context = await createMcpContext(request);
          idempotencyContext = context;
          const { userId, supabase } = context;
          assertMcpScope(context, "leads");
          await enforceMcpActionRateLimit(context, "leads");
          const reservation = await reserveMcpIdempotencyKey(
            context,
            request,
            "leads.webhook",
            await hashMcpRequestBody(request),
          );
          idempotencyKey = reservation.key;
          if (reservation.replay) return reservation.replay;

          const body = await request.json();
          const parsed = LeadWebhookInput.parse(body);

          const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

          // Pro plans include 2 leads/month (as advertised on /pricing);
          // Business plans get unlimited lead generation.
          if (context.plan === "pro") {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const { count, error: countError } = await db
              .from("job_leads")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .gte("created_at", monthStart.toISOString());
            if (countError) throw countError;
            if ((count ?? 0) >= 2) {
              throw new McpHttpError(
                403,
                "The Pro plan includes 2 leads per month. Upgrade to Business for unlimited leads.",
              );
            }
          }

          // Read the authenticated account's branding once and use it for the
          // estimate email. The MCP token never gets to choose another account.
          const { data: accountProfile } = await supabase
            .from("profiles")
            .select("business_name,company_name,full_name,email")
            .eq("id", userId)
            .maybeSingle();
          const businessName = String(
            accountProfile?.business_name ||
              accountProfile?.company_name ||
              accountProfile?.full_name ||
              "Your contractor",
          );

          // 1. Insert the job lead
          const { data: lead, error: leadError } = await db
            .from("job_leads")
            .insert({
              user_id: userId,
              title: parsed.title,
              description: parsed.description,
              location: parsed.location,
              contact_email: parsed.contact_email,
              contact_phone: parsed.contact_phone || null,
              budget_range: parsed.budget_range || null,
              source: parsed.source,
              status: "new",
            })
            .select()
            .single();

          if (leadError) throw leadError;
          leadId = lead.id;

          // 2. Determine client name
          const clientName =
            parsed.client_name?.trim() || parsed.contact_email.split("@")[0] || "Prospect";

          // 3. Log the incoming webhook
          await db.from("webhook_logs").insert({
            type: "lead",
            source: parsed.source,
            payload: parsed,
            status: "received",
          });

          // 4. Create the estimate via the existing documents API pattern
          const legacy = await isLegacyInvoiceSchema(supabase);
          const tableName = legacy ? "invoices" : "estimates";
          const itemsTableName = legacy ? "invoice_items" : "estimate_items";
          const numberField = legacy ? "invoice_number" : "estimate_number";

          let prefix = "EST";
          let nextNum = 1001;
          let countersAvailable = false;

          const { data: profileNum, error: profileNumErr } = await db
            .from("profiles")
            .select("estimate_prefix,next_estimate_number")
            .eq("id", userId)
            .maybeSingle();

          const counters = profileNum as Record<string, unknown> | null;
          if (!profileNumErr && counters?.estimate_prefix) {
            prefix = String(counters.estimate_prefix);
            nextNum = Number(counters.next_estimate_number) || 1001;
            countersAvailable = true;
          } else {
            let docsQuery = db
              .from(tableName)
              .select(numberField)
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(100);
            if (legacy) docsQuery = docsQuery.eq("type", "estimate");
            const { data: docs } = await docsQuery;
            let maxNum = 0;
            for (const doc of docs ?? []) {
              const match = String(
                (doc as unknown as Record<string, unknown>)?.[numberField] ?? "",
              ).match(/(\d+)\s*$/);
              if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
            }
            nextNum = maxNum + 1;
          }

          const documentNumber = `${prefix}-${nextNum}`;

          // 5. Extract line items via AI for this paid MCP account.
          let items: Array<{ description: string; quantity: number; rate_cents: number }>;

          {
            // Use AI extraction (OpenRouter primary, NVIDIA backup) for paid MCP accounts.
            try {
              const result = await extractLineItemsWithAI({
                description: `${parsed.title}\n${parsed.description}`,
                currency: "USD",
              });
              items = result.items.map((it) => ({
                description: it.description,
                quantity: it.quantity,
                rate_cents: it.rate_cents,
              }));
              if (!items.length) throw new Error("No line items extracted");
            } catch {
              items = [
                {
                  description: parsed.title,
                  quantity: 1,
                  rate_cents: 0,
                },
              ];
            }
          }

          const subtotal_cents = items.reduce(
            (sum, item) => sum + Math.round(item.quantity * item.rate_cents),
            0,
          );
          const tax_cents = Math.round(subtotal_cents * (parsed.tax_rate / 100));
          const total_cents = subtotal_cents + tax_cents;

          const common = {
            user_id: userId,
            client_id: null,
            [numberField]: documentNumber,
            status: "draft",
            notes: `Auto-generated from ${parsed.source} lead. Location: ${parsed.location}`,
            job_description: `${parsed.title}\n\n${parsed.description}`,
          };

          let doc: Record<string, unknown>;

          if (legacy) {
            const { data: legacyDoc, error: docError } = await db
              .from(tableName)
              .insert({
                ...common,
                type: "estimate",
                total_amount: Number((total_cents / 100).toFixed(2)),
                tax_amount: Number((tax_cents / 100).toFixed(2)),
              })
              .select()
              .single();
            if (docError) throw docError;
            doc = legacyDoc;
          } else {
            const { data: newDoc, error: docError } = await db
              .from(tableName)
              .insert({
                ...common,
                issue_date: new Date().toISOString().split("T")[0],
                expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                tax_rate: parsed.tax_rate,
                subtotal_cents,
                tax_cents,
                total_cents,
                currency: "USD",
              })
              .select()
              .single();
            if (docError) throw docError;
            doc = newDoc;
          }

          // Insert items
          const itemsToInsert = items.map((item, index) => {
            const amount_cents = Math.round(item.quantity * item.rate_cents);
            const base = {
              [legacy ? "invoice_id" : "estimate_id"]: doc.id,
              description: item.description,
              quantity: item.quantity,
              sort_order: index,
            };
            return legacy
              ? {
                  ...base,
                  unit_price: Number((item.rate_cents / 100).toFixed(2)),
                }
              : {
                  ...base,
                  rate_cents: item.rate_cents,
                  amount_cents,
                };
          });

          const { error: itemsError } = await db.from(itemsTableName).insert(itemsToInsert);

          if (itemsError) {
            await db.from(tableName).delete().eq("id", doc.id).eq("user_id", userId);
            throw itemsError;
          }

          if (countersAvailable) {
            await db.from("profiles").upsert({
              id: userId,
              next_estimate_number: nextNum + 1,
            });
          }

          // 6. Generate a tracking ID for email open/click tracking
          const trackingId = crypto.randomUUID();
          const baseUrl = process.env["APP_URL"] || "https://honestinvoice.com";
          const pixelUrl = `${baseUrl}/api/mcp/leads/track?t=open&tid=${encodeURIComponent(trackingId)}`;
          const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;

          // 7. Auto-send the estimate if requested (attempt BEFORE marking DB as sent)
          let sentResult: { sent: boolean; error?: string } = { sent: false };

          if (parsed.auto_send) {
            try {
              const resendKey = process.env["RESEND_API_KEY"];

              if (resendKey) {
                const from =
                  process.env["RESEND_FROM"] || `${businessName} <onboarding@resend.dev>`;
                const emailRes = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${resendKey}`,
                  },
                  body: JSON.stringify({
                    from,
                    to: [parsed.contact_email],
                    ...(accountProfile?.email ? { reply_to: accountProfile.email } : {}),
                    subject: `Estimate ${documentNumber} — ${parsed.title}`,
                    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                      <h2>Estimate ${escapeHtml(documentNumber)}</h2>
                      <p>Hi ${escapeHtml(clientName)},</p>
                      <p>We saw your post on ${escapeHtml(parsed.source)} about "${escapeHtml(parsed.title)}".</p>
                      <p>Based on your description, we've prepared an estimate for you. Here's a summary:</p>
                      <p style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:8px">${escapeHtml(parsed.description)}</p>
                      <p><strong>Location:</strong> ${escapeHtml(parsed.location)}</p>
                      <p>Reply to this email with any questions or to schedule a site visit.</p>
                      <p style="margin-top:24px;font-size:12px;color:#6b7280">
                        <a href="${baseUrl}/api/mcp/leads/track?t=click&tid=${encodeURIComponent(trackingId)}&url=${encodeURIComponent(baseUrl)}" style="color:#6b7280;text-decoration:none">Sent via Honest Invoice MCP</a> — AI-powered estimating for service businesses.
                      </p>
                      ${trackingPixel}
                    </div>`,
                  }),
                });
                if (!emailRes.ok) {
                  sentResult = { sent: false, error: `Resend returned ${emailRes.status}` };
                } else {
                  sentResult = { sent: true };
                }
              } else {
                sentResult = {
                  sent: false,
                  error: "No email provider configured (set RESEND_API_KEY)",
                };
              }
            } catch (e) {
              sentResult = { sent: false, error: e instanceof Error ? e.message : String(e) };
            }

            // Only mark as sent in DB if email actually succeeded
            if (sentResult.sent) {
              await db
                .from(tableName)
                .update({
                  status: "sent",
                  ...(legacy ? {} : { sent_at: new Date().toISOString() }),
                })
                .eq("id", doc.id)
                .eq("user_id", userId);
            }
          }

          // 8. Record the lead response with tracking ID
          await db.from("lead_responses").insert({
            lead_id: leadId,
            user_id: userId,
            estimate_id: doc.id,
            estimate_number: documentNumber,
            client_email: parsed.contact_email,
            tracking_id: trackingId,
            status: sentResult.sent ? "estimate_sent" : "pending",
            ...(sentResult.error ? { error_message: sentResult.error } : {}),
          });

          const responseBody = {
            success: true,
            lead_id: leadId,
            estimate: {
              id: doc.id,
              number: documentNumber,
              total_cents,
              items,
            },
            sent: sentResult,
          };
          leadProcessSucceeded = true;
          await completeMcpIdempotencyKey(
            context,
            "leads.webhook",
            idempotencyKey,
            201,
            responseBody,
          );
          await logMcpAction(context, "process_lead", "lead", leadId ?? undefined, {
            estimate_id: String(doc.id),
            sent: sentResult.sent,
          });

          return new Response(JSON.stringify(responseBody), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          if (idempotencyContext && !leadProcessSucceeded) {
            await releaseMcpIdempotencyKey(idempotencyContext, "leads.webhook", idempotencyKey);
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
