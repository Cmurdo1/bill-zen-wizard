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
        <p className="mt-2 text-sm text-muted-foreground">Last updated: August 12, 2026</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Honest Invoice (“we”, “us”) provides invoicing and estimating software for contractors,
          freelancers, and service businesses. This policy explains what we collect, why we collect
          it, how we protect it, and the choices you have. It applies to our website, app, and
          related services (together, the “Service”).
        </p>

        <Section title="1. Information we collect">
          <ul className="list-disc pl-5">
            <li>
              <strong>Account data</strong> — name, email address, password (stored securely by our
              identity provider), and company details you provide at signup.
            </li>
            <li>
              <strong>Business data</strong> — clients, invoices, estimates, job descriptions,
              uploaded photos, rate books, branding presets, and related documents you create or
              import. This may include names, email addresses, phone numbers, and billing
              information of your customers, which you provide to us on their behalf.
            </li>
            <li>
              <strong>Lead data</strong> — leads collected through the Lead Gen Engine (for example
              from Craigslist, Nextdoor, or Facebook), including contact details and post content,
              along with automated responses and email delivery/engagement records for those leads.
            </li>
            <li>
              <strong>Payment data</strong> — payments are processed by our payment processor,
              Stripe. We never receive or store card numbers. We store only the payment status and
              metadata Stripe returns to us.
            </li>
            <li>
              <strong>API and MCP usage</strong> — when you or your AI agents use the MCP server or
              REST API, we log the action taken (for example “estimate created” or “email sent”),
              the resource type, timestamps, and audit information, so you can review and revoke
              agent activity.
            </li>
            <li>
              <strong>Usage and technical data</strong> — IP address, browser and device
              information, pages viewed, and log data used for security, abuse prevention, and
              improving the Service.
            </li>
            <li>
              <strong>Email engagement data</strong> — for estimate emails sent through the Lead Gen
              Engine, we track whether the email was opened and whether links were clicked, so you
              can see how leads respond.
            </li>
          </ul>
        </Section>

        <Section title="2. How we use information">
          <ul className="list-disc pl-5">
            <li>To operate the Service: create, store, and send invoices and estimates.</li>
            <li>
              To power AI features: generate itemized line items, measurements, and assumptions from
              job descriptions and photos you submit.
            </li>
            <li>To process subscriptions and payments through Stripe.</li>
            <li>To send transactional email (invoices, estimates, confirmations).</li>
            <li>To prevent fraud and abuse, maintain security, and comply with law.</li>
            <li>To improve the product through aggregated, de-identified usage patterns.</li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> sell your personal information and do not share it for
            targeted advertising.
          </p>
        </Section>

        <Section title="3. AI features and data shared with AI providers">
          <p>
            When you use AI-powered estimating (Pro and Business plans), the job description,
            photos, and rate-book entries you provide are transmitted to third-party AI providers —
            currently OpenRouter and NVIDIA NIM — solely to generate your estimate. Their access is
            limited to processing your request; they are instructed not to use your content to train
            their models, and our provider agreements restrict use of your data to serving your
            requests. We retain AI-generated estimates as part of your business data.
          </p>
          <p className="mt-3">
            Do not include sensitive personal information (Social Security numbers, financial
            account numbers, health information) in job descriptions, photos, or AI prompts. AI
            output can be inaccurate; you are responsible for reviewing and correcting it before
            sending anything to a client.
          </p>
        </Section>

        <Section title="4. How we share information">
          <p>We share data only with processors that make the Service work:</p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Stripe</strong> (payments) — subscription billing and payment links. Your
              client pays Stripe directly; we never handle card data.
            </li>
            <li>
              <strong>Resend</strong> (transactional email) — delivering invoices, estimates, and
              lead responses.
            </li>
            <li>
              <strong>Supabase</strong> (infrastructure) — database, authentication, file storage,
              and hosting on cloud infrastructure.
            </li>
            <li>
              <strong>AI providers</strong> (OpenRouter, NVIDIA NIM) — generating AI estimates, as
              described in Section 3.
            </li>
          </ul>
          <p className="mt-3">
            We may also disclose information where required by law, legal process, or to protect the
            rights, property, or safety of our users or the public, and in connection with a merger,
            sale, or acquisition of our business.
          </p>
        </Section>

        <Section title="5. Cookies and similar technologies">
          <p>
            We use cookies and local storage where necessary to keep you signed in and to operate
            the Service. We do not use advertising cookies or third-party trackers for marketing.
            You can disable cookies in your browser, but some features may not work.
          </p>
        </Section>

        <Section title="6. Email tracking">
          <p>
            Estimate emails sent automatically to leads (Lead Gen Engine) include a small
            transparent tracking pixel and trackable links so you can see whether a lead opened your
            estimate or clicked a link. This data is used only to show you engagement inside the
            Lead Board and is not shared with third parties for advertising.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            Data is encrypted in transit (TLS) and at rest by our cloud infrastructure. Access to
            your data is scoped to your account via row-level security, and API keys are stored only
            as hashes and can be revoked at any time. We follow industry-standard secure development
            practices based on the OWASP Top 10. No method of transmission or storage is 100%
            secure, and we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="8. Retention">
          <p>
            We keep account and business data while your account is active, and for 30 days after
            you delete it (to cover backups), unless a longer period is required by law — for
            example, tax or record-keeping obligations that may apply to you. Audit logs for API
            activity are retained to support security and fraud prevention.
          </p>
        </Section>

        <Section title="9. Your rights and choices">
          <p>
            You may access, export, correct, or delete your data at any time from your account
            settings, or by emailing{" "}
            <a href="mailto:privacy@honestinvoice.com" className="underline">
              privacy@honestinvoice.com
            </a>
            . We will respond within the timeframes required by applicable law.
          </p>
          <p className="mt-3">
            If you are a California resident, the California Consumer Privacy Act (CCPA/CPRA) gives
            you the right to know the categories and specific pieces of personal information we
            collect, the right to delete, the right to correct inaccurate information, the right to
            opt out of the “sale” or “sharing” of personal information (we do not sell or share your
            information for targeted advertising, so there is nothing to opt out of), and the right
            not to receive discriminatory treatment for exercising these rights. You may exercise
            these rights yourself or through an authorized agent by emailing us at the address
            above. We will verify your identity before fulfilling a request.
          </p>
          <p className="mt-3">
            Residents of Virginia, Colorado, Connecticut, Utah, and other states with privacy laws
            may have similar rights, including access, deletion, correction, and — where applicable
            — the right to opt out of sales or targeted advertising (which we do not conduct).
          </p>
        </Section>

        <Section title="10. Children">
          <p>
            The Service is not directed to children under 16 and we do not knowingly collect
            personal information from children. If you believe a child has provided us personal
            information, contact us and we will delete it.
          </p>
        </Section>

        <Section title="11. International users">
          <p>
            The Service is hosted in the United States. If you use it from outside the U.S., your
            data will be transferred to and processed in the U.S. If you are in the European
            Economic Area, the UK, or Switzerland, we rely on appropriate safeguards for transfers
            and process your data as described here; you may contact us to exercise your rights
            under the GDPR.
          </p>
        </Section>

        <Section title="12. Changes to this policy">
          <p>
            We may update this policy as the Service evolves. Material changes will be posted here
            with an updated “Last updated” date, and we will notify you by email where required.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about this policy or your data? Email{" "}
            <a href="mailto:privacy@honestinvoice.com" className="underline">
              privacy@honestinvoice.com
            </a>
            .
          </p>
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
