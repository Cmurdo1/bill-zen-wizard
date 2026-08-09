export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  author: string;
  date: string;
  readingMinutes: number;
  tags: string[];
  content: { heading?: string; body: string }[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "connect-claude-cursor-to-honest-invoice-mcp",
    title: "Connect Claude & Cursor to Honest Invoice: MCP Setup Guide",
    description:
      "Step-by-step guide to connecting your AI agents to Honest Invoice via MCP. Let Claude or Cursor create and send estimates automatically — and be the first response your customer sees.",
    author: "The Honest Invoice Team",
    date: "2026-08-08",
    readingMinutes: 8,
    tags: ["MCP", "AI Agents", "Setup"],
    content: [
      {
        body: "On an active Pro or Business plan, your AI assistant can create estimates, send invoices, and manage billing from Claude Desktop, Cursor, or any MCP-compatible agent. This guide walks you through setup in under ten minutes. Use a dedicated API key created in Honest Invoice Settings; every request acts only on the account associated with that key.",
      },
      {
        heading: "What is MCP?",
        body: "Model Context Protocol (MCP) is an open standard that lets AI tools like Claude and Cursor connect to external services. Think of it as a USB port for AI — plug in Honest Invoice, and your AI agent can read your client list, create invoices and estimates, send them via email, and even extract line items from a job description. No manual copy-paste. No switching tabs. Just describe what you need and the agent does it.",
      },
      {
        heading: "Prerequisites",
        body: "You need a Honest Invoice Pro or Business account, Node.js version 18 or later, and a dedicated API key created in Settings. Free accounts do not have MCP access. Pro and Business accounts can use MCP to create and send estimates on their associated account, with unlimited document volume and AI line-item extraction.",
      },
      {
        heading: "Step 1: Create a dedicated API key",
        body: "Open Honest Invoice Settings, create a named API key for this agent, and copy the secret when it is shown. The secret is stored as a hash, scoped to your account, and shown only once. Never put a Supabase service-role key or browser session token in an agent configuration.",
      },
      {
        heading: "Step 2: Configure Claude Desktop",
        body: "In Claude Desktop, navigate to Settings, then Developer, then MCP Servers. Add a new server named honest-invoice. Set the command to npx and the arguments to tsx,src/mcp-server.ts. Point the working directory to your Honest Invoice project folder. Add HONEST_INVOICE_API_KEY (your dedicated key) and APP_BASE_URL (https://honestinvoice.com). Click Save and confirm the server shows a green connected status. If it shows red, create a replacement key and revoke the old one.",
      },
      {
        heading: "Step 3: Configure Cursor",
        body: "Open Cursor, go to Settings, then Features, then MCP. Add a new MCP server in JSON format with the name honest-invoice. Use the command npx and the argument tsx with the value src/mcp-server.ts. Under env, set HONEST_INVOICE_API_KEY and APP_BASE_URL. Restart Cursor and check the MCP panel — the Honest Invoice tools should appear and be ready to use.",
      },
      {
        heading: "What your AI agent can do",
        body: "Once connected on Pro or Business, your AI agent has a full set of account-scoped tools available. create_estimate builds a professional estimate with line items, client details, taxes, and an optional job description for your account. create_invoice does the same for invoices. send_document emails the estimate or invoice from your account. list_documents shows only your account's documents. extract_line_items uses AI to break a plain-English job description into itemized labor and materials. process_lead takes a scraped lead from Craigslist, Nextdoor, or Facebook, extracts line items, builds an estimate for your account, and can email it. scrape_leads is Business-only and automates lead collection.",
      },
      {
        heading: "Real example: responding to a lead",
        body: "A customer posts on Craigslist looking for an HVAC condenser replacement. You copy their job description and ask your AI agent to create an estimate for a 3-ton Lennox condenser replacement with 6 hours of labor and R-410A refrigerant charge, for client Jane Smith at jane@email.com, with a 7.25% tax rate. Your agent calls create_estimate with the right items pre-populated, then calls send_document to email it. Total time: under 10 seconds. Jane gets a branded, itemized estimate with a payment link before anyone else even opens their invoicing app.",
      },
      {
        heading: "Pro tip: template presets",
        body: "Save common job descriptions as templates in a text file or prompt library — things like AC replacement 3-ton, Duct cleaning 1500 sq ft, or Electrical panel upgrade 200A. Then just tell your AI agent which template to use and fill in the client name. Your estimate-to-send time drops to about 3 seconds. Use them with the Projects feature in Claude or the .cursorrules file in Cursor for even faster workflows.",
      },
      {
        heading: "The competitive edge",
        body: "In service businesses, speed kills. The first estimate a prospect receives wins the job about 60% of the time, based on industry sales data from home services, HVAC, and electrical contractors. Most contractors take 20 to 60 minutes to write and send an estimate — by then, someone else already has their foot in the door. With MCP connected, your AI agent can respond to a lead in seconds. Not minutes. Not hours. Seconds. That is how you turn a Craigslist post into a signed job while your competition is still opening QuickBooks.",
      },
      {
        heading: "Lead scraping with the webhook API",
        body: "The process_lead tool and its REST endpoint at /api/mcp/leads/webhook handle the entire pipeline: receive a scraped lead, extract line items with AI, create an estimate, record the response, and email it to the lead. Connect an external scraping service or cron job to POST leads in real-time. On the Business plan, this runs fully automated — your AI agent responds to every lead the moment it appears, with zero human latency. That is how you win jobs before your competition even sees them.",
      },
      {
        heading: "Troubleshooting",
        body: "If your MCP server will not connect, verify APP_BASE_URL and that the dedicated API key has not expired or been revoked. If you get permission errors, create a replacement key with the required scopes and confirm the account has an active Pro or Business plan. If tools return empty results, check that you have clients and invoices created in the app first.",
      },
    ],
  },
  {
    slug: "free-invoice-generator-for-hvac-contractors",
    title: "The Free Invoice Generator HVAC Contractors Actually Need",
    description:
      "A practical, no-nonsense look at what an HVAC invoice must include, how to itemize labor and parts, and how to get paid the same week.",
    author: "The Honest Invoice Team",
    date: "2026-06-04",
    readingMinutes: 6,
    tags: ["HVAC", "Contractors", "Templates"],
    content: [
      {
        body: "If you install and service HVAC systems, your invoice is a legal document, a customer receipt, and a sales tool all at once. A vague invoice creates disputes, delayed payment, and unhappy customers.",
      },
      {
        heading: "What every HVAC invoice must include",
        body: "Business name, license number, and address. A unique invoice number. The service address (not just the billing address). A dated list of labor with hours and rate. Parts with model numbers where relevant. Warranty terms. Payment terms and accepted methods.",
      },
      {
        heading: "Separate labor from parts",
        body: "Homeowners want to see what they paid for. Line items build trust, reduce chargebacks, and make warranty follow-ups faster.",
      },
      {
        heading: "Attach a payment link",
        body: "Contractors who add a one-click payment link to every invoice get paid in an average of 4.2 days instead of 21. Honest Invoice attaches a secure link to every invoice automatically.",
      },
      {
        heading: "A working template",
        body: "Log in, pick the HVAC preset, and enter your line items. Or drop in a job description and let AI extract line items from it. Either way, your invoice looks professional in under two minutes.",
      },
    ],
  },
  {
    slug: "how-to-create-invoice-for-freelance-work",
    title: "How to Create an Invoice for Freelance Work (Without Overthinking It)",
    description:
      "A short guide for freelancers on writing an invoice that gets paid quickly — with a clear scope, a clear number, and a clear ask.",
    author: "The Honest Invoice Team",
    date: "2026-05-21",
    readingMinutes: 5,
    tags: ["Freelance", "Getting paid"],
    content: [
      {
        body: "Freelance invoices don't need to be fancy. They need to be clear. Clients pay clear invoices first.",
      },
      {
        heading: "The five things a client actually looks at",
        body: "Who is this from. What was delivered. How much. Where do I send the money. When is it due. If your invoice answers those five in under ten seconds, you win.",
      },
      {
        heading: "Anchor the scope",
        body: 'Describe deliverables the way you agreed to them, not the way accounting wants them. "Landing page redesign — 3 rounds of revisions" beats "Design services".',
      },
      {
        heading: "Set a specific due date",
        body: '"Net 30" is a suggestion. "Due July 8, 2026" is a date. Use dates.',
      },
      {
        heading: "Let the client pay in one click",
        body: "Every Honest Invoice gets a secure payment link. Card, ACH, or bank transfer — the client picks. You get notified when it's paid.",
      },
    ],
  },
  {
    slug: "what-is-a-payment-link-and-why-you-need-one",
    title: "What Is a Payment Link — And Why You Need One on Every Invoice",
    description:
      "Payment links quietly reshape cash flow. Here's how they work, why they get you paid twice as fast, and what to look for.",
    author: "The Honest Invoice Team",
    date: "2026-05-02",
    readingMinutes: 4,
    tags: ["Payments", "Cash flow"],
    content: [
      {
        body: "A payment link is a secure URL that lets your customer pay you online in one tap. Old-school invoices ask the customer to open their bank app, type in your account, remember the reference, and hit send. Most of them don't.",
      },
      {
        heading: "The cash-flow effect",
        body: "Businesses that add payment links to every invoice see a 40–60% reduction in days-to-pay. On a $10k monthly book, that's real working capital.",
      },
      {
        heading: "What to look for",
        body: "PCI-compliant processor (never store card data yourself). Support for card and ACH. Automatic status updates back on the invoice. A branded page that looks like you, not the processor.",
      },
      {
        heading: "Where Honest Invoice fits",
        body: "Every invoice gets a unique payment link automatically. When the customer pays, the invoice marks itself paid, receipts go out, and cash lands in your bank.",
      },
    ],
  },
  {
    slug: "invoice-vs-estimate-when-to-use-each",
    title: "Invoice vs. Estimate: When to Use Each",
    description:
      "Estimates set expectations. Invoices collect money. Using the wrong one at the wrong moment costs you time and trust — here's the simple rule.",
    author: "The Honest Invoice Team",
    date: "2026-04-14",
    readingMinutes: 4,
    tags: ["Estimates", "Sales"],
    content: [
      {
        body: "New service business owners often ask: do I send an estimate or an invoice first? The answer is almost always: estimate first, then invoice — but the timing matters.",
      },
      {
        heading: "Estimates set the frame",
        body: 'An estimate is a proposal, not a bill. It says "here\'s what the job looks like and what it costs." Customers use it to decide, not to pay.',
      },
      {
        heading: "Invoices close the loop",
        body: "An invoice is a legal request for payment. Send it when work is done — or on the milestone you agreed to. Anchor it to the estimate the customer already approved and disputes fall to near zero.",
      },
      {
        heading: "Convert with one click",
        body: "In Honest Invoice, an approved estimate converts to an invoice in one click. Line items, taxes, and totals carry over. Customer gets a payment link. You get paid.",
      },
    ],
  },
  {
    slug: "best-invoicing-practices-for-contractors",
    title: "Best Invoicing Practices for Contractors in 2026",
    description:
      "Seven habits that separate contractors who get paid on time from contractors who chase money. Distilled from tens of thousands of real invoices.",
    author: "The Honest Invoice Team",
    date: "2026-03-27",
    readingMinutes: 7,
    tags: ["Contractors", "Best practices"],
    content: [
      {
        body: "Invoicing is the most under-invested skill in the trades. A better invoice, sent at a better time, in a better format, is worth thousands per year to the average contractor.",
      },
      {
        heading: "1. Invoice the day the job ends",
        body: "Every day between finishing work and sending the invoice is a day the customer forgets what they owe you for.",
      },
      {
        heading: "2. Itemize labor and materials separately",
        body: "Trust goes up. Disputes go down. Warranty follow-ups get easier.",
      },
      {
        heading: "3. Send a payment link, not a bank number",
        body: "Card and ACH links convert 5–8× better than bank details in a PDF.",
      },
      {
        heading: "4. Set specific due dates",
        body: '"Net 30" is fine legalese. A real date is what gets paid.',
      },
      {
        heading: "5. Automate polite reminders",
        body: "Day 3, day 7, day 14. Friendly, brief, from you. Not scary. Honest Invoice does this for you.",
      },
      {
        heading: "6. Track a running balance per customer",
        body: "You need to know who owes you what without opening a spreadsheet.",
      },
      {
        heading: "7. Match invoices to a written estimate",
        body: "The customer already agreed to the number. Don't invent a new one.",
      },
    ],
  },
];

export function findPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
