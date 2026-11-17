import type { ReactNode } from "react";
import MainNavigation from "../navigation/MainNavigation";
import Header from "./Header";
import AccountAccess from "@/components/auth/AccountAccess";
import NexoSyncManager from "@/components/auth/NexoSyncManager";

type AppLayoutProps = {
  children: ReactNode;
  header?: ReactNode;
};

export default function AppLayout({
  children,
  header,
}: Readonly<AppLayoutProps>) {
  return (
    <main className="app-shell">
      <MainNavigation />
      <AccountAccess />
      <NexoSyncManager />

      <section className="main-area">
        {header ?? <Header />}
        {children}
      </section>
    </main>
  );
}