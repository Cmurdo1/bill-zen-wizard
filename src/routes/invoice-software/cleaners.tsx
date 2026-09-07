import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage } from "@/components/marketing/seo-landing-page";
import { seoHead } from "@/lib/seo-pages";

const config = {
  path: "/invoice-software/cleaners",
  title: "Cleaning invoice software | Honest Invoice",
  description:
    "Cleaning invoice software for residential and commercial cleaning businesses. Create recurring or one-off invoices from simple job descriptions.",
  h1: "Simple invoicing for cleaning businesses and recurring clients.",
  eyebrow: "Cleaners invoicing",
  intro:
    "Cleaning invoice software for residential and commercial cleaning businesses. Create recurring or one-off invoices from simple job descriptions. Honest Invoice keeps the workflow focused: describe the work, review the AI-generated line items, and send the invoice.",
  workflow: "From the service call to a clear invoice",
  audience:
    "Built for cleaners who need fast estimates and invoices while they are in the field or moving between jobs.",
  examples: [
    "deep-cleaned 3 bedroom home, 4 labor hours, supplies included",
    "Deep cleans with labor and materials",
    "Estimate a new job before work starts and convert it into an invoice",
    "Recurring service billing for repeat customers",
  ],
  benefits: [
    "AI-assisted labor and material line items from plain-English job notes",
    "Professional estimates and invoices for client-facing work",
    "Payment links through Stripe on eligible plans",
    "Client and rate information can be reused on future documents",
    "Works from a mobile-first web workflow",
  ],
  faq: [
    {
      q: "Can cleaners use Honest Invoice for estimates?",
      a: "Yes. Honest Invoice supports estimates so you can quote cleaners work before creating the final invoice.",
    },
    {
      q: "Can I describe a job instead of entering every line item?",
      a: "Yes. The AI workflow can draft labor and material line items from a plain-English description. Review the result before sending.",
    },
    {
      q: "Is there a free plan?",
      a: "Yes. The Free plan supports up to 5 invoices per month with no credit card required.",
    },
  ],
};

export const Route = createFileRoute("/invoice-software/cleaners")({
  head: () => seoHead(config),
  component: () => <SeoLandingPage config={config} />,
});
