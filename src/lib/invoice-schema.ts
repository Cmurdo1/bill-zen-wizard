import { supabase } from "@/integrations/supabase/client";
import type { LineItem } from "@/lib/documents";
import { brandingPresetsClient, hasBrandingPresetColumn } from "@/lib/branding-presets";

/**
 * The deployed live database uses a legacy invoices schema (dollar amounts:
 * `total_amount` / `tax_amount`, `type`, `payment_term`, items with
 * `unit_price` and a generated `total` column), while this repo's migrations
 * define a cents schema (`subtotal_cents` / `tax_cents` / `total_cents`,
 * `currency`, `tax_rate`, items with `rate_cents` / `amount_cents`).
 *
 * These helpers probe once and adapt so invoice create / list / edit / email
 * work against either schema.
 */

let legacyCache: boolean | null = null;

export async function isLegacyInvoiceSchema(): Promise<boolean> {
  if (legacyCache !== null) return legacyCache;
  const { error } = (await supabase.from("invoices").select("total_cents").limit(1)) as unknown as {
    error: { code?: string } | null;
  };
  legacyCache = !!(error && error.code === "42703");
  return legacyCache;
}

export type UnifiedInvoice = {
  id: string;
  invoice_number: string;
  status: string;
  client_id: string | null;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  job_description: string | null;
  tax_rate: number;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  paid_at: string | null;
  branding_preset_id: string | null;
};

