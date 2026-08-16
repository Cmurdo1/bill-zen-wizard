import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Honest Invoice" },
      { name: "description", content: "The terms and conditions for using Honest Invoice." },
      { property: "og:title", content: "Terms of Service — Honest Invoice" },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <MarketingShell>
      <article className="container-page max-w-3xl py-16">
        <h1 className="font-display text-4xl tracking-tight text-foreground">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: August 12, 2026</p>
        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-8">
            <h2 className="text-xl font-semibold text-foreground">{s.title}</h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground [&>ul]:list-disc [&>ul]:pl-5 [&_a]:text-primary">
              {s.body.map((part, i) =>
                typeof part === "string" ? (
                  <p key={i}>{part}</p>
                ) : (
                  <ul key={i}>
                    {part.map((li, j) => (
                      <li key={j}>{li}</li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}
      </article>
    </MarketingShell>
  );
}

type Section = { title: string; body: Array<string | string[]> };

const SECTIONS: Section[] = [
  {
    title: "1. Agreement and acceptance",
    body: [
      "By creating an account or using Honest Invoice (“the Service”), you agree to these Terms of Service (“Terms”). If you use the Service on behalf of a business or other entity, you represent that you have authority to bind that entity, and “you” means the entity.",
      "You must be at least 18 years old to use the Service.",
      [
        "Electronic communications: By using the Service, you consent to receive electronic communications from us — including invoices, estimates, confirmations, and administrative notices — and you agree that electronic records satisfy any legal requirement that communications be in writing. Invoices and estimates you create and send are electronic records under the federal E-SIGN Act and applicable state UETA laws.",
      ],
    ],
  },
  {
    title: "2. The Service",
    body: [
      "Honest Invoice provides invoicing and estimating tools, AI-assisted line-item generation, payment links processed by Stripe, a Lead Gen Engine, and an MCP/API server for AI agents. We may improve, add, or remove features over time, and may update plan pricing with notice as described below.",
    ],
  },
  {
    title: "3. Your account",
    body: [
      "You are responsible for keeping your credentials secure and for all activity under your account. Notify us promptly of any unauthorized use. API keys issued to you are secrets: store them securely, never expose them in client-side code, and revoke any key you believe may have been compromised.",
    ],
  },
  {
    title: "4. Subscriptions, billing, and auto-renewal",
    body: [
      "Free plans are free, subject to plan limits (for example, 5 invoices per month). Paid plans (Pro and Business) are billed monthly in advance by Stripe and renew automatically until canceled.",
      [
        "By subscribing you authorize us to charge your payment method on a recurring basis for each renewal period.",
        "You can cancel at any time online — for example through the cancellation link on your Stripe receipt or from your account — and you will continue to have access through the end of the period you already paid for.",
        "Fees are non-refundable except where required by law. If you believe you were charged in error, contact us and we will investigate.",
        "Prices are in U.S. dollars and do not include taxes, which are added where applicable.",
        "We may change prices or introduce new fees for future periods with at least 30 days’ notice, and you may cancel before the change takes effect.",
      ],
    ],
  },
  {
    title: "5. Payments and payment links",
    body: [
      "Payment links on your invoices are processed by Stripe, and payments you receive from your clients are governed by Stripe’s terms of service. We do not take a percentage of payments you collect. You are responsible for your own billing practices, including any terms you offer your clients, refunds you choose to give, and compliance with applicable consumer protection laws.",
    ],
  },
  {
    title: "6. AI features",
    body: [
      "AI-powered features generate suggested line items, measurements, and assumptions from information you provide. AI output can be incorrect, incomplete, or outdated, and is not professional advice. You are responsible for reviewing, correcting, and confirming all AI-generated content before using or sending it, and for the accuracy of everything you send to clients.",
      "Do not submit sensitive personal information to AI features. We are not responsible for errors, omissions, or damages arising from your reliance on AI output.",
    ],
  },
  {
    title: "7. Not legal, tax, or accounting advice",
    body: [
      "The Service is a tool; it is not legal, tax, accounting, or licensing advice. You are responsible for complying with all laws applicable to your business, including: sales and use tax obligations; income and information reporting (such as Form 1099-NEC); state and local contractor licensing; and displaying any license numbers, tax IDs, or other information required on your invoices or estimates in your jurisdiction. Many states require licensed contractors to show their license number on invoices and estimates — check your state’s rules.",
    ],
  },
  {
    title: "8. Your content and license",
    body: [
      "You own your content. You grant us a limited, non-exclusive license to store, process, and transmit your content as needed to operate the Service, including sending your documents to clients and processing AI requests on your behalf. We do not use your content for purposes other than operating the Service.",
    ],
  },
  {
    title: "9. Acceptable use",
    body: [
      "You agree not to misuse the Service, including:",
      [
        "Sending fraudulent, deceptive, or unlawful documents;",
        "Emailing or texting people without required consent, or engaging in spamming — you are responsible for complying with the CAN-SPAM Act and similar laws for any communications you send, and transactional invoices and estimates should not include unrelated marketing content;",
        "Harassing, defaming, or infringing the rights of others;",
        "Scraping or collecting data in violation of third-party websites’ terms;",
        "Attempting to access another user’s data, or bypassing security or plan limits.",
      ],
      "We may suspend or terminate accounts that violate these Terms.",
    ],
  },
  {
    title: "10. Third-party services",
    body: [
      "The Service relies on third-party providers, including Stripe (payments), Resend (email), Supabase (hosting and infrastructure), and AI providers. Their services are subject to their own terms and privacy policies. We are not liable for the acts or omissions of these providers, and any claims relating to them are governed by their terms.",
    ],
  },
  {
    title: "11. Intellectual property",
    body: [
      "The Service, including its software, design, and trademarks, is owned by us or our licensors and is protected by intellectual property laws. You may not copy, modify, distribute, or reverse engineer it. If you provide feedback or feature suggestions, you grant us a perpetual, royalty-free license to use them to improve the Service.",
    ],
  },
  {
    title: "12. Disclaimers",
    body: [
      "The Service is provided “as is” and “as available,” without warranties of any kind, express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or that AI output will be accurate. We do not guarantee payment or collection of any invoice.",
    ],
  },
  {
    title: "13. Limitation of liability",
    body: [
      "To the maximum extent permitted by law, our aggregate liability arising out of or relating to these Terms or the Service is limited to the greater of $100 or the amounts you paid us in the 12 months preceding the claim. In no event will we be liable for indirect, incidental, special, consequential, or punitive damages, or lost profits or data, even if advised of the possibility.",
    ],
  },
  {
    title: "14. Indemnification",
    body: [
      "You agree to indemnify and hold us harmless from claims, damages, and costs (including reasonable attorneys’ fees) arising from your use of the Service, your content, or your violation of these Terms or applicable law.",
    ],
  },
  {
    title: "15. Termination",
    body: [
      "You can cancel or delete your account at any time. We may terminate or suspend your access for violation of these Terms, fraudulent or abusive activity, or as required by law. On termination, you may export your data for 30 days, after which we will delete it as described in our Privacy Policy.",
    ],
  },
  {
    title: "16. Changes to these Terms",
    body: [
      "We may update these Terms from time to time. Material changes will be posted on this page with an updated “Last updated” date and, where feasible, notified by email at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance.",
    ],
  },
  {
    title: "17. Governing law and disputes",
    body: [
      "These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law rules. Before filing any claim, you agree to contact us and attempt to resolve the dispute informally for 30 days. Any unresolved disputes will be brought exclusively in the state or federal courts located in Delaware, and you consent to their jurisdiction. You agree to resolve disputes on an individual basis and waive class or collective proceedings to the maximum extent permitted by law.",
    ],
  },
  {
    title: "18. General",
    body: [
      "If any provision of these Terms is held unenforceable, the remaining provisions remain in effect. Our failure to enforce a provision is not a waiver. We are not liable for delays or failures caused by events beyond our reasonable control. These Terms are the entire agreement between you and us regarding the Service.",
    ],
  },
  {
    title: "19. Contact",
    body: ["Questions about these Terms? Email support@honestinvoice.com."],
  },
];
