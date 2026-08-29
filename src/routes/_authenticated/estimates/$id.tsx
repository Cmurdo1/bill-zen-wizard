import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/estimates/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/documents/$id",
      params: { id: params.id },
      search: { type: "estimate" },
    });
  },
});
