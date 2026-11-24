import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { NexoAuthProvider } from "@/contexts/NexoAuthProvider";
import { NexoConfirmProvider } from "@/contexts/NexoConfirmProvider";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // A leitura dos headers torna o layout dinâmico e permite ao Next.js
  // aplicar o nonce de proxy.ts aos scripts SSR do framework.
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? "";

  return (
    <html lang="pt-BR">
      <head>
        <meta name="csp-nonce" content={nonce} />
      </head>
      <body className={inter.className}>
        <NexoConfirmProvider>
          <NexoAuthProvider>{children}</NexoAuthProvider>
        </NexoConfirmProvider>
        <Analytics />
      </body>
    </html>
  );
}
