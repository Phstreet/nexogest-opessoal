import type { MetadataRoute } from "next";

const description =
  "NEXO: organize suas finanças, rotina, metas e vida pessoal em um só lugar.";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NEXO",
    short_name: "NEXO",
    description,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    background_color: "#101012",
    theme_color: "#101012",
    categories: ["finance", "productivity", "lifestyle"],
    icons: [
      { src: "/icons/nexo-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/nexo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/nexo-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/nexo-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Central do Dia", short_name: "Central", url: "/?source=pwa-shortcut", icons: [{ src: "/icons/nexo-192.png", sizes: "192x192" }] },
      { name: "Contas a pagar", short_name: "A pagar", url: "/financeiro/contas-a-pagar?source=pwa-shortcut", icons: [{ src: "/icons/nexo-192.png", sizes: "192x192" }] },
      { name: "Agenda", short_name: "Agenda", url: "/rotina/agenda?source=pwa-shortcut", icons: [{ src: "/icons/nexo-192.png", sizes: "192x192" }] },
      { name: "Hábitos", short_name: "Hábitos", url: "/rotina/habitos?source=pwa-shortcut", icons: [{ src: "/icons/nexo-192.png", sizes: "192x192" }] },
    ],
  };
}
