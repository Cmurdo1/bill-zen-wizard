import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_estimates",
  title: "List estimates",
  description: "List the signed-in user's estimates, newest first, optionally filtered by status.",
  inputSchema: {
    status: z.string().optional().describe("Filter by estimate status, e.g. draft, sent, accepted."),
    limit: z.number().int().optional().describe("Maximum estimates to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = supabaseForUser(ctx)
      .from("estimates")
      .select("id,estimate_number,status,issue_date,expiry_date,currency,total_cents,client_id,converted_invoice_id")
      .order("issue_date", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }], structuredContent: { estimates: data ?? [] } };
  },
});
