import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/marketing/shell";
import { safeRedirectPath } from "@/lib/safe-redirect";

// Route id is `/auth_/callback` (the `_` suffix in the filename keeps this page a
// sibling of `/auth` rather than a child of it). Nesting it under the `/auth`
// page would render the login form here instead of this component, because a
// parent route only renders its children through its own <Outlet />.
export const Route = createFileRoute("/auth_/callback")({
  validateSearch: z.object({
    code: z.string().optional(),
    error: z.string().optional(),
    error_code: z.string().optional(),
    error_description: z.string().optional(),
    next: z.string().optional(),
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    expires_at: z.string().optional(),
    expires_in: z.string().optional(),
    token_type: z.string().optional(),
    type: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Completing sign in — Honest Invoice" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CallbackPage,
});

/** Where the password-recovery flow lands so the user can choose a new password. */
export const RESET_PASSWORD_PATH = "/auth/reset-password";

// Supabase/Google return short machine codes; translate the common ones so the
// user sees an actionable sentence instead of a raw provider error.
function describeAuthError(code: string | undefined, description: string | undefined): string {
  switch (code) {
    case "access_denied":
      return "Google sign-in was cancelled. Try again, or log in with your email and password.";
    case "email_not_confirmed":
      return "Please confirm your email address first — check your inbox for the link.";
    case "otp_expired":
    case "token_expired":
      return "That link has expired. Request a new one and try again.";
    default:
      return description || code || "Authentication failed. Please try again.";
  }
}

function CallbackPage() {
  const search = useSearch({ from: "/auth_/callback" });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isRecovery] = useState(
    () => search.type === "recovery" || search.next === RESET_PASSWORD_PATH,
  );
  const navigate = useNavigate();

  const dest = safeRedirectPath(search.next);
  const {
    code,
    error,
    error_code,
    error_description,
    access_token,
    refresh_token,
    expires_at,
    expires_in,
  } = search;

  useEffect(() => {
    async function handleCallback() {
      setLoading(true);
      try {
        if (error) {
          throw new Error(describeAuthError(error_code ?? error, error_description ?? undefined));
        }

        // Tokens can arrive in the fragment (`#access_token=…`) while the PKCE
        // flow returns `?code=…`. Read the fragment *before* the first `await`:
        // supabase-js strips it while initialising.
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

        // `detectSessionInUrl` (a supabase-js default) may have already consumed
        // the code or tokens by now. Checking for an existing session first keeps
        // this handler idempotent and avoids exchanging the same code twice —
        // a double exchange fails and used to surface as a false "sign in failed".
        let session = (await supabase.auth.getSession()).data.session;

        if (!session) {
          const token = access_token ?? hash.get("access_token");
          const refresh = refresh_token ?? hash.get("refresh_token");

          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) throw exchangeError;
          } else if (token && refresh) {
            const expiresAt = Number(expires_at ?? hash.get("expires_at"));
            const expiresIn = Number(expires_in ?? hash.get("expires_in"));
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: token,
              refresh_token: refresh,
              ...(Number.isFinite(expiresAt) ? { expires_at: expiresAt } : {}),
              ...(Number.isFinite(expiresIn) ? { expires_in: expiresIn } : {}),
            });
            if (sessionError) throw sessionError;
          }

          session = (await supabase.auth.getSession()).data.session;
        }

        if (!session) throw new Error("No session was created. Please try again.");

        // Drop tokens and the one-time code from the address bar and history
        // before moving on.
        window.history.replaceState(null, "", window.location.pathname);

        const recovery = isRecovery || hash.get("type") === "recovery";
        await navigate({ to: recovery ? RESET_PASSWORD_PATH : dest, replace: true });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Authentication failed. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    handleCallback();
  }, [
    code,
    error,
    error_code,
    error_description,
    access_token,
    refresh_token,
    expires_at,
    expires_in,
    dest,
    isRecovery,
    navigate,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero p-6">
      <div className="w-full max-w-md text-center">
        <Logo />
        {loading ? (
          <>
            <h1 className="mt-4 font-display text-3xl text-foreground">Completing sign in…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait while we finish signing you in.
            </p>
          </>
        ) : err ? (
          <>
            <h1 className="mt-4 font-display text-3xl text-destructive">Sign in failed</h1>
            <p role="alert" className="mt-2 text-sm text-muted-foreground">
              {err}
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              <a
                href="/auth"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Try again
              </a>
              {isRecovery && (
                <a href="/auth" className="text-sm font-medium text-primary hover:underline">
                  Request a new password reset link
                </a>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 font-display text-3xl text-foreground">Success!</h1>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting…</p>
          </>
        )}
      </div>
    </div>
  );
}
