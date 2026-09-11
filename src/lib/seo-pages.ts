import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/shell";

export const SITE_URL = "https://honestinvoice.com";
export const SITE_NAME = "Honest Invoice";

export type SeoPageConfig = {
  path: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  intro: string;
  workflow: string;
  audience: string;
  examples: string[];
  benefits: string[];
  faq: { q: string; a: string }[];
};

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path === "/" ? "/" : path}`;
}

export function seoHead(config: SeoPageConfig) {
  const url = absoluteUrl(config.path);
  return {
    meta: [
      { title: config.title },
      { name: "description", content: config.description },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: config.title },
      { property: "og:description", content: config.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: `${SITE_URL}/og.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: config.title },
      { name: "twitter:description", content: config.description },
      { name: "twitter:image", content: `${SITE_URL}/og.png` },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify([
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: config.h1,
                item: url,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: config.faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: SITE_NAME,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            url: SITE_URL,
            description: config.description,
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              url: `${SITE_URL}/pricing`,
            },
          },
        ]),
      },
    ],
  };
}
