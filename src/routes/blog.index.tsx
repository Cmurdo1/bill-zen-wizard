import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog   Honest Invoice" },
      {
        name: "description",
        content:
          "Practical writing on invoicing, cash flow, and getting paid for contractors, freelancers, and service businesses.",
      },
      { property: "og:title", content: "Blog   Honest Invoice" },
      { property: "og:url", content: "/blog" },
    ],
    links: [{ rel: "canonical", href: "/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <MarketingShell>
      <section className="bg-hero">
        <div className="container-page py-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/80">
            The Honest Invoice Blog
          </p>
          <h1 className="mt-2 font-display text-5xl tracking-tight text-foreground sm:text-6xl">
            Get paid. Get better.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Real, practical writing on invoicing, cash flow, and running a service business.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container-page grid gap-6 md:grid-cols-2">
          {BLOG_POSTS.map((p) => (
            <Link
              key={p.slug}
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className="group flex flex-col rounded-2xl border border-border bg-surface p-8 shadow-soft transition-shadow hover:shadow-lifted"
            >
              <div className="flex flex-wrap gap-2 text-xs">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-surface-muted px-2.5 py-1 text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <h2 className="mt-4 font-display text-2xl leading-tight text-foreground group-hover:text-primary">
                {p.title}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {new Date(p.date + "T00:00:00Z").toLocaleDateString("en-US", {
                    timeZone: "UTC",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  · {p.readingMinutes} min read
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary">
                  Read <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
