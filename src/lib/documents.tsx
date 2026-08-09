export type LineItem = {
  description: string;
  quantity: number;
  rate_cents: number;
};

export function computeTotals(items: LineItem[], taxRate: number) {
  const subtotal = items.reduce(
    (s, i) => s + Math.round((i.quantity || 0) * (i.rate_cents || 0)),
    0,
  );
  const tax = Math.round(subtotal * taxRate);
  return { subtotal, tax, total: subtotal + tax };
}

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "void"] as const;
export const ESTIMATE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "converted",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export function statusClass(status: string): string {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-primary/10 text-primary",
    paid: "bg-success/15 text-success",
    accepted: "bg-success/15 text-success",
    overdue: "bg-destructive/10 text-destructive",
    declined: "bg-destructive/10 text-destructive",
    expired: "bg-warning/15 text-warning-foreground",
    converted: "bg-accent/20 text-accent-foreground",
    void: "bg-muted text-muted-foreground line-through",
  };
  return map[status] ?? map.draft;
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(status)}`}
    >
      {status}
    </span>
  );
}
