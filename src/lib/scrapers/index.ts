/**
 * Lead scrapers for Craigslist, Nextdoor, and Facebook.
 *
 * Craigslist uses publicly available RSS feeds.
 * Nextdoor and Facebook have no public APIs — those scrapers are stubs that
 * return empty results until an integration is built using a third-party
 * scraping service or browser automation.
 */

export type ScrapedLead = {
  title: string;
  description: string;
  location: string;
  contact_email?: string;
  contact_phone?: string;
  budget_range?: string;
  source: "craigslist" | "nextdoor" | "facebook";
  source_url?: string;
};

export type ScrapeConfig = {
  sources: Array<"craigslist" | "nextdoor" | "facebook">;
  /** Craigslist city subdomain (e.g., "atlanta", "losangeles") */
  cl_city?: string;
  /** Craigslist category code (e.g., "hva", "egr", "skl", "bbb") */
  cl_category?: string;
  /** Comma-separated search keywords */
  keywords?: string;
  /** Max leads to return per source */
  max_per_source?: number;
};

/** Map of common Craigslist service categories */
const CL_CATEGORIES: Record<string, string> = {
  hva: "HVAC",
  egr: "Electrical",
  bbb: "Construction",
  skl: "Skilled trades",
  lbs: "Labor/move",
  hss: "Home services",
  trd: "Trades",
};

function categoryLabel(code: string): string {
  return CL_CATEGORIES[code] ?? code;
}

/**
 * Scrape Craigslist via its public RSS feed.
 *
 * RSS URL pattern:
 *   https://{city}.craigslist.org/search/{category}?format=rss&query={keywords}
 *
 * Note: Craigslist RSS feeds include a summary (description), title, link,
 * and date. Contact info (email/phone) is NOT exposed in RSS — we generate a
 * placeholder email from the post ID so the webhook can still create a lead
 * record. Users should follow up with the actual Craigslist relay email
 * after the estimate is created.
 */
export async function scrapeCraigslist(config: ScrapeConfig): Promise<ScrapedLead[]> {
  const city =
    config.cl_city && /^[a-z0-9-]{2,40}$/i.test(config.cl_city) ? config.cl_city : "atlanta";
  const category =
    config.cl_category && Object.prototype.hasOwnProperty.call(CL_CATEGORIES, config.cl_category)
      ? config.cl_category
      : "hva";
  const keywords = config.keywords ? `&query=${encodeURIComponent(config.keywords)}` : "";
  const maxResults = config.max_per_source || 10;

  const url = `https://${city}.craigslist.org/search/${category}?format=rss${keywords}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "HonestInvoice-MCP/1.0" },
    });

    if (!response.ok) {
      console.error(`Craigslist RSS returned ${response.status}`);
      return [];
    }

    const xml = await response.text();

    // Parse RSS XML using regex (no library needed for this simple case)
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const leads: ScrapedLead[] = [];

    for (const item of items.slice(0, maxResults)) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
      const linkMatch = item.match(/<link>(.*?)<\/link>/);

      if (!titleMatch) continue;

      const title = titleMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();

      const description = (descMatch?.[1] || title)
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim()
        .slice(0, 5000);

      const postUrl = linkMatch?.[1] || "";

      // Generate a placeholder relay email from the post URL
      const postId = postUrl.match(/(\d+)\.html/)?.[1] || Date.now().toString();
      const contactEmail = `${postId}@sale.craigslist.org`;

      leads.push({
        title,
        description,
        location: `${city}, ${categoryLabel(category)}`,
        contact_email: contactEmail,
        source: "craigslist",
        source_url: postUrl,
      });
    }

    return leads;
  } catch (e) {
    console.error("Craigslist scrape failed:", e);
    return [];
  }
}

/**
 * Nextdoor scraper — stub.
 *
 * Nextdoor has no public API. To scrape Nextdoor leads, you would need:
 * - A browser automation service (Puppeteer/Playwright)
 * - Or a third-party scraping API (ScrapingBee, Bright Data, etc.)
 * - Or Nextdoor's business API (not publicly available)
 *
 * This stub returns an empty array. Replace with a real implementation
 * when a scraping backend is available.
 */
export async function scrapeNextdoor(_config: ScrapeConfig): Promise<ScrapedLead[]> {
  // Stub — Nextdoor has no public API
  return [];
}

/**
 * Facebook Marketplace scraper — stub.
 *
 * Facebook Marketplace has no public API. To scrape Facebook leads:
 * - Use Facebook Graph API (requires app review)
 * - Or browser automation via a third-party service
 *
 * This stub returns an empty array.
 */
export async function scrapeFacebook(_config: ScrapeConfig): Promise<ScrapedLead[]> {
  // Stub — Facebook Marketplace has no public API
  return [];
}

const SCRAPE_FN: Record<string, (config: ScrapeConfig) => Promise<ScrapedLead[]>> = {
  craigslist: scrapeCraigslist,
  nextdoor: scrapeNextdoor,
  facebook: scrapeFacebook,
};

export async function runScrape(
  config: ScrapeConfig,
): Promise<{ source: string; leads: ScrapedLead[]; error?: string }[]> {
  const results = await Promise.all(
    config.sources.map(async (source) => {
      try {
        const fn = SCRAPE_FN[source];
        const leads = fn ? await fn(config) : [];
        return { source, leads };
      } catch (e) {
        return {
          source,
          leads: [] as ScrapedLead[],
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }),
  );

  return results;
}
