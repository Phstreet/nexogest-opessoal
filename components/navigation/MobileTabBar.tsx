"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Hoje", icon: "⌂", active: (path: string) => path === "/" },
  { href: "/financeiro", label: "Finanças", icon: "◈", active: (path: string) => path.startsWith("/financeiro") },
  { href: "/rotina/agenda", label: "Agenda", icon: "▦", active: (path: string) => path.startsWith("/rotina/agenda") },
  { href: "/rotina/habitos", label: "Hábitos", icon: "↻", active: (path: string) => path.startsWith("/rotina/habitos") },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="nexo-mobile-tabbar" aria-label="Navegação principal móvel">
      {items.map((item) => {
        const active = item.active(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("nexo:toggle-mobile-nav"))}
        aria-label="Abrir mais opções de navegação"
      >
        <span aria-hidden="true">☰</span>
        <small>Mais</small>
      </button>
    </nav>
  );
}
