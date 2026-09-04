import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaProvider } from "@/components/PwaProvider";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
