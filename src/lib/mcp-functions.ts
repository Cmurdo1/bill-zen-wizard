import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mcpPlanFromSubscription } from "@/lib/mcp-api-shared";

// Server functions for MCP to call
const CreateDocumentInput = z.object({
  type: z.enum(["invoice", "estimate"]),
  client_id: z.string().uuid().optional().nullable(),
  client_name: z.string().optional().nullable(),
  client_email: z.string().email().optional().nullable(),
  job_description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  tax_rate: z.number().default(0),
  currency: z.string().length(3).default("USD"),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        rate_cents: z.number().nonnegative(),
      }),
    )
    .min(1),
});

const SendDocumentInput = z.object({
  document_id: z.string().uuid(),
  document_type: z.enum(["invoice", "estimate"]),
  to_email: z.string().email(),
  custom_message: z.string().optional(),
});

const ListDocumentsInput = z.object({
  type: z.enum(["invoice", "estimate", "all"]).default("all"),
  status: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

const ExtractInput = z.object({
  description: z.string().trim().min(4).max(4000),
  currency: z.string().length(3).default("USD"),
});

const ExtractSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          rate_cents: {
            type: "integer",
            description: "Unit price in the smallest currency unit (cents)",
          },
        },
        required: ["description", "quantity", "rate_cents"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

// Create document server function
export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateDocumentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check plan limits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_status,subscription_end")
      .eq("id", context.userId)
      .maybeSingle();

    const status = profile?.subscription_status ?? "free";
    const paidPlan = Boolean(mcpPlanFromSubscription(status, profile?.subscription_end));

    if (!paidPlan) {
      throw new Error("MCP access requires an active Pro or Business plan.");
    }

    if (data.client_id) {
      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("id", data.client_id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (clientError) throw clientError;
      if (!client) throw new Error("Client does not belong to this account.");
    }

    // Get next invoice/estimate number
    const { data: profileNum } = await supabaseAdmin
      .from("profiles")
      .select(
        data.type === "invoice"
          ? "invoice_prefix,next_invoice_number"
          : "estimate_prefix,next_estimate_number",
      )
      .eq("id", context.userId)
      .maybeSingle();

    const prefix =
      data.type === "invoice"
        ? (profileNum?.invoice_prefix ?? "INV")
        : (profileNum?.estimate_prefix ?? "EST");
    const nextNum =
      data.type === "invoice"
        ? (profileNum?.next_invoice_number ?? 1001)
        : (profileNum?.next_estimate_number ?? 1001);

    const documentNumber = `${prefix}-${nextNum}`;

    // Calculate totals
    const subtotal_cents = data.items.reduce(
      (sum, item) => sum + Math.round(item.quantity * item.rate_cents),
      0,
    );
    const tax_cents = Math.round(subtotal_cents * (data.tax_rate / 100));
    const total_cents = subtotal_cents + tax_cents;

    // Insert document
    const tableName = data.type === "invoice" ? "invoices" : "estimates";
    const itemsTableName = data.type === "invoice" ? "invoice_items" : "estimate_items";

    const { data: doc, error: docError } = await supabaseAdmin
      .from(tableName)
      .insert({
        user_id: context.userId,
        client_id: data.client_id || null,
        invoice_number: data.type === "invoice" ? documentNumber : null,
        estimate_number: data.type === "estimate" ? documentNumber : null,
        status: "draft",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: data.due_date || null,
        expiry_date: data.expiry_date || null,
        notes: data.notes || null,
        job_description: data.job_description || null,
        tax_rate: data.tax_rate,
        subtotal_cents,
        tax_cents,
        total_cents,
        currency: data.currency,
      })
      .select()
      .single();

    if (docError) throw docError;

    // Insert items
    const itemsToInsert = data.items.map((item, index) => ({
      [data.type === "invoice" ? "invoice_id" : "estimate_id"]: doc.id,
      description: item.description,
      quantity: item.quantity,
      rate_cents: item.rate_cents,
      amount_cents: Math.round(item.quantity * item.rate_cents),
      sort_order: index,
    }));

    const { error: itemsError } = await supabaseAdmin.from(itemsTableName).insert(itemsToInsert);

    if (itemsError) throw itemsError;

    // Update next number
    await supabaseAdmin.from("profiles").upsert({
      id: context.userId,
      [data.type === "invoice" ? "next_invoice_number" : "next_estimate_number"]: nextNum + 1,
    });

    return {
      success: true,
      document: {
        ...doc,
        items: data.items,
      },
    };
  });

// List documents server function
export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListDocumentsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_status,subscription_end")
      .eq("id", context.userId)
      .maybeSingle();
    if (!mcpPlanFromSubscription(profile?.subscription_status, profile?.subscription_end)) {
      throw new Error("MCP access requires an active Pro or Business plan.");
    }

    let query = supabaseAdmin
      .from(data.type === "estimate" ? "estimates" : "invoices")
      .select(
        "*, client:clients(*), items:" +
          (data.type === "estimate" ? "estimate_items" : "invoice_items") +
          "(*)",
        { count: "exact" },
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.status) {
      query = query.eq("status", data.status);
    }

    const { data: docs, error, count } = await query;
    if (error) throw error;

    return {
      documents: docs || [],
      total: count || 0,
      limit: data.limit,
      offset: data.offset,
    };
  });

