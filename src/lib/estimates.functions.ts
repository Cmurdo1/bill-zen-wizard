import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AnalyzeInput,
  SendInput,
  EstimateSchema,
  ESTIMATOR_SYSTEM_PROMPT,
  formatRateBook,
  isPaidPlan,
  buildEstimateEmailHtml,
  type PricingRule,
} from "@/lib/estimate-ai";

export const analyzeEstimatePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
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
        .createSignedUrl(p.storage_path, 1800);
      if (signed?.signedUrl) imageBlocks.push({ type: "image_url", image_url: { url: signed.signedUrl } });
    }

    const { data: rules } = await supabase
      .from("pricing_rules")
      .select("label,unit,rate_cents,notes")
      .eq("user_id", userId)
      .order("label");

    const userText = [
      `Currency: ${data.currency}`,
      "",
      "Contractor rate book (authoritative pricing):",
      formatRateBook((rules ?? []) as PricingRule[], data.currency),
      "",
      "Job description from the contractor:",
      data.description,
      "",
      photos?.length
        ? `Photos attached: ${photos.length}. Captions: ${photos
            .map((p: { caption: string | null }, i: number) => `#${i + 1} ${p.caption || "no caption"}`)
            .join("; ")}`
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
          { role: "system", content: ESTIMATOR_SYSTEM_PROMPT },
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
      items: Array<{ description: string; quantity: number; unit: string; rate_cents: number; basis: string }>;
      measurements: Array<{ label: string; value: string; confidence: string }>;
      assumptions: string[];
    };

    return {
      items: (parsed.items ?? []).map((it) => ({
        description: `${String(it.description).slice(0, 400)}${it.unit ? ` (${it.quantity} ${it.unit})` : ""}`,
        quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
        rate_cents: Math.max(0, Math.round(Number(it.rate_cents) || 0)),
        basis: String(it.basis ?? "").slice(0, 300),
      })),
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
        .select("business_name,company_name,full_name,email")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const businessName =
      profile?.business_name || profile?.company_name || profile?.full_name || "Your contractor";

    const html = buildEstimateEmailHtml(estimate, (items ?? []) as never, businessName, data.message);

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
