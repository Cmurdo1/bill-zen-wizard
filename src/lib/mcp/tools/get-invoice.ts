import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_invoice",
  title: "Get invoice",
  description: "Get one invoice of the signed-in user with its line items, by invoice number or id.",
  inputSchema: {
    invoice_number: z.string().optional().describe("Invoice number, e.g. INV-0007."),
    id: z.string().optional().describe("Invoice UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ invoice_number, id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    if (!invoice_number && !id) return { content: [{ type: "text", text: "Provide invoice_number or id" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase.from("invoices").select("*").limit(1);
    query = id ? query.eq("id", id) : query.eq("invoice_number", invoice_number!);
    const { data: invoice, error } = await query.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!invoice) return { content: [{ type: "text", text: "Invoice not found" }], isError: true };
    const { data: items } = await supabase
      .from("invoice_items")
      .select("description,quantity,rate_cents,sort_order")
      .eq("invoice_id", (invoice as { id: string }).id)
      .order("sort_order");
    const payload = { invoice, items: items ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
