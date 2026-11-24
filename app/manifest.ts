import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NEXO",
    short_name: "NEXO",
    description: "Gestão pessoal de finanças, rotina, agenda, hábitos e objetivos.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    dir: "ltr",
    background_color: "#101012",
    theme_color: "#101012",
    categories: ["finance", "productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    shortcuts: [
      { name: "Central do Dia", short_name: "Hoje", description: "Abra sua Central do Dia.", url: "/?source=pwa" },
      { name: "Contas a pagar", short_name: "Pagar", description: "Consulte suas contas a pagar.", url: "/financeiro/contas-a-pagar?source=pwa" },
      { name: "Agenda", short_name: "Agenda", description: "Abra sua agenda.", url: "/rotina/agenda?source=pwa" },
      { name: "Hábitos", short_name: "Hábitos", description: "Acompanhe seus hábitos.", url: "/rotina/habitos?source=pwa" }
    ]
  };
}
