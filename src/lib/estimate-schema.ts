import { supabase } from "@/integrations/supabase/client";
import type { LineItem } from "@/lib/documents";

/**
 * On the legacy live database there is no `estimates` table — estimates are
 * stored as rows in `invoices` with `type='estimate'`, and their line items
 * live in `invoice_items`. The repo's migrations use dedicated
 * `estimates` / `estimate_items` tables with cents columns.
 *
 * These helpers probe once and adapt so estimate create / list / edit / email
 * work against either schema.
 */

let legacyCache: boolean | null = null;

export async function isLegacyEstimateSchema(): Promise<boolean> {
  if (legacyCache !== null) return legacyCache;
  const { error } = (await supabase
    .from("estimates")
    .select("id")
    .limit(1)) as unknown as { error: { code?: string } | null };
  // PGRST116 is "no rows" (table exists); 42P01 is "undefined table".
  legacyCache = !!(error && error.code === "42P01");
  return legacyCache;
}

/** Forget the cached probe (e.g. on sign-out or schema migration). */
export function resetLegacyEstimateCache(): void {
  legacyCache = null;
}

export type UnifiedEstimate = {
  id: string;
  estimate_number: string;
  status: string;
  client_id: string | null;
  issue_date: string;
  expiry_date: string | null;
  notes: string | null;
  job_description: string | null;
  tax_rate: number;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  converted_invoice_id: string | null;
  approved_at: string | null;
  sent_at: string | null;
  sent_to_email: string | null;
};

type RawList = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
};
type RawSingle = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

/** Map a raw estimate row (either schema) to the unified shape used by the UI. */
export function mapEstimateRow(row: Record<string, unknown>): UnifiedEstimate {
  const legacy = !("estimate_number" in row);
  const totalAmount = Number(row.total_amount ?? 0);
  const taxAmount = Number(row.tax_amount ?? 0);
  const totalCents = legacy ? Math.round(totalAmount * 100) : Number(row.total_cents ?? 0);
  const taxCents = legacy ? Math.round(taxAmount * 100) : Number(row.tax_cents ?? 0);
  return {
    id: String(row.id),
    estimate_number: String(row.estimate_number ?? row.invoice_number ?? ""),
    status: String(row.status ?? "draft"),
    client_id: (row.client_id as string | null) ?? null,
    issue_date: String(
      row.issue_date ?? String(row.created_at ?? new Date().toISOString()).slice(0, 10),
    ),
    // Legacy stores the expiry in the shared `due_date` column.
    expiry_date: (row.expiry_date as string | null) ?? (row.due_date as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    job_description: (row.job_description as string | null) ?? null,
    tax_rate: legacy
      ? totalCents > 0
        ? taxCents / totalCents
        : 0
      : Number(row.tax_rate ?? 0),
    subtotal_cents: legacy ? totalCents - taxCents : Number(row.subtotal_cents ?? 0),
    tax_cents: taxCents,
    total_cents: totalCents,
    currency: String(row.currency ?? "USD"),
    converted_invoice_id: (row.converted_invoice_id as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
    sent_at: (row.sent_at as string | null) ?? null,
    sent_to_email: (row.sent_to_email as string | null) ?? null,
  };
}

const LIST_COLUMNS =
  "id,estimate_number,status,client_id,issue_date,expiry_date,notes,created_at,tax_rate,subtotal_cents,tax_cents,total_cents,currency,job_description";
const LIST_COLUMNS_LEGACY =
  "id,invoice_number,status,client_id,due_date,notes,created_at,total_amount,tax_amount,job_description";

export async function fetchEstimateList(): Promise<UnifiedEstimate[]> {
  const legacy = await isLegacyEstimateSchema();
  const { data, error } = (await (legacy
    ? supabase
        .from("invoices")
        .select(LIST_COLUMNS_LEGACY)
        .eq("type", "estimate")
        .order("created_at", { ascending: false })
    : supabase
        .from("estimates")
        .select(LIST_COLUMNS)
        .order("created_at", { ascending: false })
  ).then((r) => r as RawList)) as unknown as RawList;
  if (error) throw error;
  return (data ?? []).map(mapEstimateRow);
}

export async function fetchEstimate(id: string): Promise<UnifiedEstimate | null> {
  const legacy = await isLegacyEstimateSchema();
  const { data, error } = (await (legacy
    ? supabase.from("invoices").select(LIST_COLUMNS_LEGACY).eq("id", id).eq("type", "estimate")
    : supabase.from("estimates").select(LIST_COLUMNS).eq("id", id)
  ).then((r) => r as RawSingle)) as unknown as RawSingle;
  if (error) throw error;
  return data ? mapEstimateRow(data) : null;
}

export async function fetchEstimateItems(estimateId: string): Promise<LineItem[]> {
  const legacy = await isLegacyEstimateSchema();
  const { data, error } = (await (legacy
    ? supabase
        .from("invoice_items")
        .select("description,quantity,unit_price,sort_order")
        .eq("invoice_id", estimateId)
        .order("sort_order")
    : supabase
        .from("estimate_items")
        .select("description,quantity,rate_cents,sort_order")
        .eq("estimate_id", estimateId)
        .order("sort_order")
  ).then((r) => r as RawList)) as unknown as RawList;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    description: String(r.description ?? ""),
    quantity: Number(r.quantity ?? 1),
    rate_cents: legacy
      ? Math.round(Number(r.unit_price ?? 0) * 100)
      : Number(r.rate_cents ?? 0),
  }));
}

