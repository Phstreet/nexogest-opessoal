import type { ReactNode } from "react";
import MainNavigation from "../navigation/MainNavigation";
import Header from "./Header";
import { PageShell } from "@/components/ui/DashboardPrimitives";

type AppLayoutProps = {
  children: ReactNode;
  header?: ReactNode;
};

export default function AppLayout({
  children,
  header,
}: Readonly<AppLayoutProps>) {
  return (
    <main id="nexo-app" className="app-shell">
      <MainNavigation />

      <section className="main-area">
        {header ?? <Header />}
        <PageShell>{children}</PageShell>
      </section>
    </main>
  );
}
