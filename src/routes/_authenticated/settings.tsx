import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RateBookEditor } from "@/components/app/rate-book";
import { ApiKeyManager } from "@/components/app/api-key-manager";
import { BrandingSection } from "@/components/app/branding-section";
import { useSubscription, type SubscriptionInfo } from "@/lib/subscription";
import { PlanBadge, UpgradeCallout } from "@/components/app/plan-badge";
import { redeemPromoCode } from "@/lib/promo.functions";
import { formatDate } from "@/lib/format";
import { isLegacyProfileSchema } from "@/lib/invoice-schema";

type Profile = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  business_name: string | null;
  invoice_prefix: string | null;
  default_currency: string | null;
  logo_url: string | null;
};

// The deployed legacy live database stores the display name in
// `business_name` only (no full_name/company_name/invoice_prefix/
// default_currency). Probe once and adapt so Settings saves without a 400.
let legacyProfileChecked: boolean | null = null;
let legacyProfile: boolean | null = null;
async function isLegacyProfile(): Promise<boolean> {
  if (legacyProfileChecked === null) {
    legacyProfile = await isLegacyProfileSchema();
    legacyProfileChecked = true;
  }
  return legacyProfile ?? false;
}

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [{ title: "Settings — Honest Invoice" }, { name: "robots", content: "noindex" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sub = useSubscription();

  useEffect(() => {
    void (async () => {
      const [
        {
          data: { user },
        },
        legacySchema,
      ] = await Promise.all([supabase.auth.getUser(), isLegacyProfile()]);
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setLegacy(legacySchema);
      setProfile(
        (data as Profile) ?? {
          id: user.id,
          full_name: "",
          company_name: "",
          business_name: "",
          invoice_prefix: "INV",
          default_currency: "USD",
          logo_url: "",
        },
      );
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setMsg(null);
    // Legacy profiles only have business_name/logo_url — writing the new
    // schema's columns there would 400 (undefined column).
    const patch: Record<string, unknown> = legacy
      ? {
          id: profile.id,
          business_name: profile.business_name,
          logo_url: profile.logo_url,
        }
      : {
          id: profile.id,
          full_name: profile.full_name,
          company_name: profile.company_name,
          invoice_prefix: profile.invoice_prefix,
          default_currency: profile.default_currency,
          logo_url: profile.logo_url,
        };
    const { error } = await supabase.from("profiles").upsert(patch as never);
    setSaving(false);
    setMsg(error ? error.message : "Saved.");
  }

  if (loading || !profile) {
    return (
      <AppShell title="Settings">
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings">
      <div className="max-w-2xl space-y-6">
        <PlanBillingSection sub={sub} />

        <Section title="Business profile" desc="Shown on invoices, estimates, and payment pages.">
          {legacy ? (
            <Field
              label="Business name"
              value={profile.business_name ?? ""}
              onChange={(v) => setProfile({ ...profile, business_name: v })}
            />
          ) : (
            <>
              <Field
                label="Full name"
                value={profile.full_name ?? ""}
                onChange={(v) => setProfile({ ...profile, full_name: v })}
              />
              <Field
                label="Company name"
                value={profile.company_name ?? ""}
                onChange={(v) => setProfile({ ...profile, company_name: v })}
              />
            </>
          )}
          <Field
            label="Logo URL"
            value={profile.logo_url ?? ""}
            onChange={(v) => setProfile({ ...profile, logo_url: v })}
          />
        </Section>

        {!legacy && (
          <Section title="Invoicing" desc="Defaults applied to every new invoice.">
            <Field
              label="Invoice prefix"
              value={profile.invoice_prefix ?? "INV"}
              onChange={(v) => setProfile({ ...profile, invoice_prefix: v })}
            />
            <Field
              label="Default currency"
              value={profile.default_currency ?? "USD"}
              onChange={(v) => setProfile({ ...profile, default_currency: v.toUpperCase() })}
            />
          </Section>
        )}

        {sub.isActive ? (
          <Section
            title="Design & Branding"
            desc="Brand your invoices and estimates: set your default business identity, then save extra brands (like Brothers Lane Builders and Corin Murdoch) to switch between them per document."
          >
            <BrandingSection />
          </Section>
        ) : (
          <UpgradeCallout feature="Design & Branding" />
        )}

        {sub.isActive ? (
          <Section
            title="Rate book"
            desc="Your standard prices. AI estimates must use these exact rates, which keeps pricing consistent across every job."
          >
            <RateBookEditor currency={profile.default_currency ?? "USD"} />
          </Section>
        ) : (
          <UpgradeCallout feature="Rate book" />
        )}

        {sub.isActive ? (
          <Section
            title="AI agent API keys"
            desc="Connect Claude, Cursor, cron jobs, and other agents without exposing your browser session. Available on active Pro and Business plans."
          >
            <ApiKeyManager />
          </Section>
        ) : (
          <UpgradeCallout feature="AI agent API keys" />
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </div>
    </AppShell>
  );
}

function PlanBillingSection({ sub }: { sub: SubscriptionInfo }) {
  const redeem = useServerFn(redeemPromoCode);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFree = sub.plan === "free";

  async function handleRedeem() {
    if (!code.trim()) return;
    setRedeeming(true);
    setError(null);
    try {
      const result = await redeem({ data: { code } });
      toast.success(
        `Trial activated! ${result.plan === "pro" ? "Pro" : result.plan} is active until ${formatDate(result.expiresAt)}.`,
      );
      setCode("");
      await sub.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not redeem that code.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <Section
      title="Plan & billing"
      desc={
        isFree
          ? "Redeem a promo code to start a free 3-month Pro trial — no card required."
          : "Your current plan and subscription details."
      }
    >
      {isFree ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-56 flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Promo code
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. FREETRIAL"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm uppercase"
            />
          </label>
          <button
            onClick={handleRedeem}
            disabled={redeeming || !code.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {redeeming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gift className="h-4 w-4" />
            )}
            {redeeming ? "Activating…" : "Redeem"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <PlanBadge plan={sub.plan} />
          {sub.activeUntil ? (
            <span className="text-muted-foreground">
              {sub.status === "trialing" ? "Free trial" : "Plan"} active until{" "}
              <span className="font-semibold text-foreground">{formatDate(sub.activeUntil)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Active subscription</span>
          )}
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
    </Section>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <h2 className="font-display text-xl">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
      />
    </label>
  );
}
