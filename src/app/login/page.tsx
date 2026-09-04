import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/session";
import { DEMO_USERS } from "@/lib/auth/users";
import { oidcConfigured } from "@/lib/auth/oidc";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await props.searchParams;
  const dest = next && next.startsWith("/") ? next : "/queue";

  const store = await cookies();
  if (await verifySession(store.get(SESSION_COOKIE)?.value)) redirect(dest);

  return (
    <div className="min-h-screen">
      <div className="bg-amber-soft/70 px-4 py-1.5 text-center text-xs font-medium text-ink">
        Synthetic demonstration environment — no real data.
      </div>
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-14">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-teal">Throughline</span>
            <span className="text-xs font-medium text-slate-muted">Coordinate</span>
          </div>
          <h1 className="mt-4 text-lg font-bold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-slate">
            {oidcConfigured()
              ? "This deployment uses NHS CIS2."
              : "Pick a demo identity. Role and place determine what you can see and do — RBAC and tenancy are enforced server-side."}
          </p>
        </div>
        <LoginForm users={DEMO_USERS} oidc={oidcConfigured()} next={dest} />
      </div>
    </div>
  );
}
