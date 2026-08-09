import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/shell";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type ClientForm = {
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  email: string;
  phone: string;
};

const EMPTY_FORM: ClientForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  postal_code: "",
  email: "",
  phone: "",
};

type ClientsRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [{ title: "Clients — Honest Invoice" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(false);
  // The live database uses a legacy clients schema (a single `address`
  // column, no city/state), while this repo's migrations use a structured
  // address schema (address_line1/address_line2/city/state/postal_code).
  // Probe once so reads and writes work against either schema.
  const [legacy, setLegacy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { error } = (await supabase
          .from("clients")
          .select("address_line1")
          .limit(1)) as unknown as { error: { code?: string } | null };
        setLegacy(!!(error && error.code === "42703"));
      } catch {
        // Unknown schema — default to this repo's structured schema.
        setLegacy(false);
      } finally {
        setSchemaReady(true);
      }
    })();
  }, []);

  async function refresh() {
    setLoading(true);
    const columns = legacy
      ? "id,name,email,phone,address"
      : "id,name,email,phone,address_line1,address_line2,city,state,postal_code";
    const { data, error } = (await supabase
      .from("clients")
      .select(columns)
      .order("name")) as unknown as {
      data: ClientsRow[] | null;
      error: { message: string } | null;
    };
    if (error) {
      toast.error(`Couldn't load clients: ${error.message}`);
      setClients([]);
      setLoading(false);
      return;
    }
    setClients(
      (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email ?? null,
        phone: r.phone ?? null,
        address: legacy
          ? r.address ?? null
          : [r.address_line1, r.address_line2, r.city, r.state, r.postal_code]
              .filter((x) => x && x.trim())
              .join(", ") || null,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    if (!schemaReady) return;
    void refresh();
  }, [schemaReady, legacy]);

  async function add() {
    if (!form.name.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not signed in");
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    };
    if (legacy) {
      payload.address = form.address.trim() || null;
    } else {
      payload.address_line1 = form.address.trim() || null;
      payload.city = form.city.trim() || null;
      payload.state = form.state.trim() || null;
      payload.postal_code = form.postal_code.trim() || null;
    }

    const { error } = (await supabase
      .from("clients")
      // Legacy live schema has no city/state columns, so the payload
      // columns are chosen to match whichever schema is live.
      .insert(payload as never)) as unknown as {
      error: { message: string } | null;
    };
    if (error) {
      toast.error(`Couldn't save client: ${error.message}`);
      setSaving(false);
      return;
    }

    toast.success("Client added");
    setForm(EMPTY_FORM);
    setShowAdd(false);
    setSaving(false);
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this client?")) return;
    const { error } = (await supabase.from("clients").delete().eq("id", id)) as unknown as {
      error: { message: string } | null;
    };
    if (error) {
      toast.error(`Couldn't delete client: ${error.message}`);
      return;
    }
    toast.success("Client deleted");
    await refresh();
  }

  return (
    <AppShell title="Clients">
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New client
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-soft">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No clients yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Address</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border/60 last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="px-6 py-4 font-semibold">{c.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.address ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => remove(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
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
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-lifted">
            <h2 className="font-display text-xl">New client</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only a name is required — everything else is optional.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Client name"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Address
                </label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Street address"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </div>

              {!legacy && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                        City
                      </label>
                      <input
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="City"
                        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                        State
                      </label>
                      <input
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                        placeholder="State"
                        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                      ZIP / Postal code
                    </label>
                    <input
                      value={form.postal_code}
                      onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                      placeholder="ZIP / Postal code"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Email"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Phone"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="h-10 rounded-lg px-4 text-sm text-muted-foreground hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                onClick={add}
                disabled={saving || !form.name.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
