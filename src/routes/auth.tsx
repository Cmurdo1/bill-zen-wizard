import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/marketing/shell";

const AuthSearch = z.object({
  mode: z.enum(["login", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: AuthSearch,
  head: () => ({
    meta: [
      { title: "Sign in — Honest Invoice" },
      { name: "description", content: "Log in or create your Honest Invoice account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode, redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"login" | "signup">(initialMode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const dest = redirect && redirect.startsWith("/") ? redirect : "/dashboard";

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });
    if (error) {
      setError(error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    // OAuth redirects - we won't reach here
  }

  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: dest });
          return;
        }
        // No session returned — try to sign in immediately (auto-confirm on)
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          setInfo("Account created. Check your email to confirm, then log in.");
          setMode("login");
          return;
        }
        navigate({ to: dest });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: dest });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (/weak.?password|pwned/i.test(msg)) {
        setError(
          "That password appears in a known breach list. Please pick a stronger one (mix of letters, numbers, symbols; 12+ chars).",
        );
      } else if (/invalid.?login|invalid.?credentials/i.test(msg)) {
        setError("Email or password is incorrect.");
      } else if (/already.?registered|already.?exists|user.?already/i.test(msg)) {
        setError("An account with that email already exists. Try logging in.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-hero lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <Logo className="text-primary-foreground [&_span:last-child]:text-primary-foreground [&_span:first-child]:bg-primary-foreground/10 [&_svg]:text-primary-foreground" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/60">
            Product facts
          </p>
          <h2 className="mt-4 font-display text-4xl leading-tight">
            Spend less time on paperwork. Keep your focus on the work.
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Fact value="3 steps" label="from client to sent invoice" />
            <Fact value="5 / month" label="free invoices, no card required" />
            <Fact value="150+" label="currencies supported" />
            <Fact value="1 link" label="secure payment link per invoice" />
          </div>
          <p className="mt-6 text-xs leading-relaxed text-primary-foreground/60">
            These are product capabilities—not customer outcome guarantees. Business results vary by
            workflow, pricing, and clients.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Honest Invoice
        </div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <Logo />
          </div>
          <h1 className="mt-4 font-display text-3xl text-foreground">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Send your first invoice in under two minutes."
              : "Log in to your Honest Invoice account."}
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground shadow-soft transition hover:bg-surface-muted disabled:opacity-60"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or with email{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <Field label="Full name">
                <input
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </Field>
            )}
            <Field label="Email">
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </Field>

            {info && (
              <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{info}</p>
            )}
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Just a moment…" : mode === "signup" ? "Create account" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to Honest Invoice?"}{" "}
            <button
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "signup" ? "Log in" : "Create one"}
            </button>
          </p>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>

      <style>{`.input { display:block; width:100%; height:2.75rem; border-radius:0.75rem; border:1px solid var(--color-border); background: var(--color-surface); padding:0 0.875rem; font-size:0.875rem; color: var(--color-foreground); outline: none; }
      .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 3px oklch(0.55 0.1 260 / 0.15); }`}</style>
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-3">
      <p className="font-display text-2xl text-primary-foreground">{value}</p>
      <p className="mt-1 text-xs leading-snug text-primary-foreground/65">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.12A6.98 6.98 0 015.47 12c0-.74.13-1.45.36-2.12V7.04H2.18A11 11 0 001 12c0 1.78.43 3.47 1.18 4.96l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
