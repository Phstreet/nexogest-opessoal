import "./globals.css";
import "./progress-utilities.css";
import "./settings.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { NexoAuthProvider } from "@/contexts/NexoAuthProvider";
import { NexoConfirmProvider } from "@/contexts/NexoConfirmProvider";
import { SettingsProvider } from "@/contexts/SettingsProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NEXO | Gestão Pessoal",
  description:
    "NEXO: sua plataforma inteligente para organizar finanças, rotina, objetivos e vida pessoal.",
  applicationName: "NEXO",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
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

const settingsBootstrap = \`try {
  var cached = JSON.parse(localStorage.getItem("nexo_settings_bootstrap_v1") || "{}");
  var root = document.documentElement;
  var appearance = cached.appearance || {};
  var finance = cached.finance || {};
  var theme = appearance.theme || "dark";
  if (theme === "system") theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  root.dataset.theme = theme;
  root.dataset.accent = appearance.accent || "silver";
  root.dataset.density = appearance.density || "comfortable";
  root.dataset.fontScale = appearance.fontScale || "normal";
  root.dataset.reduceMotion = String(appearance.reduceMotion === true);
  root.dataset.highContrast = String(appearance.highContrast === true);
  root.dataset.privacyMode = String(finance.hideValues === true);
} catch (_) {}\`;

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
        <Analytics />
      </body>
    </html>
  );
}