export async function insertEstimateItems(estimateId: string, items: LineItem[]): Promise<void> {
  if (!items.length) return;
  const legacy = await isLegacyEstimateSchema();
  const rows = items.map((it, i) =>
    legacy
      ? {
          invoice_id: estimateId,
          description: it.description,
          quantity: it.quantity,
          unit_price: Number(((it.rate_cents || 0) / 100).toFixed(2)),
          sort_order: i,
        }
      : {
          estimate_id: estimateId,
          description: it.description,
          quantity: it.quantity,
          rate_cents: it.rate_cents,
          amount_cents: Math.round((it.quantity || 0) * (it.rate_cents || 0)),
          sort_order: i,
        },
  );
  const { error } = (await (legacy
    ? supabase.from("invoice_items").insert(rows as never)
    : supabase.from("estimate_items").insert(rows as never)
  ).then((r) => r)) as unknown as { error: { message: string } | null };
  if (error) throw error;
}

export async function replaceEstimateItems(estimateId: string, items: LineItem[]): Promise<void> {
  const legacy = await isLegacyEstimateSchema();
  const { error: dErr } = (await (legacy
    ? supabase.from("invoice_items").delete().eq("invoice_id", estimateId)
    : supabase.from("estimate_items").delete().eq("estimate_id", estimateId)
  ).then((r) => r)) as unknown as { error: { message: string } | null };
  if (dErr) throw dErr;
  await insertEstimateItems(estimateId, items);
}

export async function updateEstimateTotals(estimateId: string, taxRate: number): Promise<void> {
  const legacy = await isLegacyEstimateSchema();
  const items = await fetchEstimateItems(estimateId);
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
  const { error } = (await (legacy
    ? supabase.from("invoices").update(patch as never)
    : supabase.from("estimates").update(patch as never)
  ).then((r) => r)) as unknown as { error: { message: string } | null };
  if (error) throw error;
}

export async function nextEstimateNumberInfo(): Promise<{ prefix: string; num: number }> {
  const legacy = await isLegacyEstimateSchema();
  if (!legacy) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = (await supabase
        .from("profiles")
        .select("estimate_prefix,next_estimate_number")
        .eq("id", user.id)
        .maybeSingle()) as unknown as {
        data: { estimate_prefix: string | null; next_estimate_number: number | null } | null;
      };
      if (profile?.estimate_prefix != null) {
        return { prefix: profile.estimate_prefix, num: profile.next_estimate_number ?? 1001 };
      }
    }
  }
  // Legacy: estimates share the invoices table, so derive from ALL invoices to
  // guarantee no number collision between estimates and invoices.
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
  return { prefix: "EST", num: max + 1 };
}

