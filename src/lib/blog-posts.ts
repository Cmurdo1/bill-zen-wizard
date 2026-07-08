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
    slug: "free-invoice-generator-for-hvac-contractors",
    title: "The Free Invoice Generator HVAC Contractors Actually Need",
    description:
      "A practical, no-nonsense look at what an HVAC invoice must include, how to itemize labor and parts, and how to get paid the same week.",
    author: "The Honest Invoice Team",
    date: "2026-06-04",
    readingMinutes: 6,
    tags: ["HVAC", "Contractors", "Templates"],
    content: [
      { body: "If you install and service HVAC systems, your invoice is a legal document, a customer receipt, and a sales tool all at once. A vague invoice creates disputes, delayed payment, and unhappy customers." },
      { heading: "What every HVAC invoice must include", body: "Business name, license number, and address. A unique invoice number. The service address (not just the billing address). A dated list of labor with hours and rate. Parts with model numbers where relevant. Warranty terms. Payment terms and accepted methods." },
      { heading: "Separate labor from parts", body: "Homeowners want to see what they paid for. Line items build trust, reduce chargebacks, and make warranty follow-ups faster." },
      { heading: "Attach a payment link", body: "Contractors who add a one-click payment link to every invoice get paid in an average of 4.2 days instead of 21. Honest Invoice attaches a secure link to every invoice automatically." },
      { heading: "A working template", body: "Log in, pick the HVAC preset, and enter your line items. Or drop in a job description and let AI extract line items from it. Either way, your invoice looks professional in under two minutes." },
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
      { body: "Freelance invoices don't need to be fancy. They need to be clear. Clients pay clear invoices first." },
      { heading: "The five things a client actually looks at", body: "Who is this from. What was delivered. How much. Where do I send the money. When is it due. If your invoice answers those five in under ten seconds, you win." },
      { heading: "Anchor the scope", body: "Describe deliverables the way you agreed to them, not the way accounting wants them. \"Landing page redesign — 3 rounds of revisions\" beats \"Design services\"." },
      { heading: "Set a specific due date", body: "\"Net 30\" is a suggestion. \"Due July 8, 2026\" is a date. Use dates." },
      { heading: "Let the client pay in one click", body: "Every Honest Invoice gets a secure payment link. Card, ACH, or bank transfer — the client picks. You get notified when it's paid." },
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
      { body: "A payment link is a secure URL that lets your customer pay you online in one tap. Old-school invoices ask the customer to open their bank app, type in your account, remember the reference, and hit send. Most of them don't." },
      { heading: "The cash-flow effect", body: "Businesses that add payment links to every invoice see a 40–60% reduction in days-to-pay. On a $10k monthly book, that's real working capital." },
      { heading: "What to look for", body: "PCI-compliant processor (never store card data yourself). Support for card and ACH. Automatic status updates back on the invoice. A branded page that looks like you, not the processor." },
      { heading: "Where Honest Invoice fits", body: "Every invoice gets a unique payment link automatically. When the customer pays, the invoice marks itself paid, receipts go out, and cash lands in your bank." },
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
      { body: "New service business owners often ask: do I send an estimate or an invoice first? The answer is almost always: estimate first, then invoice — but the timing matters." },
      { heading: "Estimates set the frame", body: "An estimate is a proposal, not a bill. It says \"here's what the job looks like and what it costs.\" Customers use it to decide, not to pay." },
      { heading: "Invoices close the loop", body: "An invoice is a legal request for payment. Send it when work is done — or on the milestone you agreed to. Anchor it to the estimate the customer already approved and disputes fall to near zero." },
      { heading: "Convert with one click", body: "In Honest Invoice, an approved estimate converts to an invoice in one click. Line items, taxes, and totals carry over. Customer gets a payment link. You get paid." },
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
      { body: "Invoicing is the most under-invested skill in the trades. A better invoice, sent at a better time, in a better format, is worth thousands per year to the average contractor." },
      { heading: "1. Invoice the day the job ends", body: "Every day between finishing work and sending the invoice is a day the customer forgets what they owe you for." },
      { heading: "2. Itemize labor and materials separately", body: "Trust goes up. Disputes go down. Warranty follow-ups get easier." },
      { heading: "3. Send a payment link, not a bank number", body: "Card and ACH links convert 5–8× better than bank details in a PDF." },
      { heading: "4. Set specific due dates", body: "\"Net 30\" is fine legalese. A real date is what gets paid." },
      { heading: "5. Automate polite reminders", body: "Day 3, day 7, day 14. Friendly, brief, from you. Not scary. Honest Invoice does this for you." },
      { heading: "6. Track a running balance per customer", body: "You need to know who owes you what without opening a spreadsheet." },
      { heading: "7. Match invoices to a written estimate", body: "The customer already agreed to the number. Don't invent a new one." },
    ],
  },
];

export function findPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
