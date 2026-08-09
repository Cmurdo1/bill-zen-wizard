import { supabase } from "@/integrations/supabase/client";

export type DocumentClient = {
  name: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

export type DocumentBusiness = {
  company_name: string | null;
  full_name: string | null;
  email: string | null;
  business_address: string;
  logo_url: string | null;
  brand_color: string | null;
};

export async function fetchDocumentBranding(clientId: string | null) {
  const [{ data: { user } }, clientProbe, profileProbe] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("clients").select("address_line1").limit(1),
    supabase.from("profiles").select("company_name").limit(1),
  ]);

  const legacyClients = clientProbe.error?.code === "42703";
  const legacyProfiles = profileProbe.error?.code === "42703";
  const clientColumns = legacyClients
    ? "name,email,address"
    : "name,email,address_line1,address_line2,city,state,postal_code,country";
  const profileColumns = legacyProfiles
    ? "business_name,email,address,city,state,zip_code,country"
    : "business_name,company_name,full_name,email,address_line1,address_line2,city,state,postal_code,country,logo_url,brand_color";

  const [clientResult, profileResult] = await Promise.all([
    clientId
      ? supabase.from("clients").select(clientColumns as never).eq("id", clientId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    user
      ? supabase.from("profiles").select(profileColumns as never).eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const rawClient = (clientResult.data ?? null) as Record<string, unknown> | null;
  const rawProfile = (profileResult.data ?? null) as Record<string, unknown> | null;
  const client: DocumentClient | null = rawClient
    ? legacyClients
      ? {
          name: (rawClient.name as string) ?? null,
          email: (rawClient.email as string) ?? null,
          address_line1: (rawClient.address as string) ?? null,
          address_line2: null,
          city: null,
          state: null,
          postal_code: null,
          country: null,
        }
      : {
          name: (rawClient.name as string) ?? null,
          email: (rawClient.email as string) ?? null,
          address_line1: (rawClient.address_line1 as string) ?? null,
          address_line2: (rawClient.address_line2 as string) ?? null,
          city: (rawClient.city as string) ?? null,
          state: (rawClient.state as string) ?? null,
          postal_code: (rawClient.postal_code as string) ?? null,
          country: (rawClient.country as string) ?? null,
        }
    : null;

  const addressParts = legacyProfiles
    ? [
        rawProfile?.address,
        [rawProfile?.city, rawProfile?.state, rawProfile?.zip_code].filter(Boolean).join(", "),
        rawProfile?.country,
      ]
    : [
        rawProfile?.address_line1,
        rawProfile?.address_line2,
        [rawProfile?.city, rawProfile?.state, rawProfile?.postal_code].filter(Boolean).join(", "),
        rawProfile?.country,
      ];

  const business: DocumentBusiness = {
    company_name: (rawProfile?.company_name as string) ?? (rawProfile?.business_name as string) ?? null,
    full_name: legacyProfiles ? null : ((rawProfile?.full_name as string) ?? null),
    email: (rawProfile?.email as string) ?? user?.email ?? null,
    business_address: addressParts.filter(Boolean).join("\n"),
    logo_url: legacyProfiles ? null : ((rawProfile?.logo_url as string) ?? null),
    brand_color: legacyProfiles ? null : ((rawProfile?.brand_color as string) ?? null),
  };

  return { client, business };
}

/** Resolve a same-origin or CORS-enabled logo URL for jsPDF. Failure is non-fatal. */
export async function resolveLogoDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:image/")) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
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
