import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook endpoint.
 *
 * Setup:
 *   1. In your Stripe dashboard, add an endpoint pointing to
 *      https://<your-domain>/api/public/webhooks/stripe
 *   2. Subscribe to at least these events:
 *        - checkout.session.completed
 *        - payment_intent.succeeded
 *   3. Copy the signing secret and save it as STRIPE_WEBHOOK_SECRET
 *      via Lovable secrets. Optionally add STRIPE_SECRET_KEY too if you
 *      later want to fetch the full session server-side.
 *
 * To link a Stripe payment to an invoice, include the invoice id in the
 * payment link / checkout session metadata as `invoice_id`, OR include the
 * invoice's `payment_link_token` in the metadata as `invoice_token`.
 */

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  // Stripe-Signature: t=timestamp,v1=signature[,v1=…]
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k, v.join("=")];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const payload = `${t}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(sigBytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant-time compare
  if (expected.length !== v1.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return mismatch === 0;
}

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 401 });
        const raw = await request.text();
        const ok = await verifyStripeSignature(raw, sig, secret);
        if (!ok) return new Response("Invalid signature", { status: 401 });

        type StripeEvent = { type: string; data: { object: Record<string, unknown> } };
        const event = JSON.parse(raw) as StripeEvent;
        const obj = event.data.object;
        const metadata = (obj.metadata ?? {}) as Record<string, string | undefined>;
        const invoiceId = metadata.invoice_id;
        const invoiceToken = metadata.invoice_token;
        const paymentIntent = (obj.payment_intent ?? obj.id) as string | undefined;
        const sessionId = event.type.startsWith("checkout.session") ? (obj.id as string | undefined) : undefined;
        const amountTotal = (obj.amount_total ?? obj.amount_received ?? obj.amount) as number | undefined;

        if (!["checkout.session.completed", "payment_intent.succeeded"].includes(event.type)) {
          return new Response("ignored", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Locate invoice by metadata; skip silently if none provided.
        let query = supabaseAdmin.from("invoices").select("id,user_id,total_cents,currency").limit(1);
        if (invoiceId) query = query.eq("id", invoiceId);
        else if (invoiceToken) query = query.eq("payment_link_token", invoiceToken);
        else return new Response("no invoice metadata; ignored", { status: 200 });

        const { data: invoices } = await query;
        const invoice = invoices?.[0] as { id: string; user_id: string } | undefined;
        if (!invoice) return new Response("invoice not found; ignored", { status: 200 });

        await supabaseAdmin.from("invoices").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_session_id: sessionId ?? null,
          stripe_payment_intent_id: (paymentIntent as string) ?? null,
        }).eq("id", invoice.id);

        await supabaseAdmin.from("document_activity").insert({
          user_id: invoice.user_id,
          document_type: "invoice",
          document_id: invoice.id,
          action: "status:paid",
          detail: `Paid via Stripe${amountTotal ? ` (${amountTotal} minor units)` : ""}`,
        });

        return new Response("ok", { status: 200 });
      },
    },
  },
});
