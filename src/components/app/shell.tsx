import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/marketing/shell";
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Target,
  Users,
  Upload,
  Zap,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/estimates", label: "Estimates", icon: ClipboardList },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/leads", label: "Lead Board", icon: Target },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/import-data", label: "Import Data", icon: Upload },
  { to: "/cash-velocity", label: "Cash Velocity", icon: Zap },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState("");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="border-b border-border px-5 py-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="App navigation">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-foreground hover:bg-surface-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <p className="mb-2 truncate px-2 text-xs text-muted-foreground">{email}</p>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4 lg:hidden">
          <Logo />
          <button onClick={signOut} className="text-xs font-semibold text-muted-foreground">
            Sign out
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 lg:hidden" aria-label="Mobile app navigation">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-surface-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1">
          {title && (
            <div className="border-b border-border bg-surface">
              <div className="px-6 py-6 lg:px-10">
                <h1 className="font-display text-3xl tracking-tight text-foreground">{title}</h1>
              </div>
            </div>
          )}
          <div className="px-6 py-8 lg:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
