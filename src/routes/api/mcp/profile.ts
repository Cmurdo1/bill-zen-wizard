import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  assertMcpScope,
  createMcpContext,
  logMcpAction,
  mcpErrorResponse,
} from "@/lib/mcp-api-shared";

const ProfilePatch = z.object({
  full_name: z.string().trim().max(200).optional().nullable(),
  business_name: z.string().trim().max(200).optional().nullable(),
  company_name: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  address_line1: z.string().trim().max(200).optional().nullable(),
  address_line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  postal_code: z.string().trim().max(30).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  tax_id: z.string().trim().max(100).optional().nullable(),
  invoice_prefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,12}$/)
    .optional()
    .nullable(),
  estimate_prefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,12}$/)
    .optional()
    .nullable(),
  default_currency: z.string().trim().length(3).toUpperCase().optional(),
  default_payment_terms: z.number().int().min(0).max(365).optional().nullable(),
  logo_url: z.string().url().max(2000).optional().nullable(),
  brand_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
});

const PROFILE_COLUMNS =
  "id,full_name,business_name,company_name,phone,address_line1,address_line2,city,state,postal_code,country,tax_id,invoice_prefix,estimate_prefix,default_currency,default_payment_terms,logo_url,brand_color,subscription_status,subscription_end";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/mcp/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "read");
          const { data, error } = await context.supabase
            .from("profiles")
            .select(PROFILE_COLUMNS)
            .eq("id", context.userId)
            .maybeSingle();
          if (error) throw error;
          return json({ profile: data, plan: context.plan });
        } catch (error) {
          return mcpErrorResponse(error);
        }
      },
      PATCH: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          assertMcpScope(context, "write");
          const patch = ProfilePatch.parse(await request.json());
          const { data, error } = await context.supabase
            .from("profiles")
            .update(patch)
            .eq("id", context.userId)
            .select(PROFILE_COLUMNS)
            .single();
          if (error) throw error;
          await logMcpAction(context, "update", "profile", context.userId, {
            fields: Object.keys(patch),
          });
          return json({ profile: data });
        } catch (error) {
          if (error instanceof z.ZodError) return json({ error: "Invalid profile update" }, 400);
          return mcpErrorResponse(error);
        }
      },
    },
  },
});
