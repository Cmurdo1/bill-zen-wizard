import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scope?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { mode: "login", redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="grid min-h-screen place-items-center bg-hero p-6">
      <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-soft">
        <h1 className="font-display text-2xl">Authorization request failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "this app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) { setBusy(false); setError(err.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-hero p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-soft">
        <h1 className="font-display text-2xl text-foreground">Connect {clientName} to Honest Invoice</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {clientName} will be able to read your invoices, estimates, clients, and cash totals as you, while you are signed in.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm text-foreground">
          <li>• View your invoices and their line items</li>
          <li>• View your estimates</li>
          <li>• View your clients</li>
          <li>• View paid, outstanding, and overdue totals</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          This does not bypass Honest Invoice permissions, and it cannot change or delete your data.
        </p>
        {error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold hover:bg-surface-muted disabled:opacity-60"
          >
            Cancel connection
          </button>
        </div>
      </div>
    </main>
  );
}
