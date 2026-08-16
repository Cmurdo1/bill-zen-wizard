import { supabase } from "@/integrations/supabase/client";

/**
 * Branding presets let Pro/Business users save several brand identities
 * (business name, logo, colors, contact info) and pick one per document.
 * A null/undefined preset id means "use the account default branding"
 * (the profile fields).
 *
 * NOTE: the `branding_presets` table is created by a migration and may not
 * exist yet in some environments (and isn't in the generated PostgREST
 * types), so every query here is cast through `unknown` — same pattern as
 * the other schema-adaptive modules (invoice-schema, estimate-schema).
 */

export type BrandingPreset = {
  id: string;
  user_id: string;
  name: string;
  business_name: string;
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
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

const PRESET_COLUMNS =
  "id,user_id,name,business_name,logo_url,brand_color,estimate_color,email,phone,address,city,state,zip_code,country,is_default,created_at,updated_at";

type PresetQueryResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

type PresetFilter = {
  eq: (column: string, value: string | boolean) => PresetFilter;
  order: (column: string, opts: { ascending: boolean }) => PresetQueryResult<BrandingPreset[]>;
  maybeSingle: () => PresetQueryResult<BrandingPreset>;
};

/**
 * The generated Supabase types don't include `branding_presets` (the table is
 * added by a migration), so cast the client before calling `.from()` — the
 * same schema-adaptive approach used elsewhere in this codebase.
 */
export function brandingPresetsClient() {
  return (supabase as unknown as { from: (table: string) => unknown }).from(
    "branding_presets",
  ) as unknown as {
    select: (columns: string) => PresetFilter;
    insert: (row: unknown) => {
      select: (columns: string) => {
        single: () => PresetQueryResult<BrandingPreset>;
      };
    };
    update: (patch: unknown) => {
      eq: (column: string, value: string | boolean) => PresetQueryResult<null>;
    };
    delete: () => {
      eq: (column: string, value: string) => PresetQueryResult<null>;
    };
  };
}

function presetsTable() {
  return brandingPresetsClient();
}

let presetColumnCache: boolean | null = null;

/**
 * Whether the `branding_presets` table and the `invoices.branding_preset_id`
 * column exist. The migration adds both; before it runs, every feature must
 * degrade gracefully (no 42703 errors on lists/detail/create).
 */
export async function hasBrandingPresetColumn(): Promise<boolean> {
  if (presetColumnCache !== null) return presetColumnCache;
  const { error } = (await supabase
    .from("invoices")
    .select("branding_preset_id")
    .limit(1)) as unknown as { error: { code?: string } | null };
  presetColumnCache = !(error && (error.code === "42703" || error.code === "PGRST204"));
  return presetColumnCache;
}

/** Forget the cached column probe (e.g. after the migration is applied). */
export function resetBrandingPresetCache(): void {
  presetColumnCache = null;
}

export async function fetchBrandingPresets(): Promise<BrandingPreset[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  // Table may not exist yet on deployments that predate the migration.
  if (!(await hasBrandingPresetColumn())) return [];
  const { data, error } = await presetsTable()
    .select(PRESET_COLUMNS)
    .eq("user_id", user.id)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type BrandingPresetInput = {
  name: string;
  business_name: string;
  logo_url?: string | null;
  brand_color?: string | null;
  estimate_color?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
  is_default?: boolean;
};

export async function createBrandingPreset(input: BrandingPresetInput): Promise<BrandingPreset> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await presetsTable()
    .insert({
      user_id: user.id,
      name: input.name,
      business_name: input.business_name,
      logo_url: input.logo_url ?? null,
      brand_color: input.brand_color ?? null,
      estimate_color: input.estimate_color ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip_code: input.zip_code ?? null,
      country: input.country ?? null,
      is_default: Boolean(input.is_default),
    })
    .select(PRESET_COLUMNS)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Could not create preset");
  if (input.is_default) await setDefaultBrandingPreset(data.id);
  return data;
}

export async function updateBrandingPreset(
  id: string,
  input: Partial<BrandingPresetInput>,
): Promise<void> {
  const { error } = await presetsTable()
    .update(input as Record<string, unknown>)
    .eq("id", id);
  if (error) throw error;
  if (input.is_default) await setDefaultBrandingPreset(id);
}

export async function deleteBrandingPreset(id: string): Promise<void> {
  const { error } = await presetsTable().delete().eq("id", id);
  if (error) throw error;
}

/** Mark one preset as the account default (clears the others). */
export async function setDefaultBrandingPreset(id: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // Clear current default (best-effort; unique partial index enforces it too).
  await presetsTable().update({ is_default: false }).eq("user_id", user.id);
  const { error } = await presetsTable().update({ is_default: true }).eq("id", id);
  if (error) throw error;
}
