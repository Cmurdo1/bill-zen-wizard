import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  createMcpContext,
  enforceMcpActionRateLimit,
  mcpErrorResponse,
  McpHttpError,
  assertMcpScope,
  logMcpAction,
} from "@/lib/mcp-api-shared";
import { runScrape, type ScrapeConfig } from "@/lib/scrapers";

/**
 * POST /api/mcp/leads/scrape
 *
 * Cron-triggered endpoint that scrapes Craigslist, Nextdoor, and/or Facebook
 * for new leads and auto-posts each one to the lead webhook for estimate
 * creation and email sending.
 *
 * Designed to be called by external cron services (cron-job.org, Vercel Cron,
 * GitHub Actions schedule, etc.) every 5–15 minutes.
 *
 * Requires a valid Supabase user JWT in the Authorization header.
 * Business plan required for automated sending.
 *
 * Request body:
 * {
 *   "sources": ["craigslist", "nextdoor", "facebook"],
 *   "cl_city": "atlanta",
 *   "cl_category": "hva",
 *   "keywords": "HVAC,repair,install",
 *   "max_per_source": 10,
 *   "auto_send": true
 * }
 */

const ScrapeInput = z.object({
  sources: z
    .array(z.enum(["craigslist", "nextdoor", "facebook"]))
    .min(1)
    .default(["craigslist"]),
  cl_city: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,40}$/i)
    .default("atlanta"),
  cl_category: z.enum(["hva", "egr", "bbb", "skl", "lbs", "hss", "trd"]).default("hva"),
  keywords: z.string().optional(),
  max_per_source: z.number().int().min(1).max(50).default(10),
  auto_send: z.boolean().default(true),
});

async function postToWebhook(
  lead: {
    title: string;
    description: string;
    location: string;
    contact_email?: string;
    contact_phone?: string;
    budget_range?: string;
    source: string;
  },
  accessToken: string,
  baseUrl: string,
  taxRate: number,
  autoSend: boolean,
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = `${baseUrl}/api/mcp/leads/webhook`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: lead.title,
        description: lead.description,
        location: lead.location,
        contact_email: lead.contact_email || "unknown@example.com",
        contact_phone: lead.contact_phone,
        budget_range: lead.budget_range,
        source: lead.source,
        tax_rate: taxRate,
        auto_send: autoSend,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Webhook returned ${res.status}: ${errText.slice(0, 200)}` };
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export const Route = createFileRoute("/api/mcp/leads/scrape")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          const { userId, supabase, plan } = context;
          assertMcpScope(context, "leads");
          await enforceMcpActionRateLimit(context, "leads");

          // MCP access is already gated to paid plans by createMcpContext;
          // automated lead scraping is the additional Business-only capability.
          if (plan !== "business") {
            throw new McpHttpError(403, "Lead scraping requires an active Business plan.");
          }

          const body = await request.json();
          const parsed = ScrapeInput.parse(body);

          const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

          // Create a scrape run record
          const { data: run, error: runError } = await db
            .from("scrape_runs")
            .insert({
              user_id: userId,
              sources: parsed.sources,
              config: parsed,
              status: "running",
            })
            .select()
            .single();

          if (runError) throw runError;

          // Run the scrapers
          const config: ScrapeConfig = {
            sources: parsed.sources as ScrapeConfig["sources"],
            cl_city: parsed.cl_city,
            cl_category: parsed.cl_category,
            keywords: parsed.keywords,
            max_per_source: parsed.max_per_source,
          };

          const results = await runScrape(config);

          // Extract the access token from the request to forward to the webhook
          const authHeader = request.headers.get("Authorization") || "";
          const accessToken = authHeader.replace("Bearer ", "");

          // Never derive an internal callback URL from the untrusted Host header:
          // doing so would forward the caller's credential to an attacker-controlled host.
          const baseUrl = (
            process.env.APP_BASE_URL ||
            process.env.APP_URL ||
            "https://honestinvoice.com"
          ).replace(/\/+$/, "");

          // Default tax rate from profile or 0
          const taxRate = 0;

          // Post each lead to the webhook
          let totalLeads = 0;
          let estimatesCreated = 0;
          let emailsSent = 0;
          const allErrors: string[] = [];

          for (const result of results) {
            if (result.error) {
              allErrors.push(`${result.source}: ${result.error}`);
              continue;
            }

            totalLeads += result.leads.length;

            for (const lead of result.leads) {
              const webhookResult = await postToWebhook(
                lead,
                accessToken,
                baseUrl,
                taxRate,
                parsed.auto_send,
              );

              if (webhookResult.success) {
                estimatesCreated++;
                if (parsed.auto_send) emailsSent++;
              } else if (webhookResult.error) {
                allErrors.push(
                  `${result.source} lead "${lead.title.slice(0, 80)}": ${webhookResult.error}`,
                );
              }
            }
          }

          // Update the scrape run record
          await db
            .from("scrape_runs")
            .update({
              leads_found: totalLeads,
              estimates_created: estimatesCreated,
              emails_sent: emailsSent,
              errors: allErrors.length > 0 ? allErrors : undefined,
              status: "completed",
            })
            .eq("id", run.id)
            .eq("user_id", userId);

          await logMcpAction(context, "scrape_leads", "scrape_run", run.id, {
            sources: parsed.sources,
            leads_found: totalLeads,
            estimates_created: estimatesCreated,
          });

          return new Response(
            JSON.stringify({
              success: true,
              run_id: run.id,
              sources: results.map((r) => ({
                source: r.source,
                leads_found: r.leads.length,
                error: r.error,
              })),
              totals: {
                leads_found: totalLeads,
                estimates_created: estimatesCreated,
                emails_sent: emailsSent,
              },
              errors: allErrors.length > 0 ? allErrors : undefined,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (e) {
          if (e instanceof z.ZodError) {
            return new Response(JSON.stringify({ error: "Invalid input", details: e.errors }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          return mcpErrorResponse(e);
        }
      },

      /**
       * GET /api/mcp/leads/scrape — return recent scrape runs for this user
       */
      GET: async ({ request }) => {
        try {
          const context = await createMcpContext(request);
          const { userId, supabase } = context;
          assertMcpScope(context, "read");
          const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

          const { searchParams } = new URL(request.url);
          const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

          const { data, error } = await db
            .from("scrape_runs")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

          if (error) throw error;

          return new Response(JSON.stringify({ runs: data || [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return mcpErrorResponse(e);
        }
      },
    },
  },
});
