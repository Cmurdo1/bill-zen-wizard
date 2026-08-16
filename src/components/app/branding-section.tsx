import { useEffect, useState } from "react";
import { Loader2, Plus, Palette, Building2, Trash2, Star, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  fetchBrandingPresets,
  createBrandingPreset,
  updateBrandingPreset,
  deleteBrandingPreset,
  setDefaultBrandingPreset,
  type BrandingPreset,
} from "@/lib/branding-presets";

/** Fields that make up a brand identity (default = profile, presets = rows). */
type BrandFields = {
  business_name: string;
  logo_url: string;
  brand_color: string;
  estimate_color: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
};

const EMPTY_BRAND: BrandFields = {
  business_name: "",
  logo_url: "",
  brand_color: "",
  estimate_color: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "",
};

type ProfileBrand = {
  business_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  estimate_color: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
};

const PROFILE_BRAND_COLUMNS =
  "business_name,logo_url,brand_color,estimate_color,email,phone,address,city,state,zip_code,country";

function profileToBrand(p: ProfileBrand | null): BrandFields {
  return {
    business_name: p?.business_name ?? "",
    logo_url: p?.logo_url ?? "",
    brand_color: p?.brand_color ?? "",
    estimate_color: p?.estimate_color ?? "",
    email: p?.email ?? "",
    phone: p?.phone ?? "",
    address: p?.address ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "",
    zip_code: p?.zip_code ?? "",
    country: p?.country ?? "",
  };
}

