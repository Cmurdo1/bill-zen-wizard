import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isPaidPlan, type PricingRule } from "@/lib/estimate-ai";
import { extractLineItemsWithAI } from "@/lib/ai-extract";

const ExtractInput = z.object({
  description: z.string().trim().min(4).max(4000),
  currency: z.string().length(3).default("USD"),
  estimateId: z.string().uuid().optional(), // Optional: for photo analysis
});

export const extractLineItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status,subscription_end")
      .eq("id", userId)
      .maybeSingle();
    if (!isPaidPlan(profile?.subscription_status, profile?.subscription_end)) {
      throw new Error("AI line-item extraction requires a Pro or Business plan.");
    }

    // Fetch user's pricing rules (rate book)
    const { data: rules } = await supabase
      .from("pricing_rules")
      .select("label,unit,rate_cents,notes")
      .eq("user_id", userId)
      .order("label");

    // If estimateId provided, fetch photos for analysis
    const imageBlocks: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    if (data.estimateId) {
      const { data: photos } = await supabase
        .from("estimate_photos")
        .select("storage_path,caption")
        .eq("estimate_id", data.estimateId)
        .order("created_at");

      for (const p of photos ?? []) {
        const { data: signed } = await supabase.storage
          .from("estimate-photos")
          .createSignedUrl(p.storage_path, 1800);
        if (signed?.signedUrl)
          imageBlocks.push({ type: "image_url", image_url: { url: signed.signedUrl } });
      }
    }

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

const SendEmailInput = z.object({
  invoice_id: z.string().uuid(),
  client_email: z.string().email(),
  client_name: z.string(),
  invoice_number: z.string(),
  total_amount: z.number(),
  due_date: z.string().nullable(),
  business_name: z.string(),
  job_description: z.string().nullable(),
  document_type: z.enum(["invoice", "estimate"]),
  message: z.string().trim().max(2000).optional(),
});

export const sendInvoiceEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SendEmailInput.parse(input))
  .handler(async ({ data, context }) => {
    const subject = `${data.document_type === "estimate" ? "Estimate" : "Invoice"} ${data.invoice_number} from ${data.business_name || "your business"}`;
    const docLabel = data.document_type === "estimate" ? "estimate" : "invoice";

    // Email is delivered via Resend.
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey)
      throw new Error("Missing RESEND_API_KEY — configure it to send invoice/estimate emails.");

    const from = process.env.RESEND_FROM || "Honest Invoice <invoices@honestinvoice.com>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from,
        to: data.client_email,
        subject,
        text: [
          `Hi ${data.client_name},`,
          ``,
          `Your ${docLabel} ${data.invoice_number} from ${data.business_name || "us"} is ready to review.`,
          ``,
          `Amount: $${Number(data.total_amount).toFixed(2)}`,
          data.due_date ? `Due: ${data.due_date}` : "",
          data.job_description ? `` : "",
          data.job_description ? `${data.job_description}` : "",
          data.message ? `` : "",
          data.message ? data.message : "",
          ``,
          `Thank you!`,
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Email send failed (${res.status}): ${body.slice(0, 200)}`);
    }

    return { success: true };
  });
