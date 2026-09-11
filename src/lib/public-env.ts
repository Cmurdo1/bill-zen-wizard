// Public (browser-safe) configuration.
//
// Vite inlines `import.meta.env.VITE_*` at build time, so a deploy whose build
// step is missing those variables ships a bundle with no Supabase config. The
// server serializes the same values into `window.__PUBLIC_ENV__` (see
// __root.tsx) so the browser can read them at runtime instead.

export const PUBLIC_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_STRIPE_PAYMENT_LINK_PRO",
  "VITE_STRIPE_PAYMENT_LINK_BUSINESS",
] as const;

export type PublicEnvKey = (typeof PUBLIC_ENV_KEYS)[number];

// Server-side names to fall back to, in order, when the VITE_ variable is unset.
const SERVER_ALIASES: Record<PublicEnvKey, readonly string[]> = {
  VITE_SUPABASE_URL: ["VITE_SUPABASE_URL", "SUPABASE_URL"],
  VITE_SUPABASE_PUBLISHABLE_KEY: [
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  ],
  VITE_STRIPE_PAYMENT_LINK_PRO: ["VITE_STRIPE_PAYMENT_LINK_PRO", "STRIPE_PAYMENT_LINK_PRO"],
  VITE_STRIPE_PAYMENT_LINK_BUSINESS: [
    "VITE_STRIPE_PAYMENT_LINK_BUSINESS",
    "STRIPE_PAYMENT_LINK_BUSINESS",
  ],
};

declare global {
  interface Window {
    __PUBLIC_ENV__?: Partial<Record<PublicEnvKey, string>>;
  }
}

function fromBuild(key: PublicEnvKey): string | undefined {
  return (import.meta.env as Record<string, string | undefined>)[key] || undefined;
}

function fromProcess(key: PublicEnvKey): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  for (const name of SERVER_ALIASES[key]) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export function publicEnv(key: PublicEnvKey): string | undefined {
  return (
    fromBuild(key) ||
    (typeof window !== "undefined" ? window.__PUBLIC_ENV__?.[key] : undefined) ||
    fromProcess(key)
  );
}

// Inline script body injected into the document head. On the client this
// re-serializes the values the server already injected, so the markup matches
// during hydration.
export function publicEnvScript(): string {
  const values: Partial<Record<PublicEnvKey, string>> = {};
  for (const key of PUBLIC_ENV_KEYS) {
    const value = publicEnv(key);
    if (value) values[key] = value;
  }
  return `window.__PUBLIC_ENV__=${JSON.stringify(values).replace(/</g, "\\u003c")}`;
}
