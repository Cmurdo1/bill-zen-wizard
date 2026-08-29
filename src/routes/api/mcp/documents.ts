import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  completeMcpIdempotencyKey,
  createMcpContext,
  hashMcpRequestBody,
  enforceMcpActionRateLimit,
  isLegacyInvoiceSchema,
  mcpErrorResponse,
  releaseMcpIdempotencyKey,
  reserveMcpIdempotencyKey,
  McpHttpError,
  assertMcpScope,
  logMcpAction,
} from "@/lib/mcp-api-shared";

const ItemSchema = z.object({
  description: z.string().trim().min(1).max(1000),
  quantity: z.number().positive().max(1_000_000),
  rate_cents: z.number().nonnegative().max(1_000_000_000),
});

const ItemsSchema = z.array(ItemSchema).min(1).max(100);

const CreateDocumentInput = z.object({
  type: z.enum(["invoice", "estimate"]),
  client_id: z.string().uuid().optional().nullable(),
  client_name: z.string().trim().max(200).optional().nullable(),
  client_email: z.string().trim().email().max(255).optional().nullable(),
  job_description: z.string().trim().max(10_000).optional().nullable(),
  notes: z.string().trim().max(10_000).optional().nullable(),
  due_date: z.string().max(30).optional().nullable(),
  expiry_date: z.string().max(30).optional().nullable(),
  tax_rate: z.number().min(0).max(100).default(0),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase())
    .default("USD"),
  items: ItemsSchema,
});

const SendDocumentInput = z.object({
  document_id: z.string().uuid(),
  document_type: z.enum(["invoice", "estimate"]),
  to_email: z.string().trim().email().max(255),
  custom_message: z.string().trim().max(10_000).optional(),
});

const ListDocumentsInput = z.object({
  type: z.enum(["invoice", "estimate", "all"]).default("all"),
  status: z.string().trim().max(30).optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().max(10_000).default(0),
});

const UpdateDocumentInput = z.object({
  document_id: z.string().uuid(),
  document_type: z.enum(["invoice", "estimate"]),
  client_id: z.string().uuid().nullable().optional(),
  issue_date: z.string().max(30).optional().nullable(),
  due_date: z.string().max(30).optional().nullable(),
  expiry_date: z.string().max(30).optional().nullable(),
  job_description: z.string().trim().max(10_000).optional().nullable(),
  notes: z.string().trim().max(10_000).optional().nullable(),
  tax_rate: z.number().min(0).max(100).optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  status: z
    .enum(["draft", "sent", "paid", "overdue", "void", "accepted", "rejected", "expired"])
    .optional(),
  items: ItemsSchema.optional(),
});

