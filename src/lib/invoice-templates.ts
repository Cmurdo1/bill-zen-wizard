import { supabase } from "@/integrations/supabase/client";

export const INVOICE_TEMPLATE_IDS = ["clean", "classic", "modern"] as const;

export type InvoiceTemplateId = (typeof INVOICE_TEMPLATE_IDS)[number];

export type InvoiceTemplate = {
  id: InvoiceTemplateId;
  name: string;
  description: string;
};

export const INVOICE_TEMPLATES: InvoiceTemplate[] = [
  {
    id: "clean",
    name: "Clean",
    description: "Minimal, spacious, and easy to scan.",
  },
  {
    id: "classic",
    name: "Classic",
    description: "Traditional invoice layout with a strong header.",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Bold accent bar and contemporary totals panel.",
  },
];

export function normalizeInvoiceTemplate(value: unknown): InvoiceTemplateId {
  return INVOICE_TEMPLATE_IDS.includes(value as InvoiceTemplateId)
    ? (value as InvoiceTemplateId)
    : "clean";
}

let invoiceTemplateColumnCache: boolean | null = null;

/** Older databases can safely use the default template until this migration is applied. */
export async function hasInvoiceTemplateColumn(): Promise<boolean> {
  if (invoiceTemplateColumnCache !== null) return invoiceTemplateColumnCache;
  const { error } = (await supabase
    .from("invoices")
    .select("invoice_template")
    .limit(1)) as unknown as { error: { code?: string } | null };
  invoiceTemplateColumnCache = !(error && (error.code === "42703" || error.code === "PGRST204"));
  return invoiceTemplateColumnCache;
}

export function resetInvoiceTemplateCache(): void {
  invoiceTemplateColumnCache = null;
}