/** Map a raw invoices row (either schema) to the unified shape used by the UI. */
export function mapInvoiceRow(row: Record<string, unknown>): UnifiedInvoice {
  const legacy = "total_amount" in row;
  const totalAmount = Number(row.total_amount ?? 0);
  const taxAmount = Number(row.tax_amount ?? 0);
  const totalCents = legacy ? Math.round(totalAmount * 100) : Number(row.total_cents ?? 0);
  const taxCents = legacy ? Math.round(taxAmount * 100) : Number(row.tax_cents ?? 0);
  return {
    id: String(row.id),
    invoice_number: String(row.invoice_number ?? ""),
    status: String(row.status ?? "draft"),
    client_id: (row.client_id as string | null) ?? null,
    job_description: (row.job_description as string | null) ?? null,
    issue_date: String(
      row.issue_date ?? String(row.created_at ?? new Date().toISOString()).slice(0, 10),
    ),
    due_date: (row.due_date as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    tax_rate: legacy ? (totalCents > 0 ? taxCents / totalCents : 0) : Number(row.tax_rate ?? 0),
    subtotal_cents: legacy ? totalCents - taxCents : Number(row.subtotal_cents ?? 0),
    tax_cents: taxCents,
    total_cents: totalCents,
    currency: String(row.currency ?? "USD"),
    paid_at: (row.paid_at as string | null) ?? null,
    branding_preset_id: (row.branding_preset_id as string | null) ?? null,
  };
}

/** Columns that only exist once the branding-presets migration is applied. */
async function invoiceColumns(legacy: boolean): Promise<string> {
  const base = legacy
    ? "id,invoice_number,status,client_id,due_date,notes,created_at,total_amount,tax_amount,job_description"
    : "id,invoice_number,status,client_id,issue_date,due_date,notes,tax_rate,subtotal_cents,tax_cents,total_cents,currency,paid_at,job_description";
  const hasPreset = await hasBrandingPresetColumn();
  return hasPreset ? `${base},branding_preset_id` : base;
}

export async function fetchInvoiceList(): Promise<UnifiedInvoice[]> {
  const legacy = await isLegacyInvoiceSchema();
  const columns = await invoiceColumns(legacy);
  // Legacy deployments keep estimates in the same table (type='estimate');
  // the new schema has a dedicated estimates table.
  let query = supabase.from("invoices").select(columns) as unknown as {
    eq: (c: string, v: string) => unknown;
    order: (
      c: string,
      o: { ascending: boolean },
    ) => PromiseLike<{
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    }>;
  };
  if (legacy) {
    query = query.eq("type", "invoice") as typeof query;
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapInvoiceRow);
}

export async function fetchInvoice(id: string): Promise<UnifiedInvoice | null> {
  const legacy = await isLegacyInvoiceSchema();
  const columns = await invoiceColumns(legacy);
  let query = supabase.from("invoices").select(columns).eq("id", id) as unknown as {
    eq: (c: string, v: string) => unknown;
    maybeSingle: () => PromiseLike<{
      data: Record<string, unknown> | null;
      error: { message: string } | null;
    }>;
  };
  if (legacy) {
    query = query.eq("type", "invoice") as typeof query;
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? mapInvoiceRow(data) : null;
}

export async function fetchInvoiceItems(invoiceId: string): Promise<LineItem[]> {
  const legacy = await isLegacyInvoiceSchema();
  const columns = legacy
    ? "description,quantity,unit_price,sort_order"
    : "description,quantity,rate_cents,sort_order";
  const { data, error } = (await supabase
    .from("invoice_items")
    .select(columns)
    .eq("invoice_id", invoiceId)
    .order("sort_order")) as unknown as {
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;
  return (data ?? []).map((r) => ({
    description: String(r.description ?? ""),
    quantity: Number(r.quantity ?? 1),
    rate_cents: legacy ? Math.round(Number(r.unit_price ?? 0) * 100) : Number(r.rate_cents ?? 0),
  }));
}

export async function insertInvoiceItems(invoiceId: string, items: LineItem[]): Promise<void> {
  if (!items.length) return;
  const legacy = await isLegacyInvoiceSchema();
  const rows = items.map((it, i) =>
    legacy
      ? {
          invoice_id: invoiceId,
          description: it.description,
          quantity: it.quantity,
          unit_price: Number(((it.rate_cents || 0) / 100).toFixed(2)),
          sort_order: i,
        }
      : {
          invoice_id: invoiceId,
          description: it.description,
          quantity: it.quantity,
          rate_cents: it.rate_cents,
          amount_cents: Math.round((it.quantity || 0) * (it.rate_cents || 0)),
          sort_order: i,
        },
  );
  const { error } = (await supabase.from("invoice_items").insert(rows as never)) as unknown as {
    error: { message: string } | null;
  };
  if (error) throw error;
}

export async function replaceInvoiceItems(invoiceId: string, items: LineItem[]): Promise<void> {
  const { error: dErr } = (await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceId)) as unknown as { error: { message: string } | null };
  if (dErr) throw dErr;
  await insertInvoiceItems(invoiceId, items);
}

export async function updateInvoiceTotals(invoiceId: string, taxRate: number): Promise<void> {
  const legacy = await isLegacyInvoiceSchema();
  const items = await fetchInvoiceItems(invoiceId);
  const subtotalCents = items.reduce(
    (s, i) => s + Math.round((i.quantity || 0) * (i.rate_cents || 0)),
    0,
  );
  const taxCents = Math.round(subtotalCents * taxRate);
  const totalCents = subtotalCents + taxCents;
  const patch = legacy
    ? {
        total_amount: Number((totalCents / 100).toFixed(2)),
        tax_amount: Number((taxCents / 100).toFixed(2)),
      }
    : { subtotal_cents: subtotalCents, tax_cents: taxCents, total_cents: totalCents };
  const { error } = (await supabase
    .from("invoices")
    .update(patch as never)
    .eq("id", invoiceId)) as unknown as { error: { message: string } | null };
  if (error) throw error;
}

/**
 * Next document number parts: profile counters on the new schema, otherwise
 * derived from existing invoices on legacy deployments (no counter columns).
 */
export async function nextInvoiceNumberInfo(): Promise<{ prefix: string; num: number }> {
  const legacy = await isLegacyInvoiceSchema();
  if (!legacy) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = (await supabase
        .from("profiles")
        .select("invoice_prefix,next_invoice_number")
        .eq("id", user.id)
        .maybeSingle()) as unknown as {
        data: { invoice_prefix: string | null; next_invoice_number: number | null } | null;
      };
      if (profile?.invoice_prefix != null) {
        return { prefix: profile.invoice_prefix, num: profile.next_invoice_number ?? 1001 };
      }
    }
  }
  const { data, error } = (await supabase
    .from("invoices")
    .select("invoice_number")
    .order("created_at", { ascending: false })
    .limit(100)) as unknown as {
    data: { invoice_number: string | null }[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;
  let max = 0;
  for (const r of data ?? []) {
    const m = String(r.invoice_number ?? "").match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return { prefix: "INV", num: max + 1 };
}

/** Forget the cached schema probe (e.g. on sign-out or schema migration). */
export function resetLegacySchemaCache(): void {
  legacyCache = null;
  profileSchemaLegacy = null;
}

export async function createInvoiceRecord(input: {
  client_id?: string | null;
  job_description?: string | null;
  notes?: string | null;
  due_date?: string | null;
  issue_date?: string | null;
  currency?: string | null;
  branding_preset_id?: string | null;
}): Promise<{ id: string; invoice_number: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const legacy = await isLegacyInvoiceSchema();
  const { prefix, num } = await nextInvoiceNumberInfo();
  const documentNumber = `${prefix}-${num}`;

  const due = new Date();
  due.setDate(due.getDate() + 30);

  const common: Record<string, unknown> = {
    user_id: user.id,
    client_id: input.client_id || null,
    job_description: input.job_description || null,
    notes: input.notes || null,
    status: "draft",
    invoice_number: documentNumber,
    due_date: input.due_date || due.toISOString().slice(0, 10),
  };
  // Only persist the preset once the migration has added the column.
  if (await hasBrandingPresetColumn()) {
    common.branding_preset_id = input.branding_preset_id || null;
  }
  const insert = legacy
    ? {
        ...common,
        type: "invoice",
        total_amount: 0,
        tax_amount: 0,
        payment_term: "due_on_receipt",
      }
    : {
        ...common,
        issue_date: input.issue_date || new Date().toISOString().slice(0, 10),
        currency: input.currency || "USD",
        tax_rate: 0,
        subtotal_cents: 0,
        tax_cents: 0,
        total_cents: 0,
      };

  const { data, error } = (await supabase
    .from("invoices")
    .insert(insert as never)
    .select("id,invoice_number")
    .single()) as unknown as {
    data: { id: string; invoice_number: string } | null;
    error: { message: string } | null;
  };
  if (error) throw error;
  if (!data) throw new Error("Could not create invoice");

  // Bump the profile counter on the new schema (legacy derives each time).
  if (!legacy) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        next_invoice_number: num + 1,
      });
    }
  }

  return data;
}

