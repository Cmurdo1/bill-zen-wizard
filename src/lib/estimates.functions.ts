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
import { runInference, readToolArguments } from "@/lib/ai-inference";
import { sendResendEmail, DEFAULT_SENDER } from "@/lib/resend";

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

    const payload = await runInference({
      model: "google/gemini-2.5-pro",
      fallbackModel: "meta/llama-3.2-90b-vision-instruct",
      requiresVision: imageBlocks.length > 0,
      temperature: 0,
      topP: 0.1,
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
      toolChoice: { type: "function", function: { name: "return_estimate" } },
    });

    const parsed = readToolArguments<{
      items: Array<{ description: string; quantity: number; unit: string; rate_cents: number; basis: string }>;
      measurements: Array<{ label: string; value: string; confidence: string }>;
      assumptions: string[];
    }>(payload);

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

    await sendResendEmail({
      from: `${businessName} <${DEFAULT_SENDER}>`,
      to: data.to,
      subject: `Estimate ${estimate.estimate_number} from ${businessName}`,
      html,
      ...(profile?.email ? { replyTo: profile.email } : {}),
    });

    await supabase
      .from("estimates")
      .update({ status: "sent", sent_at: new Date().toISOString(), sent_to_email: data.to })
      .eq("id", data.estimateId);

    return { sent: true, to: data.to };
  });
