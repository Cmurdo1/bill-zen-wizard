import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => { throw redirect({ to: "/auth", search: { mode: "login" } }); },
});
