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
      <NexoSyncManager />

      <section className="main-area">
        <div className="nexo-account-slot"><AccountAccess /></div>
        {header ?? <Header />}
        {children}
      </section>
    </main>
  );
}