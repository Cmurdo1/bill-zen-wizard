import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/invoices/")({
  beforeLoad: () => {
    throw redirect({ to: "/documents", search: { type: "invoice" } });
  },
});
