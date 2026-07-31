import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/marketing/shell";
import { Loader2, ArrowRight, Check } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your business — Honest Invoice" },
      { name: "description", content: "Add your business details so estimates and invoices look professional." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

const Schema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(100),
  business_name: z.string().trim().min(2, "Enter your business name").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a phone number").max(30),
  address_line1: z.string().trim().min(3, "Enter your street address").max(160),
  city: z.string().trim().min(2, "Enter your city").max(80),
  state: z.string().trim().min(2, "Enter your state").max(40),
  postal_code: z.string().trim().min(3, "Enter your ZIP / postal code").max(16),
  default_currency: z.string().trim().length(3, "3-letter currency code"),
});

type Form = z.infer<typeof Schema>;

const EMPTY: Form = {
  full_name: "",
  business_name: "",
  email: "",
  phone: "",
  address_line1: "",
  city: "",
  state: "",
  postal_code: "",
  default_currency: "USD",
};

function OnboardingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setForm({
        full_name: data?.full_name ?? "",
        business_name: data?.business_name ?? data?.company_name ?? "",
        email: data?.email ?? user.email ?? "",
        phone: data?.phone ?? "",
        address_line1: data?.address_line1 ?? "",
        city: data?.city ?? "",
        state: data?.state ?? "",
        postal_code: data?.postal_code ?? data?.zip_code ?? "",
        default_currency: data?.default_currency ?? "USD",
      });
      setLoading(false);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      const next: Partial<Record<keyof Form, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Form] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const v = parsed.data;
      const { error: upErr } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: v.full_name,
        business_name: v.business_name,
        company_name: v.business_name,
        email: v.email,
        phone: v.phone,
        address_line1: v.address_line1,
        city: v.city,
        state: v.state,
        postal_code: v.postal_code,
        zip_code: v.postal_code,
        default_currency: v.default_currency.toUpperCase(),
        onboarding_completed: true,
      });
      if (upErr) throw upErr;
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your details");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Logo />
        <h1 className="mt-8 font-display text-3xl tracking-tight text-foreground">Set up your business</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          These details appear on every estimate and invoice you send, and help the AI price jobs for your area.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">You</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <F label="Your name" value={form.full_name} err={errors.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
              <F label="Business name" value={form.business_name} err={errors.business_name} onChange={(v) => setForm({ ...form, business_name: v })} />
              <F label="Email" type="email" value={form.email} err={errors.email} onChange={(v) => setForm({ ...form, email: v })} />
              <F label="Phone" type="tel" value={form.phone} err={errors.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Business address</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <F label="Street address" value={form.address_line1} err={errors.address_line1} onChange={(v) => setForm({ ...form, address_line1: v })} />
              </div>
              <F label="City" value={form.city} err={errors.city} onChange={(v) => setForm({ ...form, city: v })} />
              <F label="State / region" value={form.state} err={errors.state} onChange={(v) => setForm({ ...form, state: v })} />
              <F label="ZIP / postal code" value={form.postal_code} err={errors.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
              <F label="Currency" value={form.default_currency} err={errors.default_currency} onChange={(v) => setForm({ ...form, default_currency: v.toUpperCase() })} />
            </div>
          </section>

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Finish setup <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function F({
  label,
  value,
  onChange,
  err,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  err?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full rounded-lg border bg-background px-3 text-sm ${err ? "border-destructive" : "border-border"}`}
      />
      {err && <span className="mt-1 block text-xs font-semibold text-destructive">{err}</span>}
    </label>
  );
}
