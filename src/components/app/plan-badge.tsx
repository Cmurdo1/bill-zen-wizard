import { Link } from "@tanstack/react-router";
import { Sparkles, Lock } from "lucide-react";
import type { Plan } from "@/lib/subscription";

export function PlanBadge({ plan }: { plan: Plan }) {
  const styles: Record<Plan, string> = {
    free: "bg-muted text-muted-foreground",
    pro: "bg-primary/10 text-primary",
    business: "bg-accent/15 text-accent",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[plan]}`}
    >
      <Sparkles className="h-3 w-3" /> {plan}
    </span>
  );
}

export function UpgradeCallout({ feature }: { feature: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted/60 p-4">
      <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-semibold">{feature} requires Pro or Business</p>
        <p className="mt-1 text-xs text-muted-foreground">
          You're on the Free plan. Upgrade to unlock this feature.
        </p>
      </div>
      <Link
        to="/pricing"
        className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
      >
        Upgrade
      </Link>
    </div>
  );
}

export function UsageMeter({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number | null;
  label: string;
}) {
  if (limit === null) {
    return (
      <p className="text-xs text-muted-foreground">
        {label}: <span className="font-semibold text-foreground">Unlimited</span>
      </p>
    );
  }
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const over = used >= limit;
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className={over ? "text-destructive" : "text-muted-foreground"}>
          {used} / {limit}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${over ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over && (
        <Link
          to="/pricing"
          className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
        >
          Upgrade for unlimited →
        </Link>
      )}
    </div>
  );
}