/** Patch an invoice with unified fields; converts to dollars on the legacy schema. */
export async function updateInvoiceRecord(
  id: string,
  patch: Partial<UnifiedInvoice>,
): Promise<void> {
  const legacy = await isLegacyInvoiceSchema();
  // True partial patch: only write keys the caller actually provided, so a
  // status-only update (e.g. marking converted) never wipes other fields.
  const common: Record<string, unknown> = {};
  if (patch.client_id !== undefined) common.client_id = patch.client_id ?? null;
  if (patch.due_date !== undefined) common.due_date = patch.due_date ?? null;
  if (patch.notes !== undefined) common.notes = patch.notes ?? null;
  if (patch.status !== undefined) common.status = patch.status;
  if (patch.branding_preset_id !== undefined && (await hasBrandingPresetColumn())) {
    common.branding_preset_id = patch.branding_preset_id ?? null;
  }
  const dbPatch = legacy
    ? {
        ...common,
        total_amount:
          patch.total_cents !== undefined
            ? Number((patch.total_cents / 100).toFixed(2))
            : undefined,
        tax_amount:
          patch.tax_cents !== undefined ? Number((patch.tax_cents / 100).toFixed(2)) : undefined,
      }
    : {
        ...common,
        issue_date: patch.issue_date,
        currency: patch.currency,
        tax_rate: patch.tax_rate,
        subtotal_cents: patch.subtotal_cents,
        tax_cents: patch.tax_cents,
        total_cents: patch.total_cents,
      };
  const clean = Object.fromEntries(Object.entries(dbPatch).filter(([, v]) => v !== undefined));
  const { error } = (await supabase
    .from("invoices")
    .update(clean as never)
    .eq("id", id)) as unknown as { error: { message: string } | null };
  if (error) throw error;
}

/** Mark an invoice sent: legacy bumps sent_count on the invoices row. */
export async function markInvoiceSent(id: string): Promise<void> {
  const legacy = await isLegacyInvoiceSchema();
  if (legacy) {
    const { data: row } = (await supabase
      .from("invoices")
      .select("sent_count")
      .eq("id", id)
      .maybeSingle()) as unknown as { data: { sent_count: number | null } | null };
    const { error } = (await supabase
      .from("invoices")
      .update({ status: "sent", sent_count: (Number(row?.sent_count) || 0) + 1 } as never)
      .eq("id", id)) as unknown as { error: { message: string } | null };
    if (error) throw error;
    return;
  }
  const { error } = (await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() } as never)
    .eq("id", id)) as unknown as { error: { message: string } | null };
  if (error) throw error;
}

let profileSchemaLegacy: boolean | null = null;

/**
 * Legacy profiles store the display name in `business_name` only — the repo's
 * new schema adds `company_name` / `full_name`. Probing avoids a 400 that
 * would otherwise make the business name silently empty.
 */
export async function isLegacyProfileSchema(): Promise<boolean> {
  if (profileSchemaLegacy !== null) return profileSchemaLegacy;
  const { error } = (await supabase
    .from("profiles")
    .select("company_name")
    .limit(1)) as unknown as { error: { code?: string } | null };
  profileSchemaLegacy = !!(error && error.code === "42703");
  return profileSchemaLegacy;
}

/**
 * Business name for email subjects: a document's branding preset wins, then
 * legacy profiles use `business_name`, then company/full name.
 */
export async function fetchBusinessName(presetId?: string | null): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";

  // A document created under a branding preset is sent with that brand name.
  if (presetId) {
    const { data: preset } = (await brandingPresetsClient()
      .select("business_name")
      .eq("id", presetId)
      .maybeSingle()) as unknown as {
      data: { business_name: string | null } | null;
      error: { message: string } | null;
    };
    if (preset?.business_name) return preset.business_name;
  }

  const legacy = await isLegacyProfileSchema();
  const columns = legacy ? "business_name" : "business_name,company_name,full_name";
  const { data: profile } = (await supabase
    .from("profiles")
    .select(columns as never)
    .eq("id", user.id)
    .maybeSingle()) as unknown as {
    data: {
      business_name: string | null;
      company_name?: string | null;
      full_name?: string | null;
    } | null;
  };
  return profile?.business_name || profile?.company_name || profile?.full_name || "";
}
