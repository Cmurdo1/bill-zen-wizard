import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/marketing/shell";

const CallbackSearch = z.object({
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
});

export const Route = createFileRoute("/auth/callback")({
  validateSearch: CallbackSearch,
  head: () => ({
    meta: [
      { title: "Completing sign in — Honest Invoice" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const {
    code,
    error,
    error_code,
    error_description,
    next,
    access_token,
    refresh_token,
    expires_at,
    expires_in,
  } = useSearch({ from: "/auth/callback" });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  const dest = next && next.startsWith("/") ? next : "/dashboard";

  useEffect(() => {
    async function handleCallback() {
      setLoading(true);
      try {
        if (error) {
          throw new Error(error_description ?? error_code ?? error);
        }

        // Supabase normally returns a PKCE `code`, but hosted redirects and
        // older provider configurations can return the implicit-flow tokens.
        // Handle both shapes so Google sign-in never lands in a false success.
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          // Implicit-flow providers return tokens in the URL hash, which is not
          // included in TanStack Router's validated search params.
          const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const hashAccessToken = hash.get("access_token");
          const hashRefreshToken = hash.get("refresh_token");
          const token = access_token ?? hashAccessToken;
          const refresh = refresh_token ?? hashRefreshToken;
          if (token && refresh) {
            const expiresAt = Number(expires_at ?? hash.get("expires_at"));
            const expiresIn = Number(expires_in ?? hash.get("expires_in"));
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: token,
              refresh_token: refresh,
              ...(Number.isFinite(expiresAt) ? { expires_at: expiresAt } : {}),
              ...(Number.isFinite(expiresIn) ? { expires_in: expiresIn } : {}),
            });
            if (sessionError) throw sessionError;
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${window.location.search}`,
            );
          }
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) throw new Error("No session was created. Please try again.");
        await navigate({ to: dest, replace: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Authentication failed";
        setErr(msg);
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
    next,
    access_token,
    refresh_token,
    expires_at,
    expires_in,
    navigate,
    dest,
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
            <p className="mt-2 text-sm text-muted-foreground">{err}</p>
            <a
              href="/auth"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </a>
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
