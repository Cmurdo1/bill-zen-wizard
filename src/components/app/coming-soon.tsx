import { Sparkles } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center shadow-soft">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-display text-2xl text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <span className="mt-6 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
        Rolling out with Pro & Business
      </span>
    </div>
  );
}
