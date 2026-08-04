import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/shell";
import { sendAdminEmail } from "@/lib/admin-email.functions";
import { Loader2, Mail, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/email")({
  head: () => ({ meta: [{ title: "Send email — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: AdminEmailPage,
});

const FROM_OPTIONS = [
  { value: "murdoch@honestinvoice.com", label: "murdoch@honestinvoice.com" },
  { value: "support@honestinvoice.com", label: "support@honestinvoice.com" },
] as const;

function AdminEmailPage() {
  const send = useServerFn(sendAdminEmail);
  const [from, setFrom] = useState<(typeof FROM_OPTIONS)[number]["value"]>("support@honestinvoice.com");
  const [fromName, setFromName] = useState("Honest Invoice");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await send({
        data: {
          from,
          fromName,
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject: subject.trim(),
          body,
        },
      });
      setStatus({ ok: true, msg: `Sent to ${res.to} from ${res.from}.` });
      setSubject("");
      setBody("");
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Mail className="h-5 w-5 text-primary" /> Send an email
            </h1>
            <p className="text-sm text-muted-foreground">
              Delivered through Resend from your verified Honest Invoice addresses.
            </p>
          </div>
          <Link to="/admin" className="text-sm text-primary hover:underline">
            Back to admin
          </Link>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">From address</span>
              <select
                className={input}
                value={from}
                onChange={(e) => setFrom(e.target.value as typeof from)}
              >
                {FROM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Display name</span>
              <input className={input} value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">To</span>
              <input
                className={input}
                type="email"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@example.com"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">CC (optional)</span>
              <input
                className={input}
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="one@example.com, two@example.com"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Subject</span>
            <input className={input} required value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Message</span>
            <textarea
              className={`${input} min-h-56`}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message. Blank lines become paragraphs."
            />
          </label>

          {status && (
            <p className={`text-sm ${status.ok ? "text-emerald-600" : "text-destructive"}`}>{status.msg}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send email
          </button>
        </form>
      </div>
    </AppShell>
  );
}
