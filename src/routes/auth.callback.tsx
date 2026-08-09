import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/marketing/shell";

const CallbackSearch = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  next: z.string().optional(),
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
  const { code, error, error_description, next } = useSearch({ from: "/auth/callback" });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  const dest = next && next.startsWith("/") ? next : "/dashboard";

  useEffect(() => {
    async function handleCallback() {
      setLoading(true);
      try {
        if (error) {
          throw new Error(error_description ?? error);
        }
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        navigate({ to: dest });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Authentication failed";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    }
    handleCallback();
  }, [code, error, error_description, next, navigate, dest]);

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
