import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage } from "@/components/marketing/seo-landing-page";
import { seoHead } from "@/lib/seo-pages";

const config = {
  path: "/invoice-software-for-contractors",
  title: "Invoice Software for Contractors | Honest Invoice",
  description:
    "AI invoice software for contractors. Turn a plain-English job description into itemized estimates and invoices, send payment links, and get paid faster.",
  h1: "Invoice software built for contractors",
  eyebrow: "Contractor invoicing",
  intro:
    "Spend less time turning job notes into paperwork. Honest Invoice helps contractors describe the work, review AI-generated line items, and send a professional invoice in minutes.",
  workflow: "From job description to paid invoice",
  audience:
    "Made for independent contractors and service businesses that need estimates and invoices without a heavyweight accounting system.",
  examples: [
    "HVAC replacement with labor, parts, and refrigerant",
    "Electrical service call with diagnostics, materials, and labor",
    "Plumbing repair with parts, trip charge, and installation",
    "Landscaping project with materials, labor, and recurring visits",
  ],
  benefits: [
    "AI line-item extraction from plain-English job descriptions",
    "Professional invoices and estimates with your branding",
    "Payment links through Stripe on eligible plans",
    "Recurring invoices and automated reminders",
    "Mobile-first workflow for contractors in the field",
  ],
  faq: [
    {
      q: "Can contractors use Honest Invoice for estimates?",
      a: "Yes. Honest Invoice supports estimates and can turn approved work into an invoice.",
    },
    {
      q: "Can AI create contractor invoice line items?",
      a: "Yes. Describe the job in plain English and AI can draft labor and material line items for you to review.",
    },
    {
      q: "Is there a free contractor invoice plan?",
      a: "Yes. The Free plan supports up to 5 invoices per month without a credit card.",
    },
  ],
};

export const Route = createFileRoute("/invoice-software-for-contractors")({
  head: () => seoHead(config),
  component: () => <SeoLandingPage config={config} />,
});
