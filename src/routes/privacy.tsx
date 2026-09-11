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
      { property: "og:url", content: "https://honestinvoice.com/privacy" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Privacy Policy — Honest Invoice" },
      {
        name: "twitter:description",
        content: "Honest Invoice — simple, transparent invoicing for service businesses.",
      },
    ],
    links: [{ rel: "canonical", href: "https://honestinvoice.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="container-page max-w-3xl py-16">
        <h1 className="font-display text-4xl tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: September 10, 2026</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Honest Invoice ("we", "us", "our", or "Company") provides invoicing and estimating software for contractors,
          freelancers, and service businesses. This privacy policy explains what personal information we collect, why we collect
          it, how we use it, how we protect it, and the rights and choices available to you. It applies to our website (honestinvoice.com),
          mobile application, and related services (together, the "Service"). Please read this policy carefully.
          If you do not agree with our practices, please do not use our Service.
        </p>

        <Section title="1. Information we collect">
          <h3 className="font-semibold text-foreground mt-4">1.1 Information you provide directly</h3>
          <ul className="list-disc pl-5">
            <li>
              <strong>Account registration data</strong> — when you create an account, we collect your name, 
              email address, phone number, company name, business address, and any other information you provide 
              in your profile. Your password is stored securely by our identity provider and is never visible to us.
            </li>
            <li>
              <strong>Business data</strong> — clients, invoices, estimates, job descriptions, materials lists,
              uploaded photos, rate books, branding presets, templates, payment terms, and related documents 
              you create, upload, or import. This may include names, email addresses, phone numbers, billing 
              addresses, and payment information of your customers, which you provide on their behalf.
            </li>
            <li>
              <strong>Lead data</strong> — leads collected through the Lead Gen Engine (from sources such as 
              Craigslist, Nextdoor, Facebook, or other platforms you integrate), including contact details, 
              job descriptions, images, scope of work, and post content. This also includes automated responses, 
              email delivery records, and engagement metrics for those leads.
            </li>
            <li>
              <strong>Communication data</strong> — when you contact us via email, support chat, feedback forms, 
              or other channels, we collect the content of your message, your contact information, and any 
              attachments you include.
            </li>
            <li>
              <strong>Payment data</strong> — billing address, subscription plan selected, and invoice history. 
              Payment processing is handled entirely by Stripe, our payment processor. We do not collect, store, 
              or have access to your credit card numbers or full payment card data. Stripe provides us only with 
              payment status, transaction ID, and billing metadata.
            </li>
            <li>
              <strong>API and MCP server usage</strong> — when you or your AI agents use the MCP server or 
              REST API, we log the action taken (for example "estimate created", "invoice sent", or "email sent"), 
              the resource type, timestamp, user identity, IP address, API key used, and outcome/status. This 
              audit trail allows you to review, monitor, and revoke agent activity.
            </li>
          </ul>

          <h3 className="font-semibold text-foreground mt-4">1.2 Information collected automatically</h3>
          <ul className="list-disc pl-5">
            <li>
              <strong>Device and browser information</strong> — device type, operating system, browser type and version,
              device identifiers, and user agent information.
            </li>
            <li>
              <strong>Usage and activity data</strong> — pages viewed, features used, time spent on the Service, 
              clicks, interactions, searches, filters applied, and other actions you take within the Service.
            </li>
            <li>
              <strong>Connection and location data</strong> — IP address, approximate geolocation based on IP, 
              connection type (e.g., WiFi, cellular), and referring website or link.
            </li>
            <li>
              <strong>Log data</strong> — server logs containing access times, request types, response codes, 
              error messages, and other technical information related to your use of the Service.
            </li>
            <li>
              <strong>Email engagement data</strong> — for estimate and invoice emails sent through the Lead Gen 
              Engine or the Service, we track whether the email was delivered, opened, bounced, or marked as spam. 
              We also track whether links and attachments in those emails were clicked or downloaded, along with 
              the recipient's browser, device, and approximate location when available.
            </li>
            <li>
              <strong>Tracking pixels and web beacons</strong> — estimate emails sent to leads include a transparent 
              tracking pixel that allows us to detect when an email is opened.
            </li>
          </ul>

          <h3 className="font-semibold text-foreground mt-4">1.3 Information from third parties</h3>
          <ul className="list-disc pl-5">
            <li>
              <strong>Lead sources</strong> — when you integrate lead-scraping sources (Craigslist, Nextdoor, Facebook, etc.), 
              we receive lead information from those platforms on your behalf, subject to their terms of service and API policies.
            </li>
            <li>
              <strong>Service providers</strong> — Stripe provides payment-related information; email delivery services 
              provide delivery and bounce data; and our cloud infrastructure provider may provide security and usage logs.
            </li>
            <li>
              <strong>Public information</strong> — we may collect publicly available business information to improve 
              service recommendations or to support fraud prevention.
            </li>
          </ul>
        </Section>

        <Section title="2. Legal basis for processing (if applicable)">
          <p>
            For users in jurisdictions with data protection laws (such as the GDPR), we process your personal 
            information on the following legal bases:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Contract</strong> — to perform the Services you have requested and to fulfill our obligations 
              under our Terms of Service.
            </li>
            <li>
              <strong>Consent</strong> — where you have opted in to marketing communications, analytics, or other 
              optional data collection.
            </li>
            <li>
              <strong>Legitimate interests</strong> — to operate, improve, and secure our Service; to prevent fraud 
              and abuse; to enforce our legal rights; and to communicate with you about your account.
            </li>
            <li>
              <strong>Legal obligation</strong> — to comply with applicable laws, regulations, court orders, or 
              government requests.
            </li>
          </ul>
        </Section>

        <Section title="3. How we use information">
          <ul className="list-disc pl-5">
            <li>
              <strong>To operate and provide the Service</strong> — create, store, retrieve, edit, and send invoices, 
              estimates, proposals, and related documents; manage your account; process subscriptions and payments; 
              and enable core functionality.
            </li>
            <li>
              <strong>To power AI features</strong> — generate itemized line items, materials lists, measurements, 
              cost estimates, and assumptions from job descriptions and photos you submit. AI processing is 
              performed by third-party providers (OpenRouter, NVIDIA NIM) as described in Section 4.
            </li>
            <li>
              <strong>To improve the Service</strong> — analyze aggregated, de-identified usage patterns to identify 
              trends, understand user behavior, and develop new features and improvements.
            </li>
            <li>
              <strong>To communicate with you</strong> — send transactional emails (invoices, estimates, password 
              resets, billing notifications, and account confirmations); respond to your inquiries; provide customer 
              support; and send service updates or announcements.
            </li>
            <li>
              <strong>To prevent fraud and abuse</strong> — detect, prevent, and address fraudulent transactions, 
              unauthorized access, abuse, or other violations of our Terms of Service. This includes analyzing 
              patterns, monitoring for suspicious activity, and cooperating with law enforcement.
            </li>
            <li>
              <strong>For security and compliance</strong> — maintain the security and integrity of the Service; 
              comply with legal obligations; respond to lawful requests from government authorities; enforce our 
              legal agreements; and protect the rights, property, and safety of our users, the public, and our Company.
            </li>
            <li>
              <strong>For marketing and analytics</strong> — with your consent, we may send promotional emails about 
              new features, special offers, or resources. You can unsubscribe from marketing emails at any time.
            </li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> sell, trade, rent, or share your personal information with third parties 
            for their independent marketing purposes. We do <strong>not</strong> use your data for targeted advertising 
            on social media or other platforms unless you have explicitly opted in.
          </p>
        </Section>

        <Section title="4. AI features and data shared with AI providers">
          <p>
            When you use AI-powered estimating (available on Pro and Business plans), the following information 
            is transmitted to third-party AI providers solely to generate your estimates:
          </p>
          <ul className="list-disc pl-5">
            <li>Job description and scope of work text</li>
            <li>Uploaded photos and images</li>
            <li>Materials and rate-book entries you reference</li>
            <li>Any custom prompts or instructions you provide</li>
          </ul>
          <p className="mt-3">
            <strong>Current AI providers:</strong>
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>OpenRouter</strong> (https://openrouter.ai) — routes your request to various large language models (LLMs).
            </li>
            <li>
              <strong>NVIDIA NIM</strong> (https://www.nvidia.com/en-us/ai-data-science/nvidia-nim/) — provides AI inference services.
            </li>
          </ul>
          <p className="mt-3">
            <strong>How your data is protected:</strong> We transmit only the minimum information necessary to generate 
            your estimate. AI providers are contractually restricted from using your content to train their models or 
            for any purpose other than generating your estimate. Access to your data is scoped to your specific request 
            and is not retained by the AI provider after processing. However, we cannot guarantee that AI providers do 
            not retain logs or metadata. If you have concerns, please review their respective privacy policies.
          </p>
          <p className="mt-3">
            <strong>Important:</strong> Do not include sensitive personal information in job descriptions, photos, AI 
            prompts, or client details. Examples include:
          </p>
          <ul className="list-disc pl-5">
            <li>Social Security numbers or other tax identification numbers</li>
            <li>Financial account numbers, credit card numbers, or banking information</li>
            <li>Health information or medical records</li>
            <li>Passwords or security credentials</li>
            <li>Confidential or proprietary business information not intended for AI processing</li>
          </ul>
          <p className="mt-3">
            AI-generated content can be inaccurate, incomplete, or biased. You are solely responsible for reviewing, 
            validating, and correcting all AI-generated estimates before sending them to clients or using them for 
            business decisions.
          </p>
        </Section>

        <Section title="5. How we share information">
          <p>
            We share your personal information only with service providers and partners necessary to operate the Service, 
            and only to the extent required for them to perform their function. These recipients are contractually obligated 
            to protect your data and use it only for the purposes we specify.
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Stripe</strong> (https://stripe.com) — payment processing. Subscription billing, payment links, 
              and invoice history are processed through Stripe. Your clients pay Stripe directly; we never receive or 
              handle credit card numbers or full card data.
            </li>
            <li>
              <strong>Resend</strong> (https://resend.com) — transactional email delivery. We send your account notifications, 
              password resets, transactional invoices, and estimates through Resend's infrastructure. Resend does not use 
              your data for marketing.
            </li>
            <li>
              <strong>Supabase</strong> (https://supabase.com) — backend infrastructure including PostgreSQL database, 
              authentication, file storage (for photos and documents), and hosting. Supabase is hosted on Amazon Web Services (AWS) 
              in the United States.
            </li>
            <li>
              <strong>AI providers</strong> (OpenRouter, NVIDIA NIM) — AI-generated estimates, as described in Section 4.
            </li>
            <li>
              <strong>Analytics and monitoring</strong> — we may use third-party services for error tracking, performance 
              monitoring, and security logging to maintain and improve the Service.
            </li>
            <li>
              <strong>Lead sources</strong> — when you connect to lead-scraping platforms (Craigslist, Nextdoor, Facebook, etc.), 
              your API credentials and connection preferences are stored to enable lead retrieval. We do not share your business 
              data with these platforms.
            </li>
          </ul>
          <p className="mt-3">
            <strong>Legal and regulatory disclosure:</strong> We may also disclose your personal information where required by law, 
            legal process, or government request (including subpoenas, court orders, and law enforcement demands). We will 
            notify you of such requests unless legally prohibited from doing so. We may also disclose information to protect 
            the rights, property, or safety of Honest Invoice, our users, or the public; to enforce our Terms of Service or 
            other agreements; or to prevent fraud or other illegal activity.
          </p>
          <p className="mt-3">
            <strong>Business transfers:</strong> If Honest Invoice is involved in a merger, acquisition, bankruptcy, 
            dissolution, reorganization, or similar transaction or proceeding, your personal information may be transferred 
            as part of that transaction. We will provide notice before your data becomes subject to a different privacy policy.
          </p>
          <p className="mt-3">
            <strong>No sale of personal information:</strong> We do not sell, rent, trade, or otherwise transfer your personal 
            information to third parties for their own marketing or commercial purposes.
          </p>
        </Section>

        <Section title="6. Cookies and similar technologies">
          <p>
            We use cookies, web beacons, local storage, and similar tracking technologies to enhance your experience with 
            the Service. These are used for the following purposes:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Authentication and security</strong> — to keep you signed in, remember your preferences, and prevent 
              unauthorized access.
            </li>
            <li>
              <strong>Functional purposes</strong> — to enable core features such as form persistence, language preferences, 
              and UI state.
            </li>
            <li>
              <strong>Analytics</strong> — with your consent, we may use analytics cookies to understand how users interact 
              with the Service and to improve performance.
            </li>
          </ul>
          <p className="mt-3">
            <strong>No advertising cookies or third-party trackers:</strong> We do not use cookies for targeted advertising, 
            behavioral tracking, or sharing with third-party ad networks. We do not use Google Analytics or similar 
            cross-domain tracking.
          </p>
          <p className="mt-3">
            <strong>Your cookie choices:</strong> You can disable cookies in your browser settings or use private/incognito mode. 
            Note that disabling cookies may prevent you from signing in or using certain features of the Service. Most browsers 
            provide instructions on how to clear cookies and manage cookie preferences.
          </p>
        </Section>

        <Section title="7. Email tracking and engagement analytics">
          <p>
            When you send estimate emails, invoices, or other communications through the Service, we collect the following 
            engagement data:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Email open tracking</strong> — estimate emails include a transparent tracking pixel. When a recipient 
              opens the email, we record the open event (timestamp, recipient email, device, browser, approximate geolocation).
            </li>
            <li>
              <strong>Link and attachment tracking</strong> — we track when recipients click links, download attachments, or 
              interact with buttons embedded in emails.
            </li>
            <li>
              <strong>Delivery status</strong> — we track whether emails were delivered, bounced, or marked as spam.
            </li>
            <li>
              <strong>Recipient data</strong> — name, email address, and any other recipient information you include.
            </li>
          </ul>
          <p className="mt-3">
            This engagement data is displayed in your Lead Board and account dashboard so you can measure lead interest and 
            track follow-up actions. This data is not shared with third parties for advertising purposes and is used only to 
            provide analytics and insights within your account.
          </p>
        </Section>

        <Section title="8. Security and data protection">
          <p>
            We implement industry-standard security measures to protect your personal information from unauthorized access, 
            disclosure, and misuse:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Encryption in transit</strong> — all data transmitted between your device and our servers is encrypted 
              using TLS 1.2 or higher.
            </li>
            <li>
              <strong>Encryption at rest</strong> — sensitive data stored in our database is encrypted at rest using 
              industry-standard algorithms.
            </li>
            <li>
              <strong>Access control</strong> — access to your data is restricted to authorized personnel and is scoped to 
              your account via row-level security policies. API keys are stored as one-way hashes and cannot be reversed.
            </li>
            <li>
              <strong>Authentication</strong> — user accounts are protected by email-based authentication. We recommend using 
              strong, unique passwords and enabling additional security features when available.
            </li>
            <li>
              <strong>Secure development practices</strong> — our development practices follow the OWASP Top 10 guidelines and 
              industry best practices for secure coding.
            </li>
            <li>
              <strong>Vulnerability management</strong> — we conduct regular security testing and respond promptly to identified 
              vulnerabilities.
            </li>
          </ul>
          <p className="mt-3">
            <strong>Important limitation:</strong> No method of transmission or storage over the internet is completely secure. 
            While we use best efforts to protect your personal information, we cannot guarantee absolute security. Any 
            transmission of data is at your own risk. You are responsible for maintaining the confidentiality of your account 
            credentials.
          </p>
          <p className="mt-3">
            <strong>Security incident notification:</strong> If we discover a security breach or unauthorized access to personal 
            information, we will notify affected users as promptly as possible, consistent with the requirements of applicable law.
          </p>
        </Section>

        <Section title="9. Data retention">
          <p>
            We retain your personal information for as long as necessary to provide the Service and to fulfill the purposes outlined 
            in this Privacy Policy. Retention periods vary by data type:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Account data</strong> — retained while your account is active. After account deletion, account data is 
              retained for 30 days to cover backups and ensure data consistency, then permanently deleted.
            </li>
            <li>
              <strong>Business data</strong> (invoices, estimates, clients, leads) — retained while your account is active and 
              for 30 days after account deletion, then permanently deleted, unless you have downloaded or exported the data.
            </li>
            <li>
              <strong>Payment and billing data</strong> — retained for 7 years to comply with tax, accounting, and legal record-keeping 
              obligations that may apply to you.
            </li>
            <li>
              <strong>Audit logs and API activity</strong> — retained for up to 12 months to support security, fraud prevention, 
              and troubleshooting. Some audit logs may be retained longer if required by law.
            </li>
            <li>
              <strong>Email engagement data</strong> — retained while your account is active, and for 30 days after account deletion.
            </li>
            <li>
              <strong>Log data and technical information</strong> — typically retained for 30–90 days, unless retention is required 
              for security or legal reasons.
            </li>
            <li>
              <strong>Marketing and support communications</strong> — retained for as long as necessary to respond to your inquiry 
              or as required by law.
            </li>
          </ul>
          <p className="mt-3">
            If you are subject to industry-specific regulations (such as construction or tax law), you may be legally required to 
            retain certain records longer. You are responsible for understanding and complying with your own record-keeping obligations.
          </p>
        </Section>

        <Section title="10. Your rights and choices">
          <p>
            Depending on where you live, you may have certain legal rights regarding your personal information. You can 
            exercise these rights by contacting us at{" "}
            <a href="mailto:privacy@honestinvoice.com" className="underline">
              privacy@honestinvoice.com
            </a>{" "}
            or through your account settings. We will respond to verified requests within the timeframes required by applicable law.
          </p>

          <h3 className="font-semibold text-foreground mt-4">10.1 Rights available to all users</h3>
          <ul className="list-disc pl-5">
            <li>
              <strong>Access and portability</strong> — request a copy of the personal information we hold about you in a 
              portable, machine-readable format.
            </li>
            <li>
              <strong>Correction</strong> — request correction of inaccurate or incomplete personal information.
            </li>
            <li>
              <strong>Deletion</strong> — request deletion of your personal information (subject to legal record-keeping obligations).
            </li>
            <li>
              <strong>Marketing communications</strong> — opt out of promotional emails at any time by clicking "Unsubscribe" 
              in the email footer or updating your preferences in your account settings.
            </li>
          </ul>

          <h3 className="font-semibold text-foreground mt-4">10.2 California residents (CCPA / CPRA)</h3>
          <p>
            If you are a California resident, the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA) 
            provide you with the following rights:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Right to know</strong> — request the categories and specific pieces of personal information we collect, 
              the sources of that information, our purposes for collection, and the categories of third parties with whom we share it.
            </li>
            <li>
              <strong>Right to delete</strong> — request deletion of personal information we have collected from you, subject to 
              certain exceptions (such as record-keeping obligations).
            </li>
            <li>
              <strong>Right to correct</strong> — request correction of inaccurate personal information.
            </li>
            <li>
              <strong>Right to opt out of sales and sharing</strong> — we do not sell or share your personal information for 
              targeted advertising, so there is nothing to opt out of. However, if you wish to confirm this, you may submit a request.
            </li>
            <li>
              <strong>Right to limit use and disclosure</strong> — request that we limit our use of sensitive personal information 
              to what is necessary to provide the Service.
            </li>
            <li>
              <strong>Right to non-discrimination</strong> — we will not discriminate against you for exercising your CCPA/CPRA rights 
              by denying services, charging different prices, or providing a different quality of service.
            </li>
          </ul>
          <p className="mt-3">
            To exercise these rights, email us at{" "}
            <a href="mailto:privacy@honestinvoice.com" className="underline">
              privacy@honestinvoice.com
            </a>{" "}
            with "California Privacy Request" in the subject line. We will verify your identity before fulfilling your request. You 
            may authorize an agent to submit a request on your behalf; we will require proof of authorization.
          </p>

          <h3 className="font-semibold text-foreground mt-4">10.3 Virginia, Colorado, Connecticut, Utah, and other state residents</h3>
          <p>
            Residents of Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA), and other states with comprehensive privacy 
            laws may have similar rights, including:
          </p>
          <ul className="list-disc pl-5">
            <li>Right to access your personal information</li>
            <li>Right to correct inaccurate information</li>
            <li>Right to delete your personal information (subject to exceptions)</li>
            <li>Right to opt out of targeted advertising and data sales (which we do not conduct)</li>
            <li>Right to appeal our response to your request</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, contact us at{" "}
            <a href="mailto:privacy@honestinvoice.com" className="underline">
              privacy@honestinvoice.com
            </a>.
          </p>

          <h3 className="font-semibold text-foreground mt-4">10.4 European residents (GDPR / UK GDPR)</h3>
          <p>
            If you are in the European Economic Area, the United Kingdom, or Switzerland, the General Data Protection Regulation (GDPR), 
            UK Data Protection Act 2018, or Swiss Federal Data Protection Act provide you with the following rights:
          </p>
          <ul className="list-disc pl-5">
            <li>Right of access to your personal data</li>
            <li>Right to rectification (correction) of inaccurate data</li>
            <li>Right to erasure ("right to be forgotten") in certain circumstances</li>
            <li>Right to restrict processing of your data</li>
            <li>Right to data portability</li>
            <li>Right to object to processing, including for direct marketing</li>
            <li>Rights related to automated decision-making and profiling</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, contact our Data Protection Officer or privacy contact at{" "}
            <a href="mailto:privacy@honestinvoice.com" className="underline">
              privacy@honestinvoice.com
            </a>. 
            You also have the right to lodge a complaint with your local data protection authority.
          </p>
          <p className="mt-3">
            <strong>International transfers:</strong> The Service is hosted in the United States. Your personal data will be transferred 
            to, stored in, and processed in the United States. The United States has not been deemed to have an adequate level of data 
            protection under GDPR, but we rely on appropriate safeguards such as Standard Contractual Clauses (SCCs) to enable lawful transfers.
          </p>
        </Section>

        <Section title="11. Children">
          <p>
            The Service is not directed to individuals under the age of 16 and we do not knowingly collect personal information from 
            children under 16. If we become aware that a child under 16 has provided us with personal information, we will promptly delete 
            that information and terminate the child's account if applicable. If you believe a child has provided us personal information, 
            please contact us immediately at{" "}
            <a href="mailto:privacy@honestinvoice.com" className="underline">
              privacy@honestinvoice.com
            </a>.
          </p>
        </Section>

        <Section title="12. International users">
          <p>
            The Service is primarily hosted in the United States on Amazon Web Services (AWS) infrastructure managed by Supabase. 
            If you access the Service from outside the United States, your personal information will be transferred to, stored in, 
            and processed in the United States. By using the Service, you consent to the transfer of your personal information to the 
            United States, which may have different data protection laws than your home country.
          </p>
          <p className="mt-3">
            For users in the European Economic Area, United Kingdom, or Switzerland, we implement appropriate safeguards for these 
            transfers (such as Standard Contractual Clauses) consistent with GDPR and similar laws. You may contact us to inquire about 
            the specific safeguards in place.
          </p>
        </Section>

        <Section title="13. Third-party links and services">
          <p>
            The Service may contain links to third-party websites and services that are not operated by Honest Invoice. This Privacy 
            Policy applies only to the Service and does not cover the privacy practices of third-party sites. We are not responsible 
            for the privacy practices or content of external links. We encourage you to review the privacy policies of any third-party 
            sites before providing your personal information.
          </p>
          <p className="mt-3">
            Third-party integrations (such as lead-scraping sources) may have their own privacy policies and terms of service. Your 
            use of those services is subject to their respective policies.
          </p>
        </Section>

        <Section title="14. Changes to this policy">
          <p>
            We may update this Privacy Policy as the Service evolves, as our business changes, or as required by law. Material changes 
            will be posted on this page with an updated "Last updated" date. For significant changes, we will notify you by email or 
            by displaying a prominent notice on the Service. Your continued use of the Service after any changes constitutes your 
            acceptance of the updated policy. We encourage you to review this policy periodically to stay informed about how we protect 
            your information.
          </p>
        </Section>

        <Section title="15. Data Protection Officer and contact information">
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy, our data practices, or your personal information, 
            please contact us:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Email:</strong>{" "}
              <a href="mailto:privacy@honestinvoice.com" className="underline">
                privacy@honestinvoice.com
              </a>
            </li>
            <li>
              <strong>Mailing address:</strong> [Insert your company's mailing address]
            </li>
            <li>
              <strong>Response time:</strong> We will respond to all privacy inquiries and data rights requests within 30 days 
              (or as required by applicable law). For complex requests, we may need additional time.
            </li>
          </ul>
          <p className="mt-3">
            <strong>For European users:</strong> If you have an unresolved privacy or data use concern that we have not satisfactorily 
            addressed, please contact your local data protection authority or file a complaint with your supervisory authority.
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
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground [&>ul]:mt-2 [&_a]:text-primary [&>h3]:mt-3">
        {children}
      </div>
    </section>
  );
}
