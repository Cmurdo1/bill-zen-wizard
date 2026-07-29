import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { extractLineItems } from "@/lib/invoices.functions";
import { useServerFn } from "@tanstack/react-start";
import { formatCurrency, formatDate } from "@/lib/format";
import { AppShell } from "@/components/app/shell";
import { useSubscription } from "@/lib/subscription";
import { PlanBadge, UsageMeter, UpgradeCallout } from "@/components/app/plan-badge";
import { Plus, Sparkles, Loader2, Trash2, Lock } from "lucide-react";

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  total_cents: number;
  currency: string;
  issue_date: string;
  due_date: string | null;
  client_id: string | null;
};

type Client = { id: string; name: string; email: string | null };
type LineItem = { description: string; quantity: number; rate_cents: number };

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    setLoading(true);
    const [invRes, cliRes] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name,email").order("name"),
    ]);
    setInvoices((invRes.data as Invoice[]) ?? []);
    setClients((cliRes.data as Client[]) ?? []);
    setLoading(false);
  }

  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.total_cents, 0);
  const paidThisMonth = invoices
    .filter((i) => i.status === "paid" && new Date(i.issue_date).getMonth() === new Date().getMonth())
    .reduce((s, i) => s + i.total_cents, 0);

  return (
    <AppShell title="Dashboard">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-muted-foreground">Your invoices, cash, and clients in one place.</p>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New invoice
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatCurrency(outstanding)} />
        <Stat label="Paid this month" value={formatCurrency(paidThisMonth)} />
        <Stat label="Clients" value={clients.length.toString()} />
      </div>

      <section className="mt-10 rounded-2xl border border-border bg-surface shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Invoices</h2>
          <Link to="/pay-invoice" className="text-xs text-muted-foreground hover:text-foreground">Public payment page →</Link>
        </div>
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">No invoices yet.</p>
            <button
              onClick={() => setShowNew(true)}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Create your first invoice
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Invoice</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Issued</th>
                <th className="px-6 py-3">Due</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted/50">
                  <td className="px-6 py-4 font-semibold">{inv.invoice_number}</td>
                  <td className="px-6 py-4 text-muted-foreground">{clients.find((c) => c.id === inv.client_id)?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(inv.due_date)}</td>
                  <td className="px-6 py-4"><StatusPill status={inv.status} /></td>
                  <td className="px-6 py-4 text-right font-semibold tabular-nums">{formatCurrency(inv.total_cents, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showNew && (
        <NewInvoiceDialog
          clients={clients}
          onClose={() => setShowNew(false)}
          onCreated={async () => { setShowNew(false); await refresh(); }}
          onClientCreated={async () => {
            const { data } = await supabase.from("clients").select("id,name,email").order("name");
            setClients((data as Client[]) ?? []);
          }}
        />
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl text-foreground">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-primary/10 text-primary",
    paid: "bg-success/15 text-success",
    overdue: "bg-destructive/10 text-destructive",
    void: "bg-muted text-muted-foreground line-through",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${map[status] ?? map.draft}`}>{status}</span>;
}

function NewInvoiceDialog({
  clients,
  onClose,
  onCreated,
  onClientCreated,
}: {
  clients: Client[];
  onClose: () => void;
  onCreated: () => void;
  onClientCreated: () => Promise<void>;
}) {
  const extract = useServerFn(extractLineItems);
  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? "");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, rate_cents: 0 }]);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  const subtotal = items.reduce((s, i) => s + Math.round((i.quantity || 0) * (i.rate_cents || 0)), 0);
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;

  async function handleAi() {
    if (!description.trim()) return;
    setAiLoading(true); setError(null);
    try {
      const result = await extract({ data: { description, currency: "USD" } });
      setItems(result.items.length ? result.items : items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI extraction failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function createClient() {
    if (!newClientName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("clients").insert({
      user_id: user.id, name: newClientName.trim(), email: newClientEmail.trim() || null,
    }).select("id").single();
    if (error) { setError(error.message); return; }
    await onClientCreated();
    if (data) setClientId(data.id);
    setNewClientName(""); setNewClientEmail("");
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Fetch or create profile with next invoice number
      const { data: profile } = await supabase.from("profiles").select("invoice_prefix,next_invoice_number").eq("id", user.id).maybeSingle();
      const prefix = profile?.invoice_prefix ?? "INV";
      const num = profile?.next_invoice_number ?? 1001;

      const validItems = items.filter((i) => i.description.trim() && i.rate_cents > 0);
      const subtotalCents = validItems.reduce((s, i) => s + Math.round(i.quantity * i.rate_cents), 0);
      const taxCents = Math.round(subtotalCents * taxRate);
      const totalCents = subtotalCents + taxCents;

      const { data: inv, error: invErr } = await supabase.from("invoices").insert({
        user_id: user.id,
        client_id: clientId || null,
        invoice_number: `${prefix}-${num}`,
        status: "draft",
        due_date: dueDate,
        subtotal_cents: subtotalCents,
        tax_rate: taxRate,
        tax_cents: taxCents,
        total_cents: totalCents,
        currency: "USD",
      }).select("id").single();
      if (invErr) throw invErr;

      if (validItems.length && inv) {
        const rows = validItems.map((it, i) => ({
          invoice_id: inv.id,
          description: it.description,
          quantity: it.quantity,
          rate_cents: it.rate_cents,
          amount_cents: Math.round(it.quantity * it.rate_cents),
          sort_order: i,
        }));
        const { error: itemErr } = await supabase.from("invoice_items").insert(rows);
        if (itemErr) throw itemErr;
      }

      await supabase.from("profiles").upsert({ id: user.id, next_invoice_number: num + 1 });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-surface p-8 shadow-lifted">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">New invoice</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Client</label>
            {clients.length > 0 ? (
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                <option value="">— Select —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <div className="flex gap-2">
                <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="New client name" className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
                <input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="Email" className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
                <button onClick={createClient} className="h-10 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">Add</button>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-surface-muted/60 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold">AI line-item extraction</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Describe the job in plain English. AI will generate itemized labor and materials.</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Replaced 3-ton condenser, 4 hrs labor, R-410A refrigerant charge, warranty registration"
            className="mt-3 block w-full rounded-lg border border-border bg-background p-3 text-sm"
          />
          <button
            onClick={handleAi}
            disabled={aiLoading || !description.trim()}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-accent-foreground disabled:opacity-60"
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {aiLoading ? "Thinking…" : "Generate line items"}
          </button>
        </div>

        <div className="mt-6">
          <div className="mb-2 grid grid-cols-[1fr_90px_120px_120px_40px] gap-2 text-xs font-semibold text-muted-foreground">
            <span>Description</span><span>Qty</span><span>Rate</span><span className="text-right">Amount</span><span />
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="mb-2 grid grid-cols-[1fr_90px_120px_120px_40px] items-center gap-2">
              <input value={it.description} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} className="h-9 rounded-md border border-border bg-background px-2 text-sm" placeholder="Line item" />
              <input type="number" step="0.01" value={it.quantity} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
              <input type="number" step="0.01" value={(it.rate_cents / 100).toFixed(2)} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, rate_cents: Math.round(Number(e.target.value) * 100) } : x))} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
              <span className="text-right text-sm font-semibold tabular-nums">{formatCurrency(Math.round(it.quantity * it.rate_cents))}</span>
              <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={() => setItems([...items, { description: "", quantity: 1, rate_cents: 0 }])} className="mt-2 text-xs font-semibold text-primary hover:underline">+ Add line item</button>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tax</span>
              <div className="flex items-center gap-1">
                <input type="number" step="0.01" value={(taxRate * 100).toFixed(2)} onChange={(e) => setTaxRate(Number(e.target.value) / 100)} className="h-8 w-16 rounded-md border border-border bg-background px-1 text-right text-xs" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span><span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-lg border border-border px-4 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save invoice
          </button>
        </div>
      </div>
    </div>
  );
}
