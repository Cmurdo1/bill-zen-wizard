import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { LineItem } from "@/lib/documents";
import { toast } from "sonner";
import {
  createInvoiceRecord,
  fetchBusinessName,
  insertInvoiceItems,
  markInvoiceSent,
  updateInvoiceTotals,
} from "@/lib/invoice-schema";
import { sendInvoiceEmail } from "@/lib/invoices.functions";
import { sendEstimateEmail } from "@/lib/estimates.functions";
import {
  createEstimateRecord,
  insertEstimateItems,
  updateEstimateTotals,
} from "@/lib/estimate-schema";

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
          *,
          invoice_items(*)
        `,
        )
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoice: {
      client_id?: string | null;
      job_description?: string | null;
      notes?: string | null;
      due_date?: string | null;
      expiry_date?: string | null;
      type?: "invoice" | "estimate";
      branding_preset_id?: string | null;
    }) => {
      const isEstimate = invoice.type === "estimate";

      // Both invoice and estimate creates are schema-adaptive so they work
      // on the legacy live database (estimates = invoices where type='estimate').
      if (isEstimate) {
        return createEstimateRecord({
          client_id: invoice.client_id,
          job_description: invoice.job_description,
          notes: invoice.notes,
          expiry_date: invoice.expiry_date,
          branding_preset_id: invoice.branding_preset_id,
        });
      }

      return createInvoiceRecord({
        client_id: invoice.client_id,
        job_description: invoice.job_description,
        notes: invoice.notes,
        due_date: invoice.due_date,
        branding_preset_id: invoice.branding_preset_id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<{
      id: string;
      client_id: string | null;
      issue_date: string;
      due_date: string | null;
      notes: string | null;
      tax_rate: number;
      status: string;
      currency: string;
    }> & { id: string }) => {
      const { data, error } = await supabase
        .from("invoices")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", variables.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Invoice Items
export function useAddInvoiceItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoice_id,
      items,
    }: {
      invoice_id: string;
      items: Omit<LineItem, "id" | "invoice_id" | "amount_cents" | "sort_order">[];
    }) => {
      await insertInvoiceItems(invoice_id, items);
      return { invoice_id };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", variables.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAddEstimateItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      estimate_id,
      items,
    }: {
      estimate_id: string;
      items: Omit<LineItem, "id" | "estimate_id" | "amount_cents" | "sort_order">[];
    }) => {
      await insertEstimateItems(estimate_id, items);
      return { estimate_id };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["estimate", variables.estimate_id] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAddDocumentItems() {
  const addInvoiceItems = useAddInvoiceItems();
  const addEstimateItems = useAddEstimateItems();

  return {
    addInvoiceItems,
    addEstimateItems,
    addItems: async (
      type: "invoice" | "estimate",
      documentId: string,
      items: Omit<LineItem, "id" | "invoice_id" | "estimate_id" | "amount_cents" | "sort_order">[],
    ) => {
      if (type === "invoice") {
        return addInvoiceItems.mutateAsync({ invoice_id: documentId, items });
      } else {
        return addEstimateItems.mutateAsync({ estimate_id: documentId, items });
      }
    },
  };
}

export function useUpdateInvoiceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      invoice_id,
      ...updates
    }: Partial<LineItem> & { id: string; invoice_id: string }) => {
      const { data, error } = await supabase
        .from("invoice_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { data, invoice_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", result.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteInvoiceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, invoice_id }: { id: string; invoice_id: string }) => {
      const { error } = await supabase.from("invoice_items").delete().eq("id", id);
      if (error) throw error;
      return { invoice_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", result.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Recalculate invoice totals
export function useRecalculateInvoiceTotals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoice_id, tax_rate }: { invoice_id: string; tax_rate: number }) => {
      await updateInvoiceTotals(invoice_id, tax_rate);
      return { invoice_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", result.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useRecalculateEstimateTotals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ estimate_id, tax_rate }: { estimate_id: string; tax_rate: number }) => {
      await updateEstimateTotals(estimate_id, tax_rate);
      return { estimate_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["estimate", result.estimate_id] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
    },
  });
}

/** The signed-in user's own email, for test-sending a copy to yourself. */
export function useMyEmail() {
  return useQuery({
    queryKey: ["my-email"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.email ?? "";
    },
    staleTime: 60_000,
  });
}

/**
 * Send an invoice or estimate by email from anywhere (list pages, create
 * dialogs). Invoices are also marked sent (legacy bumps sent_count).
 */
export function useSendDocument() {
  const queryClient = useQueryClient();
  const sendInvoice = useServerFn(sendInvoiceEmail);
  const sendEstimate = useServerFn(sendEstimateEmail);

  return useMutation({
    mutationFn: async (input: {
      type: "invoice" | "estimate";
      id: string;
      invoice_number: string;
      client_name: string;
      client_email: string;
      total_amount: number; // dollars
      due_date: string | null;
      job_description: string | null;
      branding_preset_id?: string | null;
      message?: string;
    }) => {
      if (input.type === "estimate") {
        return sendEstimate({
          data: {
            estimateId: input.id,
            to: input.client_email,
            message: input.message?.trim() || undefined,
            business_name: await fetchBusinessName(input.branding_preset_id),
          },
        });
      }

      const businessName = await fetchBusinessName(input.branding_preset_id);
      await sendInvoice({
        data: {
          invoice_id: input.id,
          client_email: input.client_email,
          client_name: input.client_name,
          invoice_number: input.invoice_number,
          total_amount: input.total_amount,
          due_date: input.due_date,
          business_name: businessName,
          job_description: input.job_description,
          document_type: "invoice",
          message: input.message?.trim() || undefined,
        },
      });
      await markInvoiceSent(input.id);
      return { sent: true, to: input.client_email };
    },
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: [vars.type, vars.id] });
    },
  });
}
