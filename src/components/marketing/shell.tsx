import { Link } from "@tanstack/react-router";
import { useState } from "react";

function LogoIcon() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
        <span className="font-display text-sm font-bold">HI</span>
      </span>
    );
  }

  return (
    <>
      <img
        src="/favicon.ico"
        alt="Honest Invoice"
        className="h-9 w-9 rounded-full object-contain dark:hidden"
        width={36}
        height={36}
        onError={() => setFailed(true)}
      />
      <span className="hidden h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground dark:grid">
        <span className="font-display text-sm font-bold">HI</span>
      </span>
    </>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 font-semibold text-foreground ${className}`}
    >
      <LogoIcon />
      <span className="text-lg tracking-tight">Honest Invoice</span>
    </Link>
  );
}

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link to="/mcp" className="text-sm text-muted-foreground hover:text-foreground">
            MCP
          </Link>
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">
            Blog
          </Link>
          <Link to="/pitch" className="text-sm text-muted-foreground hover:text-foreground">
            Investors
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-foreground hover:bg-surface-muted sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-surface-muted/60">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Modern invoicing for contractors, freelancers, and service businesses. Built on the
            principle that getting paid should be simple, transparent, and fast.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Product</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
            </li>
            <li>
              <Link to="/mcp" className="hover:text-foreground">
                MCP for AI agents
              </Link>
            </li>
            <li>
              <Link to="/signup" className="hover:text-foreground">
                Sign up
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-foreground">
                Log in
              </Link>
            </li>
            <li>
              <Link to="/pay-invoice" className="hover:text-foreground">
                Pay an invoice
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Company</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/blog" className="hover:text-foreground">
                Blog
              </Link>
            </li>
            <li>
              <Link to="/pitch" className="hover:text-foreground">
                Investors
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Honest Invoice. All rights reserved.</span>
          <span>Made for people who do the work.</span>
        </div>
      </div>
    </footer>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
