import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AnalyzeInput = z.object({
  estimateId: z.string().uuid(),
  description: z.string().trim().min(10, "Describe the job in at least a sentence.").max(4000),
  currency: z.string().trim().length(3).default("USD"),
});

const SendInput = z.object({
  estimateId: z.string().uuid(),
  to: z.string().trim().email().max(255),
  message: z.string().trim().max(2000).optional(),
});

const EstimateSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string", description: "Step of the job, including measured/estimated quantities" },
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

type RawItem = {
  description: string;
  quantity: number;
  unit: string;
  rate_cents: number;
  basis: string;
};

async function assertPaidPlan(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status,subscription_end")
    .eq("id", userId)
    .maybeSingle();
  const status = profile?.subscription_status ?? "free";
  const activeUntil = profile?.subscription_end ? new Date(profile.subscription_end) : null;
  const expired = activeUntil ? activeUntil.getTime() < Date.now() : false;
  const paid =
    !expired &&
    ["pro", "business", "active", "active_pro", "active_business", "trialing"].includes(status);
  if (!paid) throw new Error("AI photo estimating requires a Pro or Business plan.");
}

export const analyzeEstimatePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPaidPlan(supabase, userId);

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing AI credentials");

    const { data: estimate } = await supabase
      .from("estimates")
      .select("id")
      .eq("id", data.estimateId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!estimate) throw new Error("Estimate not found");

    const { data: photos } = await supabase
      .from("estimate_photos")
      .select("storage_path,caption")
      .eq("estimate_id", data.estimateId)
      .order("created_at");

    const imageBlocks: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    for (const p of photos ?? []) {
      const { data: signed } = await supabase.storage
        .from("estimate-photos")
        .createSignedUrl(p.storage_path, 60 * 30);
      if (signed?.signedUrl) imageBlocks.push({ type: "image_url", image_url: { url: signed.signedUrl } });
    }

    const { data: rules } = await supabase
      .from("pricing_rules")
      .select("label,unit,rate_cents,notes")
      .eq("user_id", userId)
      .order("label");

    const rateBook = (rules ?? []).length
      ? (rules ?? [])
          .map(
            (r: { label: string; unit: string; rate_cents: number; notes: string | null }) =>
              `- ${r.label}: ${(r.rate_cents / 100).toFixed(2)} ${data.currency} per ${r.unit}${r.notes ? ` (${r.notes})` : ""}`,
          )
          .join("\n")
      : "(none provided — use conservative regional market rates and say so in assumptions)";

    const system = [
      "You are a senior estimator for a trade contracting business. You produce PRECISE, CONSISTENT, itemized estimates.",
      "Rules you must follow exactly:",
      "1. Break the job into sequential steps (prep, materials, labor, equipment, disposal, cleanup) — one line item per step.",
      "2. When the user's rate book contains a matching item, you MUST use that exact rate. Never invent a different price for a rate-book item.",
      "3. Estimate measurements (square footage, linear feet, counts) from the photos using visible reference objects (doors ~80in tall, standard brick 8in, siding courses, outlet height 12in, standard stair rise 7in). State the reference used in 'basis'.",
      "4. Round measured areas UP to the nearest 5 sq ft and quantities to sensible purchase units. Add a standard 10% material waste factor and say so.",
      "5. rate_cents is the price PER UNIT in cents, never the line total.",
      "6. Never guess wildly: if a measurement cannot be derived from the photos, mark its confidence 'low' and list the missing information in assumptions.",
      "7. Deterministic output: given the same photos and description, produce the same numbers.",
      "8. Return 3–12 line items. Never include client personal information.",
    ].join("\n");

    const userText = [
      `Currency: ${data.currency}`,
      "",
      "Contractor rate book (authoritative pricing):",
      rateBook,
      "",
      "Job description from the contractor:",
      data.description,
      "",
      photos?.length
        ? `Photos attached: ${photos.length}. Captions: ${(photos ?? []).map((p: { caption: string | null }, i: number) => `#${i + 1} ${p.caption || "no caption"}`).join("; ")}`
        : "No photos attached — estimate from the description only and note the reduced confidence.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        temperature: 0,
        top_p: 0.1,
        seed: 7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: [{ type: "text", text: userText }, ...imageBlocks] },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_estimate",
              description: "Return the itemized estimate with measurements and assumptions",
              parameters: EstimateSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_estimate" } },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI is busy right now — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const payload = await res.json();
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI returned no estimate");
    const parsed = JSON.parse(call.function.arguments) as {
      items: RawItem[];
      measurements: Array<{ label: string; value: string; confidence: string }>;
      assumptions: string[];
    };

    const items = (parsed.items ?? []).map((it) => ({
      description: `${String(it.description).slice(0, 400)}${it.unit ? ` (${it.quantity} ${it.unit})` : ""}`,
      quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
      rate_cents: Math.max(0, Math.round(Number(it.rate_cents) || 0)),
      basis: String(it.basis ?? "").slice(0, 300),
    }));

    return {
      items,
      measurements: parsed.measurements ?? [],
      assumptions: parsed.assumptions ?? [],
    };
  });

export const sendEstimateEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: estimate } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", data.estimateId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!estimate) throw new Error("Estimate not found");
    if (!estimate.approved_at) throw new Error("Approve the estimate before sending it to the client.");

    const [{ data: items }, { data: profile }] = await Promise.all([
      supabase
        .from("estimate_items")
        .select("description,quantity,rate_cents,amount_cents,sort_order")
        .eq("estimate_id", data.estimateId)
        .order("sort_order"),
      supabase
        .from("profiles")
        .select("business_name,company_name,full_name,email,phone,address_line1,city,state,postal_code")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const currency = estimate.currency || "USD";
    const money = (cents: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);
    const businessName =
      profile?.business_name || profile?.company_name || profile?.full_name || "Your contractor";

    const rows = (items ?? [])
      .map(
        (it: { description: string; quantity: number; rate_cents: number; amount_cents: number }) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(it.description)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${it.quantity}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${money(it.rate_cents)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${money(it.amount_cents ?? Math.round(it.quantity * it.rate_cents))}</td>
          </tr>`,
      )
      .join("");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
        <h1 style="font-size:20px;margin:0 0 4px">Estimate ${escapeHtml(estimate.estimate_number)}</h1>
        <p style="margin:0 0 16px;color:#6b7280">from ${escapeHtml(businessName)}</p>
        ${data.message ? `<p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>` : ""}
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

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const resendKey = process.env["RESEND_API_KEY"];
    if (!lovableKey || !resendKey) throw new Error("Email is not configured yet.");

    const emailRes = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: `${businessName} <onboarding@resend.dev>`,
        to: [data.to],
        ...(profile?.email ? { reply_to: profile.email } : {}),
        subject: `Estimate ${estimate.estimate_number} from ${businessName}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const body = await emailRes.text();
      throw new Error(`Email send failed [${emailRes.status}]: ${body.slice(0, 300)}`);
    }

    await supabase
      .from("estimates")
      .update({ status: "sent", sent_at: new Date().toISOString(), sent_to_email: data.to })
      .eq("id", data.estimateId);

    return { sent: true, to: data.to };
  });

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