export function BrandingSection() {
  const [defaultBrand, setDefaultBrand] = useState<BrandFields>(EMPTY_BRAND);
  const [presets, setPresets] = useState<BrandingPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [editing, setEditing] = useState<BrandingPreset | "new" | null>(null);
  const [draft, setDraft] = useState<BrandFields>(EMPTY_BRAND);
  const [draftName, setDraftName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const [profile, presetList] = await Promise.all([
        user
          ? supabase.from("profiles").select(PROFILE_BRAND_COLUMNS).eq("id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        fetchBrandingPresets(),
      ]);
      setDefaultBrand(profileToBrand((profile?.data as ProfileBrand | null) ?? null));
      setPresets(presetList);
    } catch (e) {
      // Pre-migration deployments have no branding_presets table yet — show
      // the section empty instead of an error toast.
      const err = e instanceof Error ? e : new Error("unknown error");
      if (!/branding_presets|PGRST205|42P01/i.test(err.message)) {
        toast.error(`Couldn't load branding: ${err.message}`);
      }
      setPresets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveDefault() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setSavingDefault(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          business_name: defaultBrand.business_name || null,
          logo_url: defaultBrand.logo_url || null,
          brand_color: defaultBrand.brand_color || null,
          estimate_color: defaultBrand.estimate_color || null,
          email: defaultBrand.email || null,
          phone: defaultBrand.phone || null,
          address: defaultBrand.address || null,
          city: defaultBrand.city || null,
          state: defaultBrand.state || null,
          zip_code: defaultBrand.zip_code || null,
          country: defaultBrand.country || null,
        } as never)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Default branding saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save branding");
    } finally {
      setSavingDefault(false);
    }
  }

  async function savePreset() {
    if (!draftName.trim()) {
      toast.error("Give this brand a name (e.g. Brothers Lane Builders).");
      return;
    }
    setSavingPreset(true);
    try {
      const payload = { ...draft, name: draftName.trim() };
      if (editing === "new") {
        await createBrandingPreset({
          name: payload.name,
          business_name: payload.business_name,
          logo_url: payload.logo_url || null,
          brand_color: payload.brand_color || null,
          estimate_color: payload.estimate_color || null,
          email: payload.email || null,
          phone: payload.phone || null,
          address: payload.address || null,
          city: payload.city || null,
          state: payload.state || null,
          zip_code: payload.zip_code || null,
          country: payload.country || null,
          is_default: presets.length === 0,
        });
      } else if (editing) {
        await updateBrandingPreset(editing.id, {
          name: payload.name,
          business_name: payload.business_name,
          logo_url: payload.logo_url || null,
          brand_color: payload.brand_color || null,
          estimate_color: payload.estimate_color || null,
          email: payload.email || null,
          phone: payload.phone || null,
          address: payload.address || null,
          city: payload.city || null,
          state: payload.state || null,
          zip_code: payload.zip_code || null,
          country: payload.country || null,
        });
      }
      toast.success("Brand saved.");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save brand");
    } finally {
      setSavingPreset(false);
    }
  }

  async function removePreset(p: BrandingPreset) {
    if (!confirm(`Delete the "${p.name}" brand? This won't affect existing documents.`)) return;
    try {
      await deleteBrandingPreset(p.id);
      toast.success("Brand deleted.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete brand");
    }
  }

  async function makeDefault(p: BrandingPreset) {
    try {
      await setDefaultBrandingPreset(p.id);
      toast.success(`"${p.name}" is now the default brand.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set default brand");
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Default brand */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <h3 className="flex items-center gap-2 font-display text-lg">
          <Building2 className="h-4 w-4 text-primary" /> Default brand
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown on new invoices and estimates unless you pick a saved brand. Also used for documents
          created by your AI agents via the API.
        </p>
        <div className="mt-4">
          <BrandFieldsEditor value={defaultBrand} onChange={setDefaultBrand} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveDefault}
            disabled={savingDefault}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {savingDefault ? "Saving…" : "Save default brand"}
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg">
              <Palette className="h-4 w-4 text-primary" /> Saved brands
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Run multiple businesses? Save each one and pick which brand a document is created
              under — the name, logo, colors, and contact info follow the document.
            </p>
          </div>
          {editing === null && (
            <button
              onClick={() => {
                setDraftName("");
                setDraft(EMPTY_BRAND);
                setEditing("new");
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> New brand
            </button>
          )}
        </div>

        {presets.length === 0 && editing === null ? (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-surface-muted/50 p-6 text-center text-sm text-muted-foreground">
            No saved brands yet. Create one to invoice under a different business name — e.g.
            “Brothers Lane Builders” and “Corin Murdoch”.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {presets.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-bold"
                    style={{
                      background: p.brand_color || "#e5e1da",
                      color: p.brand_color ? "#fff" : "#6d6a63",
                    }}
                  >
                    {(p.business_name || p.name).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-semibold text-foreground">
                      {p.name}
                      {p.is_default && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                          <Star className="h-2.5 w-2.5" /> Default
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.business_name || "No business name"}
                      {p.email ? ` · ${p.email}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {!p.is_default && (
                    <button
                      onClick={() => makeDefault(p)}
                      title="Make the default brand"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    >
                      <Star className="h-3 w-3" /> Default
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setDraftName(p.name);
                      setDraft({
                        business_name: p.business_name,
                        logo_url: p.logo_url ?? "",
                        brand_color: p.brand_color ?? "",
                        estimate_color: p.estimate_color ?? "",
                        email: p.email ?? "",
                        phone: p.phone ?? "",
                        address: p.address ?? "",
                        city: p.city ?? "",
                        state: p.state ?? "",
                        zip_code: p.zip_code ?? "",
                        country: p.country ?? "",
                      });
                      setEditing(p);
                    }}
                    title="Edit"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removePreset(p)}
                    title="Delete"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing !== null && (
          <div className="mt-4 rounded-xl border border-border bg-background p-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Brand name
              </span>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Brothers Lane Builders"
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              />
            </label>
            <div className="mt-4">
              <BrandFieldsEditor value={draft} onChange={setDraft} />
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                disabled={savingPreset}
                className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                onClick={savePreset}
                disabled={savingPreset}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
              >
                {savingPreset && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editing === "new" ? "Create brand" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BrandFieldsEditor({
  value,
  onChange,
}: {
  value: BrandFields;
  onChange: (v: BrandFields) => void;
}) {
  const set = (k: keyof BrandFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <BrandField
        label="Business name"
        value={value.business_name}
        onChange={set("business_name")}
      />
      <BrandField label="Logo URL" value={value.logo_url} onChange={set("logo_url")} />
      <div className="grid grid-cols-2 gap-3">
        <BrandField
          label="Brand color"
          value={value.brand_color}
          onChange={set("brand_color")}
          placeholder="#0b264c"
        />
        <BrandField
          label="Estimate color"
          value={value.estimate_color}
          onChange={set("estimate_color")}
          placeholder="#0b264c"
        />
      </div>
      <BrandField label="Email" value={value.email} onChange={set("email")} />
      <BrandField label="Phone" value={value.phone} onChange={set("phone")} />
      <BrandField label="Address" value={value.address} onChange={set("address")} />
      <BrandField label="City" value={value.city} onChange={set("city")} />
      <BrandField label="State" value={value.state} onChange={set("state")} />
      <BrandField label="ZIP" value={value.zip_code} onChange={set("zip_code")} />
      <BrandField label="Country" value={value.country} onChange={set("country")} />
    </div>
  );
}

function BrandField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
      />
    </label>
  );
}
