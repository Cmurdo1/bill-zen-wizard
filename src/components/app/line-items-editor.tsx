import { Trash2, Plus } from "lucide-react";
import type { LineItem } from "@/lib/documents";
import { formatCurrency } from "@/lib/format";

export function LineItemsEditor({
  items,
  onChange,
  currency = "USD",
}: {
  items: LineItem[];
  onChange: (next: LineItem[]) => void;
  currency?: string;
}) {
  function update(idx: number, patch: Partial<LineItem>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...items, { description: "", quantity: 1, rate_cents: 0 }]);
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-[1fr_90px_120px_120px_40px] gap-2 text-xs font-semibold text-muted-foreground">
        <span>Description</span>
        <span>Qty</span>
        <span>Rate</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      {items.map((it, idx) => (
        <div key={idx} className="mb-2 grid grid-cols-[1fr_90px_120px_120px_40px] items-center gap-2">
          <input
            value={it.description}
            onChange={(e) => update(idx, { description: e.target.value })}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            placeholder="Line item"
          />
          <input
            type="number"
            step="0.01"
            value={it.quantity}
            onChange={(e) => update(idx, { quantity: Number(e.target.value) })}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            value={(it.rate_cents / 100).toFixed(2)}
            onChange={(e) => update(idx, { rate_cents: Math.round(Number(e.target.value) * 100) })}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          />
          <span className="text-right text-sm font-semibold tabular-nums">
            {formatCurrency(Math.round((it.quantity || 0) * (it.rate_cents || 0)), currency)}
          </span>
          <button
            onClick={() => remove(idx)}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove line item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add line item
      </button>
    </div>
  );
}
