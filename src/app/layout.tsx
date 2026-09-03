import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { PwaProvider } from "@/components/PwaProvider";
import { currentRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Throughline Coordinate — MVP",
  description:
    "The operating intelligence layer for care coordination across organisational boundaries. Synthetic demonstration.",
  manifest: "/manifest.webmanifest",
  applicationName: "Throughline",
  appleWebApp: { capable: true, title: "Throughline", statusBarStyle: "default" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#12514e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const role = await currentRole();
  return (
    <html lang="en-GB">
      <body>
        <PwaProvider>
          <AppShell role={role}>{children}</AppShell>
        </PwaProvider>
      </body>
    </html>
  );
}