export const Route = createFileRoute("/api/mcp/documents")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          const { userId, supabase } = context;
          assertMcpScope(context, "read");

          const { searchParams } = new URL(request.url);
          const parsedList = ListDocumentsInput.parse({
            type: searchParams.get("type") || undefined,
            status: searchParams.get("status") || undefined,
            limit: Number(searchParams.get("limit") || 20),
            offset: Number(searchParams.get("offset") || 0),
          });
          const { type, status, limit, offset } = parsedList;

          const legacy = await isLegacyInvoiceSchema(supabase);
          // Use separate, account-scoped queries because invoices and estimates
          // are separate tables on the current schema and share one table on
          // older deployments.
          const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          const queryDocuments = async (table: string, itemsTable: string, typeFilter?: string) => {
            let query = db
              .from(table)
              .select("*, client:clients(*), items:" + itemsTable + "(*)", { count: "exact" })
              .eq("user_id", userId)
              .order("created_at", { ascending: false });
            if (typeFilter) query = query.eq("type", typeFilter);
            if (status) query = query.eq("status", status);
            return query;
          };

          const queries = legacy
            ? [
                await queryDocuments(
                  "invoices",
                  "invoice_items",
                  type === "estimate" ? "estimate" : type === "invoice" ? "invoice" : undefined,
                ),
              ]
            : type === "all"
              ? [
                  await queryDocuments("invoices", "invoice_items"),
                  await queryDocuments("estimates", "estimate_items"),
                ]
              : [
                  await queryDocuments(
                    type === "estimate" ? "estimates" : "invoices",
                    type === "estimate" ? "estimate_items" : "invoice_items",
                  ),
                ];

          const settled = await Promise.all(queries);
          const firstError = settled.find((result) => result.error)?.error;
          if (firstError) throw firstError;
          const documents = settled
            .flatMap((result) => result.data ?? [])
            .sort(
              (a, b) =>
                new Date(String(b.created_at ?? 0)).getTime() -
                new Date(String(a.created_at ?? 0)).getTime(),
            );
          const total = documents.length;
          const page = documents.slice(offset, offset + limit);

          return new Response(
            JSON.stringify({
              documents: page,
              total,
              limit,
              offset,
              has_more: offset + page.length < total,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
            },
          );
        } catch (e) {
          return mcpErrorResponse(e);
        }
      },

      POST: async ({ request }) => {
        let idempotencyKey: string | null = null;
        let idempotencyContext: Awaited<ReturnType<typeof createMcpContext>> | null = null;
        let mutationSucceeded = false;
        try {
          const context = await createMcpContext(request);
          idempotencyContext = context;
          const { userId, supabase } = context;
          assertMcpScope(context, "write");
          await enforceMcpActionRateLimit(context, "write");
          const reservation = await reserveMcpIdempotencyKey(
            context,
            request,
            "documents.create",
            await hashMcpRequestBody(request),
          );
          idempotencyKey = reservation.key;
          if (reservation.replay) return reservation.replay;

          const body = await request.json();
          const parsed = CreateDocumentInput.parse(body);

          // A client reference must belong to the same authenticated account.
          // Never let an agent attach another user's client to this document.
          if (parsed.client_id) {
            const { data: client, error: clientError } = await supabase
              .from("clients")
              .select("id")
              .eq("id", parsed.client_id)
              .eq("user_id", userId)
              .maybeSingle();
            if (clientError) throw clientError;
            if (!client) throw new McpHttpError(403, "Client does not belong to this account.");
          }

          // createMcpContext has already required an active Pro or Business
          // subscription. Free accounts cannot reach this handler.
          const isEstimate = parsed.type === "estimate";
          const legacy = await isLegacyInvoiceSchema(supabase);
          const tableName = legacy ? "invoices" : isEstimate ? "estimates" : "invoices";
          const itemsTableName = legacy
            ? "invoice_items"
            : isEstimate
              ? "estimate_items"
              : "invoice_items";
          const numberField = legacy
            ? "invoice_number"
            : isEstimate
              ? "estimate_number"
              : "invoice_number";

          // Resolve the document number. Prefer the profile counters when they
          // exist (new schema); otherwise derive from existing documents so the
          // route also works on legacy deployments without those columns.
          const counterField = isEstimate
            ? "estimate_prefix,next_estimate_number"
            : "invoice_prefix,next_invoice_number";
          const prefixField = isEstimate ? "estimate_prefix" : "invoice_prefix";
          const nextField = isEstimate ? "next_estimate_number" : "next_invoice_number";

          let prefix = isEstimate ? "EST" : "INV";
          let nextNum = 1001;
          let countersAvailable = false;

          const { data: profileNum, error: profileNumErr } = await supabase
            .from("profiles")
            .select(counterField)
            .eq("id", userId)
            .maybeSingle();

          const counters = profileNum as Record<string, unknown> | null;
          if (!profileNumErr && counters?.[prefixField]) {
            prefix = String(counters[prefixField]);
            nextNum = Number(counters[nextField]) || 1001;
            countersAvailable = true;
          } else {
            let docsQuery = supabase
              .from(tableName)
              .select(numberField)
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(100);
            if (legacy) (docsQuery as any).eq("type", parsed.type);
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

          const subtotal_cents = parsed.items.reduce(
            (sum, item) => sum + Math.round(item.quantity * item.rate_cents),
            0,
          );
          const tax_cents = Math.round(subtotal_cents * (parsed.tax_rate / 100));
          const total_cents = subtotal_cents + tax_cents;

          // Schema-adaptive inserts intentionally bypass the generated types so
          // the route works on both the repo (cents) and legacy (dollars) schemas.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = supabase as any;

          const common = {
            user_id: userId,
            client_id: parsed.client_id || null,
            [numberField]: documentNumber,
            status: "draft",
            notes: parsed.notes || null,
            job_description: parsed.job_description || null,
          };

          const { data: doc, error: docError } = legacy
            ? await db
                .from(tableName)
                .insert({
                  ...common,
                  type: parsed.type,
                  due_date: parsed.due_date || null,
                  total_amount: Number((total_cents / 100).toFixed(2)),
                  tax_amount: Number((tax_cents / 100).toFixed(2)),
                  payment_term: "due_on_receipt",
                })
                .select()
                .single()
            : await db
                .from(tableName)
                .insert({
                  ...common,
                  issue_date: new Date().toISOString().split("T")[0],
                  due_date: parsed.due_date || null,
                  expiry_date: parsed.expiry_date || null,
                  tax_rate: parsed.tax_rate,
                  subtotal_cents,
                  tax_cents,
                  total_cents,
                  currency: parsed.currency,
                })
                .select()
                .single();

          if (docError) throw docError;

          const itemsToInsert = parsed.items.map((item, index) => {
            const amount_cents = Math.round(item.quantity * item.rate_cents);
            const base = {
              [legacy || !isEstimate ? "invoice_id" : "estimate_id"]: doc.id,
              description: item.description,
              quantity: item.quantity,
              sort_order: index,
            };
            return legacy
              ? {
                  ...base,
                  unit_price: Number((item.rate_cents / 100).toFixed(2)),
                  // "total" is a generated column on legacy deployments.
                }
              : {
                  ...base,
                  rate_cents: item.rate_cents,
                  amount_cents,
                };
          });

          const { error: itemsError } = await db.from(itemsTableName).insert(itemsToInsert);

          if (itemsError) {
            // Best-effort rollback is internal only; no public delete operation
            // is exposed to agents. Keep the predicate account-scoped.
            await db.from(tableName).delete().eq("id", doc.id).eq("user_id", userId);
            throw itemsError;
          }

          mutationSucceeded = true;

          // Bump the profile counter only when the column exists (new schema).
          if (countersAvailable) {
            await db.from("profiles").upsert({
              id: userId,
              [nextField]: nextNum + 1,
            });
          }

          const responseBody = {
            success: true,
            document: {
              ...doc,
              items: parsed.items,
            },
          };
          // Persist the replay response before audit logging. If logging is
          // temporarily unavailable after the mutation succeeds, a retry still
          // receives the original response instead of creating another document.
          await completeMcpIdempotencyKey(
            context,
            "documents.create",
            idempotencyKey,
            201,
            responseBody,
          );
          await logMcpAction(context, "create", parsed.type, doc.id, {
            item_count: parsed.items.length,
          });
          return new Response(JSON.stringify(responseBody), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          if (idempotencyContext && !mutationSucceeded) {
            await releaseMcpIdempotencyKey(idempotencyContext, "documents.create", idempotencyKey);
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

      PATCH: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          const { userId, supabase } = context;
          assertMcpScope(context, "write");
          await enforceMcpActionRateLimit(context, "write");
          const parsed = UpdateDocumentInput.parse(await request.json());
          const legacy = await isLegacyInvoiceSchema(supabase);
          const tableName = legacy
            ? "invoices"
            : parsed.document_type === "estimate"
              ? "estimates"
              : "invoices";
          const itemsTableName = legacy
            ? "invoice_items"
            : parsed.document_type === "estimate"
              ? "estimate_items"
              : "invoice_items";
          const itemForeignKey = legacy
            ? "invoice_id"
            : parsed.document_type === "estimate"
              ? "estimate_id"
              : "invoice_id";
          const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

          if (parsed.client_id) {
            const { data: client, error: clientError } = await supabase
              .from("clients")
              .select("id")
              .eq("id", parsed.client_id)
              .eq("user_id", userId)
              .maybeSingle();
            if (clientError) throw clientError;
            if (!client) throw new McpHttpError(403, "Client does not belong to this account.");
          }

          let documentQuery = supabase
            .from(tableName)
            .select("*")
            .eq("id", parsed.document_id)
            .eq("user_id", userId);
          if (legacy) (documentQuery as any).eq("type", parsed.document_type);
          const { data: current, error: currentError } = await documentQuery.maybeSingle();
          if (currentError) throw currentError;
          if (!current) throw new McpHttpError(404, "Document not found");

          const currentRow = current as Record<string, unknown>;
          let items = parsed.items;
          if (!items) {
            const { data: currentItems, error: itemsError } = await db
              .from(itemsTableName)
              .select("*")
              .eq(itemForeignKey, parsed.document_id)
              .order("sort_order");
            if (itemsError) throw itemsError;
            items = (currentItems ?? []).map((item: Record<string, unknown>) => ({
              description: String(item.description ?? ""),
              quantity: Number(item.quantity ?? 1),
              rate_cents: legacy
                ? Math.round(Number(item.unit_price ?? 0) * 100)
                : Number(item.rate_cents ?? 0),
            }));
          }

          const taxRate = parsed.tax_rate ?? Number(currentRow.tax_rate ?? 0);
          const subtotalCents = (items ?? []).reduce(
            (sum, item) => sum + Math.round(item.quantity * item.rate_cents),
            0,
          );
          const taxCents = Math.round(subtotalCents * (taxRate / 100));
          const clean: Record<string, unknown> = {
            ...(parsed.client_id !== undefined ? { client_id: parsed.client_id } : {}),
            ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
            ...(parsed.job_description !== undefined
              ? { job_description: parsed.job_description }
              : {}),
            ...(parsed.status !== undefined ? { status: parsed.status } : {}),
          };

          if (legacy) {
            if (parsed.due_date !== undefined) clean.due_date = parsed.due_date;
            clean.total_amount = Number(((subtotalCents + taxCents) / 100).toFixed(2));
            clean.tax_amount = Number((taxCents / 100).toFixed(2));
          } else {
            if (parsed.issue_date !== undefined) clean.issue_date = parsed.issue_date;
            if (parsed.due_date !== undefined) clean.due_date = parsed.due_date;
            if (parsed.expiry_date !== undefined && parsed.document_type === "estimate") {
              clean.expiry_date = parsed.expiry_date;
            }
            if (parsed.currency !== undefined) clean.currency = parsed.currency;
            clean.tax_rate = taxRate;
            clean.subtotal_cents = subtotalCents;
            clean.tax_cents = taxCents;
            clean.total_cents = subtotalCents + taxCents;
          }

          const { data: updated, error: updateError } = await db
            .from(tableName)
            .update(clean)
            .eq("id", parsed.document_id)
            .eq("user_id", userId)
            .select()
            .single();
          if (updateError) throw updateError;

          if (parsed.items) {
            const { error: deleteError } = await db
              .from(itemsTableName)
              .delete()
              .eq(itemForeignKey, parsed.document_id);
            if (deleteError) throw deleteError;
            const itemRows = (items ?? []).map((item, index) =>
              legacy
                ? {
                    invoice_id: parsed.document_id,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: Number((item.rate_cents / 100).toFixed(2)),
                    sort_order: index,
                  }
                : {
                    [itemForeignKey]: parsed.document_id,
                    description: item.description,
                    quantity: item.quantity,
                    rate_cents: item.rate_cents,
                    amount_cents: Math.round(item.quantity * item.rate_cents),
                    sort_order: index,
                  },
            );
            const { error: insertError } = await db.from(itemsTableName).insert(itemRows);
            if (insertError) throw insertError;
          }

          await logMcpAction(context, "update", parsed.document_type, parsed.document_id, {
            fields: Object.keys(parsed).filter((key) => key !== "items"),
            item_count: parsed.items?.length,
          });
          return new Response(JSON.stringify({ document: updated }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch (e) {
          if (e instanceof z.ZodError) {
            return new Response(
              JSON.stringify({ error: "Invalid document update", details: e.errors }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
          return mcpErrorResponse(e);
        }
      },
    },
  },
});