// Send document server function
export const sendDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendDocumentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_status,subscription_end")
      .eq("id", context.userId)
      .maybeSingle();
    if (!mcpPlanFromSubscription(profile?.subscription_status, profile?.subscription_end)) {
      throw new Error("MCP access requires an active Pro or Business plan.");
    }

    // Verify document belongs to user
    const tableName = data.document_type === "invoice" ? "invoices" : "estimates";
    const { data: doc, error: docError } = await supabaseAdmin
      .from(tableName)
      .select("*")
      .eq("id", data.document_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (docError) throw docError;
    if (!doc) throw new Error("Document not found");

    // Send email via lovable API
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://api.lovable.dev/v1/messaging/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        to: data.to_email,
        subject: `${data.document_type === "estimate" ? "Estimate" : "Invoice"} ${data.document_type === "invoice" ? doc.invoice_number : doc.estimate_number} from your business`,
        template: "invoice",
        data: {
          client_name: data.to_email.split("@")[0], // fallback
          invoice_number:
            data.document_type === "invoice" ? doc.invoice_number : doc.estimate_number,
          total_amount: doc.total_cents / 100,
          due_date: data.document_type === "invoice" ? doc.due_date : doc.expiry_date,
          business_name: "your business",
          job_description: doc.job_description,
          document_type: data.document_type,
          custom_message: data.custom_message,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Email send failed (${res.status}): ${body.slice(0, 200)}`);
    }

    // Update status to sent
    await supabaseAdmin
      .from(tableName)
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.document_id)
      .eq("user_id", context.userId);

    return { success: true };
  });

// Extract line items server function (AI)
export const extractLineItemsMCP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check plan
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_status,subscription_end")
      .eq("id", context.userId)
      .maybeSingle();

    const status = profile?.subscription_status ?? "free";
    const paidPlan = Boolean(mcpPlanFromSubscription(status, profile?.subscription_end));

    if (!paidPlan) {
      throw new Error("AI line-item extraction requires a Pro or Business plan.");
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract invoice line items from a plain-English job description. Return realistic USD unit prices in cents. Split labor and materials. Be concise: 1–8 items max. Never invent client PII.",
          },
          {
            role: "user",
            content: `Currency: ${data.currency}\n\nJob description:\n${data.description}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_line_items",
              description: "Return the extracted invoice line items",
              parameters: ExtractSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_line_items" } },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429)
        throw new Error("AI is busy right now — please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const payload = await res.json();
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI returned no line items");

    const parsed = JSON.parse(call.function.arguments);
    const items = (
      parsed.items as Array<{ description: string; quantity: number; rate_cents: number }>
    ).map((it) => ({
      description: String(it.description).slice(0, 500),
      quantity: Number(it.quantity) || 1,
      rate_cents: Math.max(0, Math.round(Number(it.rate_cents) || 0)),
    }));

    return { items };
  });
