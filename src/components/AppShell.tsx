import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { UserMenu } from "./UserMenu";

const NAV = [
  { href: "/queue", label: "Attention queue" },
  { href: "/worklist", label: "Worklist" },
  { href: "/kpis", label: "Impact" },
  { href: "/audit", label: "Audit" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <div className="bg-amber-soft/70 px-4 py-1.5 text-center text-xs font-medium text-ink">
        Synthetic demonstration environment — every patient, event and organisation below is fictional. No real data.
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/queue" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-teal">Throughline</span>
            <span className="hidden text-xs font-medium text-slate-muted sm:inline">Coordinate</span>
          </Link>
          <nav
            className="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:overflow-visible sm:px-0"
            aria-label="Primary"
          >
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-mist hover:text-ink"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto sm:ml-0">
            <UserMenu user={user} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 pb-20">
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-slate-muted">
        Throughline Coordinate — MVP. Coordination and administration support with a person in control of every action.
        Not a medical device; makes no clinical decisions.
      </footer>
    </div>
  );
}
