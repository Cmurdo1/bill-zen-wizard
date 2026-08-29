import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/documents/$id",
      params: { id: params.id },
      search: { type: "invoice" },
    });
  },
});
