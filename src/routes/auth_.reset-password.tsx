import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/marketing/shell";

// Sibling of `/auth` for the same reason as the callback route: a `_` suffix in
// the filename keeps this page from nesting under the `/auth` login page.
export const Route = createFileRoute("/auth_/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Honest Invoice" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  // The recovery link signs the user in before they reach this page, so a
  // session is what proves the link is still valid.
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
      setChecking(false);
    })();
  }, []);

  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const submitDisabled = saving || passwordTooShort || passwordMismatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      // A password change should invalidate sessions on other devices.
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch {
        // Best effort — the password is already changed.
      }
      await navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update your password.";
      if (/weak.?password|pwned/i.test(msg)) {
        setError(
          "That password appears in a known breach list. Please pick a stronger one (mix of letters, numbers, symbols; 12+ chars).",
        );
      } else if (/same.?password|should be different|identical/i.test(msg)) {
        setError("Your new password must be different from your current one.");
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero p-6">
      <div className="w-full max-w-md">
        <Logo />
        <h1 className="mt-4 font-display text-3xl text-foreground">Set a new password</h1>

        {checking ? (
          <p className="mt-2 text-sm text-muted-foreground">Checking your reset link…</p>
        ) : !hasSession ? (
          <>
            <p role="alert" className="mt-2 text-sm text-muted-foreground">
              This reset link has expired or has already been used. Request a new one to continue.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Back to log in
            </Link>
          </>
        ) : done ? (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            Password updated. Taking you to your dashboard…
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a new password for your account.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-foreground">
                  New password
                </span>
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={passwordTooShort || undefined}
                  aria-describedby="new-password-hint"
                  className="input"
                />
                <span
                  id="new-password-hint"
                  className={`mt-1 block text-xs ${
                    passwordTooShort ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {passwordTooShort
                    ? "Password must be at least 8 characters."
                    : "At least 8 characters, mixing letters, numbers, and symbols."}
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-foreground">
                  Confirm new password
                </span>
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={passwordMismatch || undefined}
                  className="input"
                />
                {passwordMismatch && (
                  <span className="mt-1 block text-xs text-destructive">
                    Passwords don&apos;t match.
                  </span>
                )}
              </label>

              {error && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitDisabled}
                aria-busy={saving}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`.input { display:block; width:100%; height:2.75rem; border-radius:0.75rem; border:1px solid var(--color-border); background: var(--color-surface); padding:0 0.875rem; font-size:0.875rem; color: var(--color-foreground); outline: none; }
      .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 3px oklch(0.55 0.1 260 / 0.15); }`}</style>
    </div>
  );
}
