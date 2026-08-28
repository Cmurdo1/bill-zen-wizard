import { createFileRoute } from "@tanstack/react-router";


/**
 * GET /api/mcp/leads/track
 *
 * Email tracking endpoint. Called automatically when a recipient opens an
 * email (via a 1×1 tracking pixel) or clicks a link (via a redirect wrapper).
 *
 * Query params:
 *   t   — event type: "open" or "click"
 *   tid — the unique tracking_id embedded in the email
 *   url — (click only) the destination URL to redirect to
 *
 * The response is either a 1×1 transparent GIF (for opens) or a 302 redirect
 * to the original URL (for clicks). Both are served immediately; recording
 * happens fire-and-forget in the background.
 */

// 1×1 transparent GIF (43 bytes, the smallest valid GIF)
const PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export const Route = createFileRoute("/api/mcp/leads/track")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const eventType = url.searchParams.get("t");
        const trackingId = url.searchParams.get("tid");
        const requestedRedirectUrl = url.searchParams.get("url");
        const configuredBaseUrl = (
          process.env.APP_URL ||
          process.env.APP_BASE_URL ||
          "https://honestinvoice.com"
        ).replace(/\/+$/, "");
        let redirectUrl: string | null = null;
        if (requestedRedirectUrl) {
          try {
            const requested = new URL(requestedRedirectUrl);
            const allowedOrigin = new URL(configuredBaseUrl).origin;
            if (
              requested.origin === allowedOrigin &&
              ["http:", "https:"].includes(requested.protocol)
            ) {
              redirectUrl = requested.toString();
            }
          } catch {
            redirectUrl = null;
          }
        }

        // Validate required params
        if (!trackingId || !eventType || !["open", "click"].includes(eventType)) {
          // Still return a valid response — don't break the email client
          if (eventType === "click" && redirectUrl) {
            return new Response(null, {
              status: 302,
              headers: { Location: redirectUrl },
            });
          }
          return new Response(PIXEL_GIF, {
            status: 200,
            headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache" },
          });
        }

        // Record the event in the background (fire-and-forget to not slow response)
        const recordPromise = (async () => {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const db = supabaseAdmin as any; // eslint-disable-line

            // Find the lead_response by tracking_id
            const { data: lr } = await db
              .from("lead_responses")
              .select("id, status")
              .eq("tracking_id", trackingId)
              .maybeSingle();

            if (!lr) return; // Unknown tracking ID — silently ignore

            const leadResponseId = lr.id;

            // Deduplicate: only record first open, first click
            const { data: existing } = await db
              .from("email_tracking")
              .select("id")
              .eq("tracking_id", trackingId)
              .eq("event_type", eventType)
              .maybeSingle();

            if (existing) return; // Already recorded — skip

            // Extract client metadata from headers
            const userAgent = request.headers.get("user-agent") || null;
            const ipAddress =
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              request.headers.get("x-real-ip") ||
              null;

            // Insert tracking event
            await db.from("email_tracking").insert({
              lead_response_id: leadResponseId,
              tracking_id: trackingId,
              event_type: eventType,
              url: eventType === "click" ? redirectUrl : null,
              user_agent: userAgent,
              ip_address: ipAddress,
            });

            // Update lead_response status progression
            if (eventType === "open" && lr.status === "estimate_sent") {
              await db
                .from("lead_responses")
                .update({ status: "opened", opened_at: new Date().toISOString() })
                .eq("id", leadResponseId);
            } else if (eventType === "click") {
              await db
                .from("lead_responses")
                .update({
                  status: "clicked",
                  clicked_at: new Date().toISOString(),
                  ...(lr.status === "estimate_sent" ? { opened_at: new Date().toISOString() } : {}),
                })
                .eq("id", leadResponseId);
            }
          } catch {
            // Silently ignore tracking errors — never break email rendering
          }
        })();

        // For click events, redirect immediately; for opens, return pixel
        if (eventType === "click" && redirectUrl) {
          // Fire-and-forget recording, don't await
          recordPromise.catch(() => {});
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl },
          });
        }

        // Open event: return tracking pixel
        recordPromise.catch(() => {});
        return new Response(PIXEL_GIF, {
          status: 200,
          headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
      },
    },
  },
});
