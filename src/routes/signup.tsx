import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — Honest Invoice" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => { throw redirect({ to: "/auth", search: { mode: "signup" } }); },
});
