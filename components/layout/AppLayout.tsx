import type { ReactNode } from "react";
import MainNavigation from "../navigation/MainNavigation";
import Header from "./Header";

export default function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <main className="app-shell">
      <MainNavigation />

      <section className="main-area">
        <Header />

        <div className="nexo-layout-content">{children}</div>
      </section>
    </main>
  );
}