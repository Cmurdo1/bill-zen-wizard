import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/estimates/")({
  beforeLoad: () => {
    throw redirect({ to: "/documents", search: { type: "estimate" } });
  },
});
