import { AppShell } from "@/components/AppShell";
import { currentUser } from "@/lib/session";
import { onEphemeralFs } from "@/lib/dataDir";

export const dynamic = "force-dynamic";

/**
 * Chrome for every authenticated route. Middleware guarantees a valid session
 * here, so `currentUser()` is the real identity.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <AppShell user={user} ephemeral={onEphemeralFs()}>
      {children}
    </AppShell>
  );
}
