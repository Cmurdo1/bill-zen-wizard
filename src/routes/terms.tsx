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
        <p className="mt-2 text-sm text-muted-foreground">Last updated: July 8, 2026</p>
        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-8">
            <h2 className="text-xl font-semibold text-foreground">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </article>
    </MarketingShell>
  );
}

const SECTIONS = [
  { title: "1. Agreement", body: "By creating an account or using Honest Invoice you agree to these terms. If you use the service on behalf of a business, you represent that you have authority to bind it." },
  { title: "2. The service", body: "Honest Invoice provides invoicing and estimating tools, AI-assisted features, and payment link generation via Stripe. We may improve, add, or remove features over time." },
  { title: "3. Your account", body: "You are responsible for keeping your credentials secure and for activity under your account. Notify us of unauthorized access promptly." },
  { title: "4. Acceptable use", body: "Don’t use Honest Invoice to defraud, spam, harass, infringe others’ rights, or violate law. We may suspend accounts that do." },
  { title: "5. Payments and fees", body: "Free plans are free. Paid plans renew until cancelled. Stripe processing fees are set by Stripe and passed through — we don’t take a cut of your payments." },
  { title: "6. Your content", body: "You own your data. You grant us the limited rights needed to run the service on your behalf." },
  { title: "7. Warranties", body: "The service is provided “as is” without warranties of any kind. We work hard to keep it available and accurate but do not guarantee it." },
  { title: "8. Liability", body: "To the maximum extent permitted by law, our aggregate liability is limited to the amount you paid us in the 12 months preceding a claim." },
  { title: "9. Termination", body: "You can cancel any time. We can terminate accounts that violate these terms. On termination you may export your data for 30 days." },
  { title: "10. Governing law", body: "These terms are governed by the laws of the State of Delaware, USA." },
];
