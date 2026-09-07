import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { BLOG_POSTS } from "@/lib/blog-posts";

const BASE_URL = "https://honestinvoice.com";
const SEO_PATHS = [
  "/invoice-software-for-contractors",
  "/invoice-software-for-freelancers",
  "/invoice-software-for-small-business",
  "/invoice-software/hvac",
  "/invoice-software/plumbers",
  "/invoice-software/electricians",
  "/invoice-software/landscapers",
  "/invoice-software/cleaners",
  "/free-invoice-generator",
  "/contractor-invoice-generator",
  "/free-estimate-generator",
] as const;

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: { path: string; priority: string; lastmod?: string }[] = [
          { path: "/", priority: "1.0" },
          { path: "/pricing", priority: "0.9" },
          { path: "/mcp", priority: "0.7" },
          { path: "/blog", priority: "0.8" },
          ...SEO_PATHS.map((path) => ({ path, priority: "0.8" })),
          { path: "/pay-invoice", priority: "0.5" },
          { path: "/pitch", priority: "0.4" },
          { path: "/privacy", priority: "0.2" },
          { path: "/terms", priority: "0.2" },
          ...BLOG_POSTS.map((p) => ({ path: `/blog/${p.slug}`, priority: "0.7", lastmod: p.date })),
        ];
        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            `    <priority>${e.priority}</priority>`,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        });
      },
    },
  },
});
