import { defineConfig, loadEnv } from "vite";
import path from "node:path";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Load all env vars (including non-VITE_ server secrets) into process.env for
// server routes. These are NOT exposed to the client bundle.
const serverEnv = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig(({ command }) => ({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
    viteReact(),
    // Bundle the server with Nitro, defaulting to the Cloudflare Workers preset.
    // Security headers applied to every response (OWASP Secure Headers Project,
    // NIST SP 800-53 SC-7/SC-8). CSP is shipped report-only first so violations
    // can be observed in the browser console before it is enforced — verify with
    // a staging pass, then move the policy to Content-Security-Policy.
    ...(command === "build"
      ? [
          nitro({
            defaultPreset: "cloudflare-module",
            routeRules: {
              "/**": {
                headers: {
                  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
                  "X-Content-Type-Options": "nosniff",
                  "X-Frame-Options": "DENY",
                  "Referrer-Policy": "strict-origin-when-cross-origin",
                  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
                  "Content-Security-Policy-Report-Only":
                    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
                },
              },
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "entities/lib/decode.js": path.resolve(process.cwd(), "node_modules/entities/lib/decode.js"),
      "entities/lib/encode.js": path.resolve(process.cwd(), "node_modules/entities/lib/encode.js"),
      entities: path.resolve(process.cwd(), "node_modules/entities"),
    },
  },
}));
