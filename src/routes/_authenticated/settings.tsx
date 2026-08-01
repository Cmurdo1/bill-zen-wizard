import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { RateBookEditor } from "@/components/app/rate-book";
import { useSubscription } from "@/lib/subscription";
import { brandingAllowed, DEFAULT_ACCENT_COLOR, DEFAULT_BRAND_COLOR } from "@/lib/branding";

type Profile = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  invoice_prefix: string | null;
  default_currency: string | null;
  logo_url: string | null;
  brand_color: string | null;
  brand_accent_color: string | null;
  brand_tagline: string | null;
  document_footer_text: string | null;
  brand_show_logo: boolean | null;
};

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { plan } = useSubscription();
  const canBrand = brandingAllowed(plan);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(
        (data as Profile) ?? {
          id: user.id,
          full_name: "",
          company_name: "",
          invoice_prefix: "INV",
          default_currency: "USD",
          logo_url: "",
          brand_color: DEFAULT_BRAND_COLOR,
          brand_accent_color: DEFAULT_ACCENT_COLOR,
          brand_tagline: "",
          document_footer_text: "",
          brand_show_logo: true,
        },
      );
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from("profiles").upsert({
      id: profile.id,
      full_name: profile.full_name,
      company_name: profile.company_name,
      invoice_prefix: profile.invoice_prefix,
      default_currency: profile.default_currency,
      logo_url: profile.logo_url,
      ...(canBrand
        ? {
            brand_color: profile.brand_color,
            brand_accent_color: profile.brand_accent_color,
            brand_tagline: profile.brand_tagline,
            document_footer_text: profile.document_footer_text,
            brand_show_logo: profile.brand_show_logo ?? true,
          }
        : {}),
    });
    setSaving(false);
    setMsg(error ? error.message : "Saved.");
  }

  if (loading || !profile) {
    return (
      <AppShell title="Settings">
        <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings">
      <div className="max-w-2xl space-y-6">
        <Section title="Business profile" desc="Shown on invoices, estimates, and payment pages.">
          <Field label="Full name" value={profile.full_name ?? ""} onChange={(v) => setProfile({ ...profile, full_name: v })} />
          <Field label="Company name" value={profile.company_name ?? ""} onChange={(v) => setProfile({ ...profile, company_name: v })} />
          <Field label="Logo URL" value={profile.logo_url ?? ""} onChange={(v) => setProfile({ ...profile, logo_url: v })} />
        </Section>

        <Section title="Invoicing" desc="Defaults applied to every new invoice.">
          <Field label="Invoice prefix" value={profile.invoice_prefix ?? "INV"} onChange={(v) => setProfile({ ...profile, invoice_prefix: v })} />
          <Field label="Default currency" value={profile.default_currency ?? "USD"} onChange={(v) => setProfile({ ...profile, default_currency: v.toUpperCase() })} />
        </Section>

        <Section
          title="Document branding"
          desc="Your logo, colors, tagline, and footer applied to every invoice and estimate PDF."
          badge={canBrand ? "Included in your plan" : "Pro & Business"}
        >
          {!canBrand ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-muted p-5 text-sm">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <Lock className="h-4 w-4" /> Custom branding is a paid feature
              </p>
              <p className="mt-1.5 text-muted-foreground">
                Upgrade to Pro or Business to put your logo, brand colors, tagline, and a custom footer on every invoice and estimate you send.
              </p>
              <a href="/pricing" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft hover:opacity-90">
                <Sparkles className="h-3.5 w-3.5" /> View plans
              </a>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <ColorField
                  label="Brand color"
                  value={profile.brand_color || DEFAULT_BRAND_COLOR}
                  onChange={(v) => setProfile({ ...profile, brand_color: v })}
                />
                <ColorField
                  label="Accent color"
                  value={profile.brand_accent_color || DEFAULT_ACCENT_COLOR}
                  onChange={(v) => setProfile({ ...profile, brand_accent_color: v })}
                />
              </div>
              <Field
                label="Tagline (under your business name)"
                value={profile.brand_tagline ?? ""}
                onChange={(v) => setProfile({ ...profile, brand_tagline: v })}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Document footer</span>
                <textarea
                  rows={3}
                  value={profile.document_footer_text ?? ""}
                  onChange={(e) => setProfile({ ...profile, document_footer_text: e.target.value })}
                  placeholder="Thank you for your business — licensed & insured · (555) 555-0134 · honestinvoice.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.brand_show_logo ?? true}
                  onChange={(e) => setProfile({ ...profile, brand_show_logo: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                Show my logo on invoices and estimates
              </label>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground">Preview</p>
                <div className="mt-3 overflow-hidden rounded-lg border border-border">
                  <div className="h-2" style={{ background: profile.brand_color || DEFAULT_BRAND_COLOR }} />
                  <div className="flex items-start justify-between gap-4 bg-background p-4">
                    <div className="flex items-center gap-3">
                      {(profile.brand_show_logo ?? true) && profile.logo_url ? (
                        <img src={profile.logo_url} alt="Your logo" className="h-10 w-10 rounded-md object-contain" />
                      ) : null}
                      <div>
                        <div className="font-display text-xl" style={{ color: profile.brand_color || DEFAULT_BRAND_COLOR }}>Invoice</div>
                        <div className="text-[11px] text-muted-foreground">INV-0001 · DRAFT</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{profile.company_name || profile.full_name || "Your Business"}</div>
                      {profile.brand_tagline && <div className="text-[11px] text-muted-foreground">{profile.brand_tagline}</div>}
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="h-px w-full" style={{ background: profile.brand_accent_color || DEFAULT_ACCENT_COLOR }} />
                    {profile.document_footer_text && (
                      <p className="mt-2 text-center text-[11px] text-muted-foreground">{profile.document_footer_text}</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </Section>

        <Section title="Rate book" desc="Your standard prices. AI estimates must use these exact rates, which keeps pricing consistent across every job.">
          <RateBookEditor currency={profile.default_currency ?? "USD"} />
        </Section>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, desc, badge, children }: { title: string; desc?: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl">{title}</h2>
        {badge && (
          <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-background p-1" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
      </div>
    </label>
  );
}
