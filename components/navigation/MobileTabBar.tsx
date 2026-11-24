"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Hoje", icon: "◷", match: (path: string) => path === "/" },
  { href: "/financeiro", label: "Finanças", icon: "▤", match: (path: string) => path.startsWith("/financeiro") },
  { href: "/rotina/agenda", label: "Agenda", icon: "▦", match: (path: string) => path.startsWith("/rotina/agenda") },
  { href: "/rotina/habitos", label: "Hábitos", icon: "◇", match: (path: string) => path.startsWith("/rotina/habitos") }
];

export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="nexo-mobile-tabbar" aria-label="Navegação principal">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? "active" : ""}>
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}
