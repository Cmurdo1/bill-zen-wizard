import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

function getMcpAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const requestOrigin = new URL(request.url).origin;
  const configuredOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return origin === requestOrigin || configuredOrigins.includes(origin) ? origin : null;
}

function applySecurityHeaders(response: Response, request: Request): Response {
  // Defense in depth: HSTS, frame/clickjacking, MIME sniffing. Most of these
  // are also set at the Cloudflare edge, but we set them here so preview/dev
  // deployments and direct worker fetches are protected too.
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  if (!response.headers.has("Strict-Transport-Security")) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains; preload",
    );
  }
  // CSP is intentionally moderate to avoid breaking Supabase auth callbacks,
  // Google OAuth popups, Stripe checkout (loaded via the hosted Payment Link),
  // and the MCP / REST clients documented on /mcp.
  if (!response.headers.has("Content-Security-Policy")) {
    response.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        // Inline styles come from Tailwind v4 + component-level inline styles.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "script-src 'self' 'unsafe-inline' https://js.stripe.com https://static.cloudflareinsights.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        // Supabase + Stripe + Google OAuth + MCP webhook URLs must remain reachable.
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://buy.stripe.com https://accounts.google.com https://*.googleusercontent.com https://cloudflareinsights.com",
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://accounts.google.com",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self' https://accounts.google.com https://buy.stripe.com",
      ].join("; "),
    );
  }

  // Hosted MCP uses bearer credentials rather than cookies, so CORS can be
  // explicit without enabling credentialed cross-origin requests. Keep the
  // allowlist deployment-configured and never use a wildcard origin.
  if (new URL(request.url).pathname === "/api/mcp") {
    const allowedOrigin = getMcpAllowedOrigin(request);
    if (allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id",
      );
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      response.headers.append("Vary", "Origin");
    }
  }

  return response;
}

const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  const isMcpOptionsRequest =
    new URL(request.url).pathname === "/api/mcp" && request.method === "OPTIONS";
  if (isMcpOptionsRequest) {
    const origin = request.headers.get("Origin");
    const allowedOrigin = getMcpAllowedOrigin(request);
    if (origin && !allowedOrigin) {
      return applySecurityHeaders(
        new Response(JSON.stringify({ error: "Origin is not allowed" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
        request,
      );
    }
    return applySecurityHeaders(new Response(null, { status: 204 }), request);
  }

  const result = await next();
  applySecurityHeaders(result.response, request);
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware],
}));
