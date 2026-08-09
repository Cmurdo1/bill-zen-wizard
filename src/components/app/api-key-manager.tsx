import { useEffect, useState } from "react";
import { KeyRound, Loader2, Copy, Check, ShieldCheck, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ApiKeyRecord = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

async function sessionToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(path: string, init?: RequestInit) {
    const token = await sessionToken();
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      keys?: ApiKeyRecord[];
      record?: ApiKeyRecord;
      key?: string;
      error?: string;
    };
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  async function load() {
    try {
      const payload = await request("/api/mcp/keys");
      setKeys(payload.keys ?? []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load API keys.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // This initial fetch intentionally runs once when the settings section mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give this key a name so you can identify it later.");
      return;
    }
    setSaving(true);
    setError(null);
    setNewSecret(null);
    try {
      const payload = await request("/api/mcp/keys", {
        method: "POST",
        body: JSON.stringify({ name: trimmedName }),
      });
      setName("");
      setNewSecret(payload.key ?? null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create API key.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id: string) {
    if (
      !window.confirm("Revoke this key permanently? Agents using it will stop working immediately.")
    ) {
      return;
    }
    setRevoking(id);
    setError(null);
    try {
      await request("/api/mcp/keys", {
        method: "PATCH",
        body: JSON.stringify({ id, revoked: true }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not revoke API key.");
    } finally {
      setRevoking(null);
    }
  }

  async function copySecret() {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Use a dedicated key for Claude, Cursor, cron jobs, and custom integrations. Keys are
            stored as hashes, shown only once, scoped to this account, and can be revoked anytime.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          placeholder="e.g. Claude Desktop"
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
          aria-label="API key name"
        />
        <button
          onClick={create}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Create key
        </button>
      </div>

      {newSecret && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <p className="text-xs font-semibold text-success">
            Copy this key now. It will not be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-background px-3 py-2 text-xs text-foreground">
              {newSecret}
            </code>
            <button
              onClick={copySecret}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys created yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{key.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <code>{key.key_prefix}…</code> · {key.scopes.join(", ")}
                  {key.revoked_at
                    ? " · Revoked"
                    : key.last_used_at
                      ? ` · Used ${new Date(key.last_used_at).toLocaleString()}`
                      : " · Never used"}
                </p>
              </div>
              {!key.revoked_at && (
                <button
                  onClick={() => void revoke(key.id)}
                  disabled={revoking === key.id}
                  className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-lg border border-destructive/30 px-3 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60 sm:self-auto"
                >
                  {revoking === key.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" />
                  )}
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
