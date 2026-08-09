import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2 } from "lucide-react";

export type PricingRuleRow = {
  id: string;
  label: string;
  unit: string;
  rate_cents: number;
  notes: string | null;
};

export function RateBookEditor({ currency = "USD" }: { currency?: string }) {
  const [rows, setRows] = useState<PricingRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ label: "", unit: "sq ft", rate: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("pricing_rules")
      .select("id,label,unit,rate_cents,notes")
      .order("label");
    setRows((data as PricingRuleRow[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function add() {
    setError(null);
    const label = draft.label.trim();
    const unit = draft.unit.trim() || "each";
    const rate = Number(draft.rate);
    if (label.length < 2) {
      setError("Give the rate a name.");
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setError("Enter a valid rate.");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error: insErr } = await supabase.from("pricing_rules").insert({
      user_id: user.id,
      label,
      unit,
      rate_cents: Math.round(rate * 100),
      notes: draft.notes.trim() || null,
    });
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setDraft({ label: "", unit, rate: "", notes: "" });
    await load();
  }

  async function remove(id: string) {
    await supabase.from("pricing_rules").delete().eq("id", id);
    await load();
  }

  return (
    <div>
      {loading ? (
        <div className="grid place-items-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rates yet. Add your standard prices so AI estimates stay consistent job to job.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{r.label}</p>
                {r.notes && <p className="truncate text-xs text-muted-foreground">{r.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
                    r.rate_cents / 100,
                  )}{" "}
                  / {r.unit}
                </span>
                <button
                  onClick={() => remove(r.id)}
                  aria-label={`Delete ${r.label}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_110px_110px_auto]">
        <input
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="Interior painting — 2 coats"
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <input
          value={draft.unit}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
          placeholder="sq ft"
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <input
          value={draft.rate}
          onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
          inputMode="decimal"
          placeholder="2.75"
          className="h-10 rounded-lg border border-border bg-background px-3 text-right text-sm"
        />
        <button
          onClick={add}
          disabled={saving}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}{" "}
          Add rate
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}
