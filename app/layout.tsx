
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NEXO | Gestão Pessoal',
  description:
    'NEXO: sua plataforma inteligente para organizar finanças, rotina, objetivos e vida pessoal.',
  applicationName: 'NEXO',
  openGraph: {
    title: 'NEXO | Gestão Pessoal',
    description:
      'Planeje com clareza, organize suas prioridades e construa seus resultados.',
    siteName: 'NEXO',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'NEXO | Gestão Pessoal',
    description:
      'Sua plataforma inteligente de gestão pessoal.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
