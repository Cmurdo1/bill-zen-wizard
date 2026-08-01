import { supabase } from "@/integrations/supabase/client";
import { limitsFor, type Plan } from "./subscription";

export type DocumentBranding = {
  brandColor: string;
  accentColor: string;
  tagline: string | null;
  footerText: string | null;
  logoDataUrl: string | null;
};

export const DEFAULT_BRAND_COLOR = "#0f2f4f";
export const DEFAULT_ACCENT_COLOR = "#16a34a";

/** Branding on documents is a paid-plan feature. */
export function brandingAllowed(plan: Plan) {
  return plan !== "free" && limitsFor(plan).ai;
}

export function hexToRgb(hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export async function loadImageDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

type BrandProfileRow = {
  brand_color: string | null;
  brand_accent_color: string | null;
  brand_tagline: string | null;
  document_footer_text: string | null;
  brand_show_logo: boolean | null;
  logo_url: string | null;
  subscription_status: string | null;
  subscription_end: string | null;
};

/**
 * Fetches the signed-in user's document branding. Returns null for free plans
 * so documents fall back to the clean default layout.
 */
export async function fetchDocumentBranding(userId: string, plan: Plan): Promise<DocumentBranding | null> {
  if (!brandingAllowed(plan)) return null;
  const { data } = await supabase
    .from("profiles")
    .select("brand_color,brand_accent_color,brand_tagline,document_footer_text,brand_show_logo,logo_url,subscription_status,subscription_end")
    .eq("id", userId)
    .maybeSingle();
  const p = data as BrandProfileRow | null;
  if (!p) return null;
  return {
    brandColor: p.brand_color || DEFAULT_BRAND_COLOR,
    accentColor: p.brand_accent_color || DEFAULT_ACCENT_COLOR,
    tagline: p.brand_tagline,
    footerText: p.document_footer_text,
    logoDataUrl: p.brand_show_logo === false ? null : await loadImageDataUrl(p.logo_url),
  };
}
