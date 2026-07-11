import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { ComingSoon } from "@/components/app/coming-soon";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Lead Board — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AppShell title="Lead Board">
      <ComingSoon
        title="Lead Gen Engine"
        description="Scrape Craigslist, Facebook, and Nextdoor for local jobs. Automatically match qualified leads to your estimate templates."
      />
    </AppShell>
  ),
});
