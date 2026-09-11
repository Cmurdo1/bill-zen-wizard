import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage } from "@/components/marketing/seo-landing-page";
import { seoHead } from "@/lib/seo-pages";

const config = {
  path: "/invoice-software/hvac",
  title: "HVAC invoice software | Honest Invoice",
  description:
    "HVAC invoice software for service calls, repairs, installations, and maintenance. Turn job descriptions into itemized invoices with labor and materials.",
  h1: "Describe the HVAC job. Get the invoice drafted.",
  eyebrow: "Hvac Contractors invoicing",
  intro:
    "HVAC invoice software for service calls, repairs, installations, and maintenance. Turn job descriptions into itemized invoices with labor and materials. Honest Invoice keeps the workflow focused: describe the work, review the AI-generated line items, and send the invoice.",
  workflow: "From the service call to a clear invoice",
  audience:
    "Built for HVAC contractors who need fast estimates and invoices while they are in the field or moving between jobs.",
  examples: [
    "replaced a 3 ton condenser, 6 hours labor, 4 lb refrigerant charge",
    "Diagnostic visits with labor and materials",
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
      q: "Can HVAC contractors use Honest Invoice for estimates?",
      a: "Yes. Honest Invoice supports estimates so you can quote HVAC contractors work before creating the final invoice.",
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

export const Route = createFileRoute("/invoice-software/hvac")({
  head: () => seoHead(config),
  component: () => <SeoLandingPage config={config} />,
});
