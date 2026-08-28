import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AnalyzeInput,
  SendInput,
  isPaidPlan,
  buildEstimateEmailHtml,
  type PricingRule,
} from "@/lib/estimate-ai";
import { extractLineItemsWithAI } from "@/lib/ai-extract";

/** Legacy deployments store estimates in `invoices` with type='estimate'. */
async function isLegacy(supabase: unknown): Promise<boolean> {
  const client = supabase as {
    from: (t: string) => {
      select: (c: string) => {
        limit: (n: number) => PromiseLike<{ error: { code?: string } | null }>;
      };
    };
  };
  const { error } = await client.from("estimates").select("id").limit(1);
  // Missing table surfaces as 42P01 (Postgres) or PGRST205 (PostgREST).
  const code = error?.code;
  return code === "42P01" || code === "PGRST205";
}

/** Legacy profiles store the display name in `business_name` only. */
let profileLegacyCache: boolean | null = null;
async function isLegacyProfile(supabase: unknown): Promise<boolean> {
  if (profileLegacyCache !== null) return profileLegacyCache;
  const client = supabase as {
    from: (t: string) => {
      select: (c: string) => {
        limit: (n: number) => PromiseLike<{ error: { code?: string } | null }>;
      };
    };
  };
  const { error } = await client.from("profiles").select("company_name").limit(1);
  profileLegacyCache = !!(error && error.code === "42703");
  return profileLegacyCache;
}

/** Normalize a raw estimate row (either schema) for the email template. */
function normalizeForEmail(
  row: Record<string, unknown>,
  legacy: boolean,
): {
  estimate_number: string;
  currency: string;
  job_description: string | null;
  notes: string | null;
  expiry_date: string | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
} {
  const totalCents = legacy
    ? Math.round(Number(row.total_amount ?? 0) * 100)
    : Number(row.total_cents ?? 0);
  const taxCents = legacy
    ? Math.round(Number(row.tax_amount ?? 0) * 100)
    : Number(row.tax_cents ?? 0);
  return {
    estimate_number: String(row.estimate_number ?? row.invoice_number ?? ""),
    currency: String(row.currency ?? "USD"),
    job_description: (row.job_description as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    expiry_date: (row.expiry_date as string | null) ?? (row.due_date as string | null) ?? null,
    subtotal_cents: legacy ? totalCents - taxCents : Number(row.subtotal_cents ?? 0),
    tax_cents: taxCents,
    total_cents: totalCents,
  };
}

export const analyzeEstimatePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status,subscription_end")
      .eq("id", userId)
      .maybeSingle();
    if (!isPaidPlan(profile?.subscription_status, profile?.subscription_end)) {
      throw new Error("AI photo estimating requires a Pro or Business plan.");
    }

    const legacy = await isLegacy(supabase);

    const estimateQuery = legacy
      ? supabase
          .from("invoices")
          .select("id")
          .eq("id", data.estimateId)
          .eq("user_id", userId)
          .eq("type", "estimate")
      : supabase.from("estimates").select("id").eq("id", data.estimateId).eq("user_id", userId);
    const { data: estimate } = await estimateQuery.maybeSingle();
    if (!estimate) throw new Error("Estimate not found");

    // Legacy has no estimate_photos table — photos are best-effort.
    let photos: Array<{ storage_path: string; caption: string | null }> = [];
    if (!legacy) {
      const { data: photoRows } = (await supabase
        .from("estimate_photos")
        .select("storage_path,caption")
        .eq("estimate_id", data.estimateId)
        .order("created_at")) as unknown as {
        data: Array<{ storage_path: string; caption: string | null }> | null;
      };
      photos = photoRows ?? [];
    }

    const imageBlocks: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    for (const p of photos) {
      const { data: signed } = await supabase.storage
        .from("estimate-photos")
        .createSignedUrl(p.storage_path, 1800);
      if (signed?.signedUrl)
        imageBlocks.push({ type: "image_url", image_url: { url: signed.signedUrl } });
    }

    const { data: rules } = await supabase
      .from("pricing_rules")
      .select("label,unit,rate_cents,notes")
      .eq("user_id", userId)
      .order("label");

    const result = await extractLineItemsWithAI({
      description: data.description,
      currency: data.currency,
      rules: (rules ?? []) as PricingRule[],
      imageBlocks,
    });

    return {
      items: result.items.map((it) => ({
        description: `${it.description}${it.unit ? ` (${it.quantity} ${it.unit})` : ""}`,
        quantity: it.quantity,
        rate_cents: it.rate_cents,
        basis: it.basis,
      })),
      measurements: result.measurements,
      assumptions: result.assumptions,
    };
  });

