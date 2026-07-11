import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { ComingSoon } from "@/components/app/coming-soon";

export const Route = createFileRoute("/_authenticated/estimates")({
  head: () => ({ meta: [{ title: "Estimates — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AppShell title="Estimates">
      <ComingSoon
        title="AI-powered regional estimates"
        description="Turn a job description into a professional estimate in seconds. Attach photos, apply your regional labor rates, and send for signature."
      />
    </AppShell>
  ),
});
