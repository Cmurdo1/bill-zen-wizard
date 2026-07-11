import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type Profile = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  invoice_prefix: string | null;
  default_currency: string | null;
  logo_url: string | null;
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

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile((data as Profile) ?? { id: user.id, full_name: "", company_name: "", invoice_prefix: "INV", default_currency: "USD", logo_url: "" });
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

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <h2 className="font-display text-xl">{title}</h2>
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
