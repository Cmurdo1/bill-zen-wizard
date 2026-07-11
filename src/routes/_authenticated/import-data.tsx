import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { ComingSoon } from "@/components/app/coming-soon";

export const Route = createFileRoute("/_authenticated/import-data")({
  head: () => ({ meta: [{ title: "Import Data — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AppShell title="Import Data">
      <ComingSoon
        title="Bring your books with you"
        description="One-click imports from QuickBooks, FreshBooks, Wave, and CSV. Your clients, invoices, and payment history come along for the ride."
      />
    </AppShell>
  ),
});
