import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";

// Brand mark: circular ring with bold "HI" (H in the current text color, I in
// the brand lime). Rendered inline so it never depends on a static image file
// that could 404 on the deployed site.
function LogoIcon() {
  return (
    <svg viewBox="0 0 100 100" className="h-9 w-9" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" />
      <g fill="currentColor">
        <rect x="26" y="31" width="8" height="38" />
        <rect x="51" y="31" width="8" height="38" />
        <rect x="26" y="46" width="33" height="7" />
      </g>
      <rect x="67" y="31" width="7" height="38" fill="#68a838" />
    </svg>
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

const NAV_LINKS = [
  { to: "/pricing", label: "Pricing" },
  { to: "/mcp", label: "MCP" },
  { to: "/blog", label: "Blog" },
  { to: "/pitch", label: "Investors" },
] as const;

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
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
          <Sheet>
            <SheetTrigger
              aria-label="Open menu"
              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground hover:bg-surface-muted md:hidden"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-full max-w-xs border-l-border bg-background p-0 sm:max-w-sm"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <Logo />
                <SheetClose
                  aria-label="Close menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </SheetClose>
              </div>
              <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Mobile">
                {NAV_LINKS.map((l) => (
                  <SheetClose asChild key={l.to}>
                    <Link
                      to={l.to}
                      className="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-surface-muted"
                    >
                      {l.label}
                    </Link>
                  </SheetClose>
                ))}
                <div className="my-3 border-t border-border" />
                <SheetClose asChild>
                  <Link
                    to="/login"
                    className="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-surface-muted"
                  >
                    Log in
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/signup"
                    className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    Start free
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
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
