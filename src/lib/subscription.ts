import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Plan = "free" | "pro" | "business";

export type SubscriptionInfo = {
  plan: Plan;
  status: string;
  activeUntil: Date | null;
  isActive: boolean;
  invoicesThisMonth: number;
  invoiceLimit: number | null; // null = unlimited
  canCreateInvoice: boolean;
  canUseAI: boolean;
  canUseLeadGen: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

function planFromStatus(status: string | null | undefined, activeUntil: Date | null): Plan {
  if (!status || status === "free" || status === "canceled") return "free";
  const expired = activeUntil ? activeUntil.getTime() < Date.now() : false;
  if (expired) return "free";
  if (status === "business" || status === "active_business") return "business";
  if (status === "pro" || status === "active" || status === "active_pro" || status === "trialing")
    return "pro";
  return "free";
}

export function limitsFor(plan: Plan) {
  if (plan === "business") return { invoiceLimit: null, ai: true, leadGen: true };
  if (plan === "pro") return { invoiceLimit: null, ai: true, leadGen: true };
  return { invoiceLimit: 5, ai: false, leadGen: false };
}

export function useSubscription(): SubscriptionInfo {
  const [state, setState] = useState({
    plan: "free" as Plan,
    status: "free",
    activeUntil: null as Date | null,
    invoicesThisMonth: 0,
    loading: true,
  });

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [profRes, countRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("subscription_status,subscription_end")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart.toISOString()),
    ]);
    const activeUntil = profRes.data?.subscription_end
      ? new Date(profRes.data.subscription_end)
      : null;
    const plan = planFromStatus(profRes.data?.subscription_status, activeUntil);
    setState({
      plan,
      status: profRes.data?.subscription_status ?? "free",
      activeUntil,
      invoicesThisMonth: countRes.count ?? 0,
      loading: false,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const limits = limitsFor(state.plan);
  const isActive = state.plan !== "free";
  const canCreateInvoice =
    limits.invoiceLimit === null || state.invoicesThisMonth < limits.invoiceLimit;

  return {
    ...state,
    isActive,
    invoiceLimit: limits.invoiceLimit,
    canCreateInvoice,
    canUseAI: limits.ai,
    canUseLeadGen: limits.leadGen,
    refresh: load,
  };
}

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) {
        setIsAdmin(Boolean(data));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { isAdmin, loading };
}
