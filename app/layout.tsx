import "./globals.css";
import "./progress-utilities.css";
import "./settings.css";
import "./pwa.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { NexoAuthProvider } from "@/contexts/NexoAuthProvider";
import { NexoConfirmProvider } from "@/contexts/NexoConfirmProvider";
import { SettingsProvider } from "@/contexts/SettingsProvider";
import InstallPrompt from "@/components/pwa/InstallPrompt";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NEXO | Gestão Pessoal",
  description:
    "NEXO: sua plataforma inteligente para organizar finanças, rotina, objetivos e vida pessoal.",
  applicationName: "NEXO",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "NEXO",
    statusBarStyle: "black-translucent",
    startupImage: [
      { url: "/icons/apple-splash-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/icons/apple-splash-1206x2622.png", media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/icons/apple-splash-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/icons/apple-splash-2048x2732.png", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" },
    ],
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "NEXO | Gestão Pessoal",
    description:
      "Planeje com clareza, organize suas prioridades e construa seus resultados.",
    siteName: "NEXO",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "NEXO | Gestão Pessoal",
    description: "Sua plataforma inteligente de gestão pessoal.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#101012" },
    { media: "(prefers-color-scheme: light)", color: "#101012" },
  ],
};

const settingsBootstrap =
  'try { var appearanceCookie = document.cookie.split("; ").find(function(item) { return item.indexOf("nexo_appearance_v2=") === 0; }); var cached = appearanceCookie ? JSON.parse(decodeURIComponent(appearanceCookie.slice("nexo_appearance_v2=".length))) : JSON.parse((localStorage.getItem("nexo_settings_bootstrap_v2") || localStorage.getItem("nexo_settings_bootstrap_v1")) || "{}"); var root = document.documentElement; var appearance = cached.appearance || {}; var finance = cached.finance || {}; var theme = appearance.theme || "graphite"; if (theme === "dark") theme = "graphite"; if (theme === "system") theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "graphite"; root.dataset.theme = theme; root.dataset.accent = appearance.accent || "silver"; root.dataset.density = appearance.density || "comfortable"; root.dataset.fontScale = appearance.fontScale || "normal"; root.dataset.cornerRadius = appearance.cornerRadius || "medium"; root.dataset.reduceMotion = String(appearance.reduceMotion === true); root.dataset.highContrast = String(appearance.highContrast === true); root.dataset.privacyMode = String(finance.hideValues === true); } catch (_) {}';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? "";

  return (
    <html lang="pt-BR">
      <head>
        <meta name="csp-nonce" content={nonce} />
        <script
          id="nexo-settings-bootstrap"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: settingsBootstrap }}
        />
      </head>
      <body className={inter.className}>
        <NexoConfirmProvider>
          <NexoAuthProvider>
            <SettingsProvider>{children}</SettingsProvider>
          </NexoAuthProvider>
        </NexoConfirmProvider>
        <InstallPrompt mode="banner" />
        <Analytics />
      </body>
    </html>
  );
}
