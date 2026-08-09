import { useEffect, useState } from "react";
import { Loader2, Mail, X } from "lucide-react";

export type SendDocumentClient = { id: string; name: string; email: string | null };

export function SendDocumentModal({
  open,
  onClose,
  title,
  defaultTo,
  onSend,
  clients,
  myEmail,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  defaultTo: string;
  onSend: (to: string, message: string) => Promise<void>;
  clients?: SendDocumentClient[];
  myEmail?: string;
}) {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setMessage("");
      setError(null);
    }
  }, [open, defaultTo]);

  if (!open) return null;

  async function submit() {
    const email = to.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSend(email, message.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the email.");
    } finally {
      setSending(false);
    }
  }

  const clientsWithEmail = clients?.filter((c) => c.email) ?? [];

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={() => !sending && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl">{title}</h3>
          <button
            onClick={onClose}
            disabled={sending}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Send to any address — email yourself first to review, then resend to the client.
        </p>

        <div className="mt-4 space-y-3">
          {clientsWithEmail.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Recipient
              </label>
              <select
                value=""
                onChange={(e) => {
                  const c = clientsWithEmail.find((x) => x.id === e.target.value);
                  if (c?.email) setTo(c.email);
                }}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">Choose a client…</option>
                {clientsWithEmail.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.email}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Email address
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@example.com"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
            {myEmail && (
              <button
                type="button"
                onClick={() => setTo(myEmail)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary transition-opacity hover:opacity-80"
                title="Send to your own inbox to review before sending to the client"
              >
                <Mail className="h-3 w-3" />
                Use my email ({myEmail})
              </button>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Anything to add? Payment terms, thanks, etc."
              className="w-full rounded-lg border border-border bg-background p-3 text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={sending}
            className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={sending || !to.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mail className="h-3.5 w-3.5" />
            )}
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
