import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { currentRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Throughline Coordinate — MVP",
  description:
    "The operating intelligence layer for care coordination across organisational boundaries. Synthetic demonstration.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const role = await currentRole();
  return (
    <html lang="en-GB">
      <body>
        <AppShell role={role}>{children}</AppShell>
      </body>
    </html>
  );
}
