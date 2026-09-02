import Link from "next/link";
import type { Role } from "@/lib/session";
import { RoleSwitch } from "./RoleSwitch";

const NAV = [
  { href: "/queue", label: "Attention queue" },
  { href: "/kpis", label: "Impact" },
  { href: "/audit", label: "Audit" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <div className="bg-amber-soft/70 px-4 py-1.5 text-center text-xs font-medium text-ink">
        Synthetic demonstration environment — every patient, event and organisation below is fictional. No real data.
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/queue" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-teal">Throughline</span>
            <span className="hidden text-xs font-medium text-slate-muted sm:inline">Coordinate</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1" aria-label="Primary">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-mist hover:text-ink"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <RoleSwitch role={role} />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-slate-muted">
        Throughline Coordinate — MVP. Coordination and administration support with a person in control of every action.
        Not a medical device; makes no clinical decisions.
      </footer>
    </div>
  );
}
