import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  assertMcpScope,
  createMcpContext,
  logMcpAction,
  mcpErrorResponse,
  McpHttpError,
} from "@/lib/mcp-api-shared";

const ClientInput = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  address_line1: z.string().trim().max(200).optional().nullable(),
  address_line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  postal_code: z.string().trim().max(30).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

const ClientPatch = ClientInput.partial();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/mcp/clients")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "read");
          const { userId, supabase } = context;
          const url = new URL(request.url);
          const search = url.searchParams.get("search")?.trim();
          const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
          let query = supabase
            .from("clients")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);
          if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
          const { data, error } = await query;
          if (error) throw error;
          return json({ clients: data ?? [] });
        } catch (error) {
          return mcpErrorResponse(error);
        }
      },

      POST: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "write");
          const input = ClientInput.parse(await request.json());
          const { data, error } = await context.supabase
            .from("clients")
            .insert({ ...input, user_id: context.userId })
            .select()
            .single();
          if (error) throw error;
          await logMcpAction(context, "create", "client", data.id);
          return json({ client: data }, 201);
        } catch (error) {
          if (error instanceof z.ZodError) return json({ error: "Invalid client input" }, 400);
          return mcpErrorResponse(error);
        }
      },

      PATCH: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "write");
          const body = z
            .object({ id: z.string().uuid(), patch: ClientPatch })
            .parse(await request.json());
          const { data, error } = await context.supabase
            .from("clients")
            .update(body.patch)
            .eq("id", body.id)
            .eq("user_id", context.userId)
            .select()
            .maybeSingle();
          if (error) throw error;
          if (!data) throw new McpHttpError(404, "Client not found");
          await logMcpAction(context, "update", "client", data.id, {
            fields: Object.keys(body.patch),
          });
          return json({ client: data });
        } catch (error) {
          if (error instanceof z.ZodError) return json({ error: "Invalid client update" }, 400);
          return mcpErrorResponse(error);
        }
      },
    },
  },
});
