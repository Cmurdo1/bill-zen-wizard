import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2 } from "lucide-react";

type Client = { id: string; name: string; email: string | null; phone: string | null; city: string | null };

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "" });
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("id,name,email,phone,city")
      .order("name");
    setClients((data as Client[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  async function add() {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("clients").insert({
        user_id: user.id,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
      });
    }
    setForm({ name: "", email: "", phone: "", city: "" });
    setShowAdd(false);
    setSaving(false);
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this client?")) return;
    await supabase.from("clients").delete().eq("id", id);
    await refresh();
  }

  return (
    <AppShell title="Clients">
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft"
        >
          <Plus className="h-4 w-4" /> New client
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-soft">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No clients yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">City</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted/50">
                  <td className="px-6 py-4 font-semibold">{c.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.city ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lifted">
            <h2 className="font-display text-xl">New client</h2>
            <div className="mt-4 space-y-3">
              {(["name", "city", "email", "phone"] as const).map((k) => (
                <input
                  key={k}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  placeholder={k[0].toUpperCase() + k.slice(1)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="h-10 rounded-lg px-4 text-sm text-muted-foreground hover:bg-surface-muted">Cancel</button>
              <button onClick={add} disabled={saving || !form.name.trim()} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
