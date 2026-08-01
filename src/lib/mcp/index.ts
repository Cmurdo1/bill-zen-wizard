import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listInvoices from "./tools/list-invoices";
import getInvoice from "./tools/get-invoice";
import listEstimates from "./tools/list-estimates";
import listClients from "./tools/list-clients";
import cashSummary from "./tools/cash-summary";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "honest-invoice",
  title: "Honest Invoice",
  version: "0.1.0",
  instructions:
    "Read-only tools for a Honest Invoice account. Use list_invoices and get_invoice for billing documents, list_estimates for proposals, list_clients for customers, and cash_summary for paid/outstanding/overdue totals. All tools act as the signed-in Honest Invoice user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listInvoices, getInvoice, listEstimates, listClients, cashSummary],
});
