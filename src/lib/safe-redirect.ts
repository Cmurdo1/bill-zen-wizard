// Post-authentication redirect targets arrive from the URL (`?redirect=` on the
// auth page, `?next=` on the callback), so they are attacker-controlled. Only
// same-origin absolute paths are allowed; everything else falls back to the
// default destination.

const DEFAULT_DESTINATION = "/dashboard";

export function safeRedirectPath(
  value: string | undefined | null,
  fallback: string = DEFAULT_DESTINATION,
): string {
  if (!value || !value.startsWith("/")) return fallback;
  // Browsers treat "//host" and "/\host" as protocol-relative, so a naive
  // startsWith("/") check would still allow an off-site redirect.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Control characters (including newlines) can smuggle a new origin past
  // header/URL parsing.
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  return value;
}
