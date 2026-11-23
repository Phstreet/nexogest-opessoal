import "./globals.css";
import "./silver-executive.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { NexoAuthProvider } from "@/contexts/NexoAuthProvider";
import { NexoConfirmProvider } from "@/contexts/NexoConfirmProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

const APP_NAME = "NEXO";
const APP_DESCRIPTION =
  "NEXO: sua plataforma inteligente para organizar finanças, rotina, objetivos e vida pessoal.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  applicationName: APP_NAME,
  title: {
    default: "NEXO | Gestão Pessoal",
    template: "%s | NEXO",
  },
  description: APP_DESCRIPTION,
  keywords: [
    "gestão pessoal",
    "finanças pessoais",
    "rotina",
    "objetivos",
    "produtividade",
  ],
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "NEXO | Gestão Pessoal",
    description:
      "Planeje com clareza, organize suas prioridades e construa seus resultados.",
    url: "/",
    siteName: APP_NAME,
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NEXO | Gestão Pessoal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXO | Gestão Pessoal",
    description: "Sua plataforma inteligente de gestão pessoal.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0f",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <a
          href="#conteudo-principal"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-black"
        >
          Pular para o conteúdo
        </a>

        <NexoConfirmProvider>
          <NexoAuthProvider>
            <div id="conteudo-principal">{children}</div>
          </NexoAuthProvider>
        </NexoConfirmProvider>

        <Analytics />
      </body>
    </html>
  );
}
