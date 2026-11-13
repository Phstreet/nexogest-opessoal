import type { ReactNode } from "react";
import AppLayout from "../../components/layout/AppLayout";

export default function FinanceiroLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <AppLayout>{children}</AppLayout>;
}