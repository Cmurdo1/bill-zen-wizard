import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

type InvoiceRow = { status: string; total_cents: number | null; currency: string | null; issue_date: string | null; due_date: string | null };

export default defineTool({
  name: "cash_summary",
  title: "Cash summary",
  description: "Summarize the signed-in user's invoice totals: paid, outstanding, overdue, and draft amounts.",
  inputSchema: {
    since: z.string().optional().describe("ISO date (YYYY-MM-DD). Only invoices issued on or after this date."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ since }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let query = supabaseForUser(ctx).from("invoices").select("status,total_cents,currency,issue_date,due_date");
    if (since) query = query.gte("issue_date", since);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []) as InvoiceRow[];
    const today = new Date().toISOString().slice(0, 10);
    const sum = (f: (r: InvoiceRow) => boolean) => rows.filter(f).reduce((n, r) => n + (r.total_cents ?? 0), 0);
    const summary = {
      currency: rows[0]?.currency ?? "USD",
      invoice_count: rows.length,
      paid_cents: sum((r) => r.status === "paid"),
      outstanding_cents: sum((r) => r.status === "sent" || r.status === "overdue"),
      overdue_cents: sum((r) => r.status !== "paid" && r.status !== "void" && !!r.due_date && r.due_date < today),
      draft_cents: sum((r) => r.status === "draft"),
    };
    return { content: [{ type: "text", text: JSON.stringify(summary) }], structuredContent: summary };
  },
});
