import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  assertMcpScope,
  createMcpContext,
  isLegacyInvoiceSchema,
  mcpErrorResponse,
} from "@/lib/mcp-api-shared";

const ActivityQuery = z.object({
  document_type: z.enum(["invoice", "estimate"]),
  document_id: z.string().uuid(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/mcp/documents/activity")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "read");
          const query = ActivityQuery.parse(Object.fromEntries(new URL(request.url).searchParams));

          const legacy = await isLegacyInvoiceSchema(context.supabase);
          const table = legacy || query.document_type === "invoice" ? "invoices" : "estimates";
          let documentQuery = context.supabase
            .from(table)
            .select("id")
            .eq("id", query.document_id)
            .eq("user_id", context.userId);
          if (legacy) documentQuery = documentQuery.eq("type", query.document_type);
          const { data: document, error: documentError } = await documentQuery.maybeSingle();
          if (documentError) throw documentError;
          if (!document) return json({ error: "Document not found" }, 404);

          const { data, error } = await context.supabase
            .from("document_activity")
            .select("id,action,detail,created_at")
            .eq("user_id", context.userId)
            .eq("document_type", query.document_type)
            .eq("document_id", query.document_id)
            .order("created_at", { ascending: false })
            .limit(query.limit);
          if (error) throw error;
          return json({ activity: data ?? [] });
        } catch (error) {
          if (error instanceof z.ZodError) return json({ error: "Invalid activity query" }, 400);
          return mcpErrorResponse(error);
        }
      },
    },
  },
});
