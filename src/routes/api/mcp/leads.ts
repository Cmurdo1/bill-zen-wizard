import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  assertMcpScope,
  createMcpContext,
  logMcpAction,
  mcpErrorResponse,
  McpHttpError,
} from "@/lib/mcp-api-shared";

const Status = z.enum(["won", "lost"]);
const ListQuery = z.object({
  status: z.string().trim().max(30).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
const UpdateInput = z.object({
  lead_id: z.string().uuid(),
  status: Status,
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/mcp/leads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "read");
          const query = ListQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
          const db = context.supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          const { data: leads, error: leadsError } = await db
            .from("job_leads")
            .select(
              "id,title,description,location,contact_email,contact_phone,budget_range,source,status,created_at,updated_at",
            )
            .eq("user_id", context.userId)
            .order("created_at", { ascending: false })
            .limit(query.limit);
          if (leadsError) throw leadsError;

          const leadIds = (leads ?? []).map((lead: { id: string }) => lead.id);
          const { data: responses, error: responsesError } = leadIds.length
            ? await db
                .from("lead_responses")
                .select(
                  "id,lead_id,estimate_id,estimate_number,client_email,status,error_message,created_at,opened_at,clicked_at",
                )
                .eq("user_id", context.userId)
                .in("lead_id", leadIds)
                .order("created_at", { ascending: false })
            : { data: [], error: null };
          if (responsesError) throw responsesError;

          const latestByLead = new Map<string, Record<string, unknown>>();
          for (const response of responses ?? []) {
            if (!latestByLead.has(response.lead_id)) latestByLead.set(response.lead_id, response);
          }
          const result = (leads ?? [])
            .map((lead: Record<string, unknown>) => ({
              ...lead,
              response: latestByLead.get(String(lead.id)) ?? null,
            }))
            .filter((lead: { response?: { status?: string } | null }) =>
              query.status ? lead.response?.status === query.status : true,
            );

          return json({ leads: result });
        } catch (error) {
          if (error instanceof z.ZodError) return json({ error: "Invalid lead query" }, 400);
          return mcpErrorResponse(error);
        }
      },

      PATCH: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "write");
          const input = UpdateInput.parse(await request.json());
          const db = context.supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          const { data: response, error: responseError } = await db
            .from("lead_responses")
            .update({ status: input.status })
            .eq("lead_id", input.lead_id)
            .eq("user_id", context.userId)
            .select("id,lead_id,status")
            .maybeSingle();
          if (responseError) throw responseError;
          if (!response) throw new McpHttpError(404, "Lead response not found");
          await logMcpAction(context, "update", "lead_response", response.id, {
            status: input.status,
          });
          return json({ response });
        } catch (error) {
          if (error instanceof z.ZodError) return json({ error: "Invalid lead update" }, 400);
          return mcpErrorResponse(error);
        }
      },
    },
  },
});