export const sendEstimateEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const legacy = await isLegacy(supabase);

    const estQuery = legacy
      ? supabase
          .from("invoices")
          .select("*")
          .eq("id", data.estimateId)
          .eq("user_id", userId)
          .eq("type", "estimate")
      : supabase.from("estimates").select("*").eq("id", data.estimateId).eq("user_id", userId);
    const { data: rawEstimate } = await estQuery.maybeSingle();
    if (!rawEstimate) throw new Error("Estimate not found");
    const estimate = rawEstimate as unknown as Record<string, unknown>;

    // Approval is only enforced on the new schema (legacy has no approved_at column).
    if (!legacy && !estimate.approved_at)
      throw new Error("Approve the estimate before sending it to the client.");

    const itemsRes = legacy
      ? await supabase
          .from("invoice_items")
          .select("description,quantity,unit_price,sort_order")
          .eq("invoice_id", data.estimateId)
          .order("sort_order")
      : await supabase
          .from("estimate_items")
          .select("description,quantity,rate_cents,amount_cents,sort_order")
          .eq("estimate_id", data.estimateId)
          .order("sort_order");
    const rawItems = (itemsRes.data ?? []) as unknown as Record<string, unknown>[];

    const items = rawItems.map((it) => ({
      description: String(it.description ?? ""),
      quantity: Number(it.quantity ?? 0),
      rate_cents: legacy
        ? Math.round(Number(it.unit_price ?? 0) * 100)
        : Number(it.rate_cents ?? 0),
      amount_cents: legacy
        ? Math.round(Number(it.quantity ?? 0) * Number(it.unit_price ?? 0) * 100)
        : ((it.amount_cents as number | null) ?? null),
    }));

    const legacyProfile = await isLegacyProfile(supabase);
    const profileCols = legacyProfile
      ? "business_name,email"
      : "business_name,company_name,full_name,email";
    const { data: profile } = (await supabase
      .from("profiles")
      .select(profileCols as never)
      .eq("id", userId)
      .maybeSingle()) as unknown as {
      data: {
        business_name: string | null;
        company_name?: string | null;
        full_name?: string | null;
        email?: string | null;
      } | null;
    };

    const businessName =
      data.business_name ||
      profile?.business_name ||
      profile?.company_name ||
      profile?.full_name ||
      "Your contractor";

    const html = buildEstimateEmailHtml(
      normalizeForEmail(estimate, legacy),
      items,
      businessName,
      data.message,
    );

    const subject = `Estimate ${estimate.estimate_number ?? estimate.invoice_number} from ${businessName}`;

    // Email is delivered via Resend.
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey)
      throw new Error("Missing RESEND_API_KEY — configure it to send invoice/estimate emails.");

    const from = process.env.RESEND_FROM || "Honest Invoice <invoices@honestinvoice.com>";
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from,
        to: [data.to],
        ...(profile?.email ? { reply_to: profile.email } : {}),
        subject,
        html,
      }),
    });
    if (!emailRes.ok) {
      const body = await emailRes.text();
      throw new Error(`Email send failed [${emailRes.status}]: ${body.slice(0, 300)}`);
    }

    // Mark sent on the right table.
    if (legacy) {
      const { error } = (await supabase
        .from("invoices")
        .update({ status: "sent", sent_count: (Number(estimate.sent_count) || 0) + 1 })
        .eq("id", data.estimateId)) as unknown as { error: { message: string } | null };
      if (error) throw error;
    } else {
      const { error } = (await supabase
        .from("estimates")
        .update({ status: "sent", sent_at: new Date().toISOString(), sent_to_email: data.to })
        .eq("id", data.estimateId)) as unknown as { error: { message: string } | null };
      if (error) throw error;
    }

    return { sent: true, to: data.to };
  });
