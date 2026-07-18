import { supabase } from "@/integrations/supabase/client";

export type ActivityRow = {
  id: string;
  action: string;
  detail: string | null;
  created_at: string;
};

export async function logActivity(
  documentType: "invoice" | "estimate",
  documentId: string,
  action: string,
  detail?: string,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("document_activity").insert({
    user_id: user.id,
    document_type: documentType,
    document_id: documentId,
    action,
    detail: detail ?? null,
  });
}

export async function fetchActivity(
  documentType: "invoice" | "estimate",
  documentId: string,
): Promise<ActivityRow[]> {
  const { data } = await supabase
    .from("document_activity")
    .select("id,action,detail,created_at")
    .eq("document_type", documentType)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  return (data as ActivityRow[]) ?? [];
}
