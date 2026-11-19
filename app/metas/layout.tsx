import type { ReactNode } from "react";
import AppLayout from "@/components/layout/AppLayout";

export default function MetasLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppLayout>{children}</AppLayout>;
}
