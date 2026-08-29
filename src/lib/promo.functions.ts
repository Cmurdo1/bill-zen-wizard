import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isPaidPlan } from "@/lib/estimate-ai";

const RedeemInput = z.object({
  code: z.string().trim().min(2, "Enter a promo code.").max(64),
});

/**
 * Redeem a promo code to start a free trial (e.g. 3 months of Pro).
 *
 * Writes go through the service-role client because:
 *  - promo_codes / promo_redemptions have no RLS policies for authenticated
 *    users (only the server should touch them), and
 *  - profiles.subscription_status/subscription_end are protected from user
 *    updates by the protect_subscription_columns trigger (service role only).
 */
export const redeemPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RedeemInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up the code (case-insensitive).
    const { data: codes, error: lookupErr } = await supabaseAdmin
      .from("promo_codes")
      .select("*")
      .ilike("code", data.code)
      .limit(1);
    if (lookupErr) throw new Error("Could not validate that promo code. Please try again.");
    const promo = codes?.[0];
    if (!promo) throw new Error("That promo code isn't valid.");

    // Redemption window + usage limits.
    if (!promo.active) throw new Error("That promo code is no longer active.");
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now())
      throw new Error("That promo code has expired.");
    if (promo.max_uses !== null && (promo.used_count ?? 0) >= promo.max_uses)
      throw new Error("That promo code has reached its usage limit.");

    // A user can redeem a given code only once.
    const { data: existingRedemption } = await supabaseAdmin
      .from("promo_redemptions")
      .select("id")
      .eq("promo_code_id", promo.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingRedemption) throw new Error("You've already redeemed this promo code.");

    // Only accounts without an active paid plan can redeem (prevents stacking).
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_status,subscription_end")
      .eq("id", userId)
      .maybeSingle();
    if (isPaidPlan(profile?.subscription_status, profile?.subscription_end))
      throw new Error("You already have an active plan.");

    const grantedUntil = new Date(Date.now() + promo.duration_days * 864e5);

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_status: "trialing",
        subscription_end: grantedUntil.toISOString(),
      })
      .eq("id", userId);
    if (updateErr) throw new Error("Could not activate the trial. Please try again.");

    const { error: insertErr } = await supabaseAdmin.from("promo_redemptions").insert({
      promo_code_id: promo.id,
      user_id: userId,
      granted_plan: promo.plan,
      granted_until: grantedUntil.toISOString(),
    });
    if (insertErr) throw new Error("Could not activate the trial. Please try again.");

    // Best-effort usage counter; the per-user uniqueness above is the real guard.
    await supabaseAdmin
      .from("promo_codes")
      .update({ used_count: (promo.used_count ?? 0) + 1 })
      .eq("id", promo.id);

    return { plan: promo.plan, expiresAt: grantedUntil.toISOString() };
  });
