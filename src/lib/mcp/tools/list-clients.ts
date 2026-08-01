import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_clients",
  title: "List clients",
  description: "List the signed-in user's clients, optionally filtered by a name or email search term.",
  inputSchema: {
    search: z.string().optional().describe("Case-insensitive match on client name."),
    limit: z.number().int().optional().describe("Maximum clients to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    let query = supabaseForUser(ctx)
      .from("clients")
      .select("id,name,email,phone,city,state")
      .order("name")
      .limit(take);
    if (search?.trim()) query = query.ilike("name", `%${search.trim()}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }], structuredContent: { clients: data ?? [] } };
  },
});
