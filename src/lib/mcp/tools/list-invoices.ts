import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_invoices",
  title: "List invoices",
  description: "List the signed-in user's invoices, newest first, optionally filtered by status.",
  inputSchema: {
    status: z.enum(["draft", "sent", "paid", "overdue", "void"]).optional().describe("Filter by invoice status."),
    limit: z.number().int().optional().describe("Maximum invoices to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = supabaseForUser(ctx)
      .from("invoices")
      .select("id,invoice_number,status,issue_date,due_date,currency,total_cents,client_id")
      .order("issue_date", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { invoices: data ?? [] },
    };
  },
});
