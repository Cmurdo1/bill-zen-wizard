import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/shell";
import { findPost, BLOG_POSTS } from "@/lib/blog-posts";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = findPost(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Post not found — Honest Invoice" }, { name: "robots", content: "noindex" }] };
    }
    const { post } = loaderData;
    return {
      meta: [
        { title: `${post.title} — Honest Invoice` },
        { name: "description", content: post.description },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/blog/${params.slug}` },
        { property: "article:published_time", content: post.date },
        { property: "article:author", content: post.author },
      ],
      links: [{ rel: "canonical", href: `/blog/${params.slug}` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            author: { "@type": "Organization", name: post.author },
            publisher: { "@type": "Organization", name: "Honest Invoice" },
          }),
        },
      ],
    };
  },
  notFoundComponent: PostNotFound,
  component: BlogPostPage,
});

function PostNotFound() {
  return (
    <MarketingShell>
      <div className="container-page py-20 text-center">
        <h1 className="font-display text-4xl text-foreground">Post not found</h1>
        <Link to="/blog" className="mt-6 inline-flex text-sm font-semibold text-primary underline">Back to blog</Link>
      </div>
    </MarketingShell>
  );
}

function BlogPostPage() {
  const { post } = Route.useLoaderData() as { post: import("@/lib/blog-posts").BlogPost };
  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
  return (
    <MarketingShell>
      <article className="container-page max-w-3xl py-16">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All posts
        </Link>
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {post.tags.map((t) => (
            <span key={t} className="rounded-full bg-surface-muted px-2.5 py-1 text-muted-foreground">{t}</span>
          ))}
        </div>
        <h1 className="mt-4 font-display text-5xl leading-tight tracking-tight text-foreground">{post.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{post.description}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          {post.author} · {new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · {post.readingMinutes} min read
        </p>
        <div className="mt-10 space-y-6 text-[15px] leading-8 text-foreground/90">
          {post.content.map((block, i) => (
            <div key={i}>
              {block.heading && <h2 className="font-display text-2xl text-foreground">{block.heading}</h2>}
              <p className={block.heading ? "mt-2" : ""}>{block.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 rounded-2xl border border-border bg-surface-muted/60 p-8">
          <p className="font-display text-2xl text-foreground">Send your next invoice with Honest Invoice.</p>
          <p className="mt-2 text-sm text-muted-foreground">Free plan available. No credit card required.</p>
          <Link
            to="/signup"
            className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Start free
          </Link>
        </div>
      </article>

      <aside className="border-t border-border py-16">
        <div className="container-page">
          <h2 className="font-display text-2xl text-foreground">Keep reading</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {related.map((p) => (
              <Link
                key={p.slug}
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="rounded-2xl border border-border bg-surface p-6 shadow-soft hover:shadow-lifted"
              >
                <h3 className="font-display text-lg text-foreground">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </MarketingShell>
  );
}
