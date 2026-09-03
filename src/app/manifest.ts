import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Throughline Coordinate",
    short_name: "Throughline",
    description:
      "The operating intelligence layer for care coordination across organisational boundaries. Synthetic demonstration.",
    start_url: "/queue",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#eef4f3",
    theme_color: "#12514e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Attention queue", url: "/queue" },
      { name: "Worklist", url: "/worklist" },
    ],
  };
}