export async function createEstimateRecord(input: {
  client_id?: string | null;
  job_description?: string | null;
  notes?: string | null;
  expiry_date?: string | null;
}): Promise<{ id: string; estimate_number: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const legacy = await isLegacyEstimateSchema();
  const { prefix, num } = await nextEstimateNumberInfo();
  const estimateNumber = `${prefix}-${num}`;

  const due = new Date();
  due.setDate(due.getDate() + 30);

  const common = {
    user_id: user.id,
    client_id: input.client_id || null,
    job_description: input.job_description || null,
    notes: input.notes || null,
    status: "draft",
  };
  const insert = legacy
    ? {
        ...common,
        invoice_number: estimateNumber,
        type: "estimate",
        due_date: input.expiry_date || due.toISOString().slice(0, 10),
        total_amount: 0,
        tax_amount: 0,
        payment_term: null,
      }
    : {
        ...common,
        estimate_number: estimateNumber,
        expiry_date: input.expiry_date || due.toISOString().slice(0, 10),
        issue_date: new Date().toISOString().slice(0, 10),
        currency: "USD",
        tax_rate: 0,
        subtotal_cents: 0,
        tax_cents: 0,
        total_cents: 0,
      };

  const table = (legacy
    ? supabase.from("invoices")
    : supabase.from("estimates")
  ) as unknown as {
    insert: (r: unknown) => {
      select: (c: string) => {
        single: () => PromiseLike<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { data, error } = await table.insert(insert).select("id").single();
  if (error) throw error;
  if (!data) throw new Error("Could not create estimate");

  if (!legacy) {
    await supabase.from("profiles").upsert({
      id: user.id,
      next_estimate_number: num + 1,
    });
  }

  return { id: String(data.id), estimate_number: estimateNumber };
}

/** Patch an estimate with unified fields; converts to the legacy invoices shape. */
export async function updateEstimateRecord(
  id: string,
  patch: Partial<UnifiedEstimate>,
): Promise<void> {
  const legacy = await isLegacyEstimateSchema();
  // True partial patch: only write keys the caller actually provided, so a
  // status-only update (e.g. marking converted) never wipes other fields.
  const common: Record<string, unknown> = {};
  if (patch.client_id !== undefined) common.client_id = patch.client_id ?? null;
  if (patch.notes !== undefined) common.notes = patch.notes ?? null;
  if (patch.job_description !== undefined) common.job_description = patch.job_description ?? null;
  if (patch.status !== undefined) common.status = patch.status;
  const dbPatch = legacy
    ? {
        ...common,
        due_date: patch.expiry_date ?? null,
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
        expiry_date: patch.expiry_date ?? null,
        currency: patch.currency,
        tax_rate: patch.tax_rate,
        subtotal_cents: patch.subtotal_cents,
        tax_cents: patch.tax_cents,
        total_cents: patch.total_cents,
      };
  const clean = Object.fromEntries(Object.entries(dbPatch).filter(([, v]) => v !== undefined));
  const { error } = (await (legacy
    ? supabase.from("invoices").update(clean as never)
    : supabase.from("estimates").update(clean as never)
  ).then((r) => r)) as unknown as { error: { message: string } | null };
  if (error) throw error;
}

export async function deleteEstimateRecord(id: string): Promise<void> {
  const legacy = await isLegacyEstimateSchema();
  const { error } = (await (legacy
    ? supabase.from("invoices").delete().eq("id", id)
    : supabase.from("estimates").delete().eq("id", id)
  ).then((r) => r)) as unknown as { error: { message: string } | null };
  if (error) throw error;
}


