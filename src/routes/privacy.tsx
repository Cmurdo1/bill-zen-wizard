import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Honest Invoice" },
      {
        name: "description",
        content: "How Honest Invoice collects, uses, and protects your data.",
      },
      { property: "og:title", content: "Privacy Policy — Honest Invoice" },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="container-page max-w-3xl py-16">
        <h1 className="font-display text-4xl tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: July 8, 2026</p>
        <Section title="1. Introduction">
          Honest Invoice (“we”, “us”) provides invoicing and estimating software for contractors,
          freelancers, and service businesses. This policy explains what we collect, why we collect
          it, how we protect it, and the choices you have.
        </Section>
        <Section title="2. Data we collect">
          <ul className="list-disc pl-5">
            <li>
              <strong>Account data</strong> — name, email, company details you provide at signup.
            </li>
            <li>
              <strong>Business data</strong> — clients, invoices, estimates, and related documents
              you create.
            </li>
            <li>
              <strong>Payment data</strong> — handled by our payment processor (Stripe). We never
              store card numbers.
            </li>
            <li>
              <strong>Usage data</strong> — logs, IP address, browser, and pages viewed for security
              and analytics.
            </li>
          </ul>
        </Section>
        <Section title="3. How we use data">
          To operate the service, process payments, send transactional email, prevent abuse, comply
          with law, and improve the product. We do not sell your data.
        </Section>
        <Section title="4. Sharing">
          We share data only with processors that make the product work: Stripe (payments), Resend
          (email), and our infrastructure provider. Each is contractually bound to protect your
          data.
        </Section>
        <Section title="5. Security">
          Data is encrypted in transit (TLS 1.3) and at rest (AES-256). Access is scoped per user
          via row-level security. We follow industry best practices from OWASP Top 10 and SOC 2.
        </Section>
        <Section title="6. Your rights">
          You may export or delete your data at any time from your account settings, or by emailing
          privacy@honestinvoice.com. We honor GDPR and CCPA rights.
        </Section>
        <Section title="7. Retention">
          We keep account data while your account is active and for 30 days after deletion for
          backups, unless a longer period is required by law.
        </Section>
        <Section title="8. Contact">
          Questions? Email{" "}
          <a href="mailto:privacy@honestinvoice.com" className="underline">
            privacy@honestinvoice.com
          </a>
          .
        </Section>
      </article>
    </MarketingShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground [&>ul]:mt-2 [&_a]:text-primary">
        {children}
      </div>
    </section>
  );
}
