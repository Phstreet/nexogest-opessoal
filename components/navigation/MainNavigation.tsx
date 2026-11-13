
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const financeMenuItems = [
  { label: "Visão geral financeira", href: "/financeiro" },
  { label: "Contas", href: "/financeiro/contas" },
  { label: "Contas a pagar", href: "/financeiro/contas-a-pagar" },
  { label: "Contas a receber", href: "/financeiro/contas-a-receber" },
  { label: "Histórico financeiro", href: "/financeiro/historico" },
  { label: "Investimentos", href: "/financeiro/investimentos" },
  { label: "Reserva financeira", href: "/financeiro/reservas" },
  { label: "Planejamento", href: "/financeiro/planejamento" },
  { label: "Dashboard financeiro", href: "/financeiro/dashboard" },
];

const routineMenuItems = [
  { label: "Visão geral da rotina", href: "/rotina", icon: "⌂" },
  { label: "Agenda diária", href: "/rotina/agenda", icon: "▦" },
  { label: "Tarefas", href: "/rotina/tarefas", icon: "☑" },
  { label: "Planejamento semanal", href: "/rotina/planejamento", icon: "▤" },
  { label: "Hábitos", href: "/rotina/habitos", icon: "↻" },
  { label: "Produtividade", href: "/rotina/produtividade", icon: "◷" },
];

export default function MainNavigation() {
  const pathname = usePathname();

  const isFinanceRoute = pathname.startsWith("/financeiro");
  const isRoutineRoute = pathname.startsWith("/rotina");

  const [financeMenuOpen, setFinanceMenuOpen] = useState(isFinanceRoute);
  const [routineMenuOpen, setRoutineMenuOpen] = useState(isRoutineRoute);

  useEffect(() => {
    if (isFinanceRoute) {
      setFinanceMenuOpen(true);
      setRoutineMenuOpen(false);
    } else if (isRoutineRoute) {
      setRoutineMenuOpen(true);
      setFinanceMenuOpen(false);
    }
  }, [pathname, isFinanceRoute, isRoutineRoute]);

  function isActive(href: string) {
    return pathname === href;
  }

  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <svg
          className="brand-symbol"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="NEXO"
        >
          <rect
            x="1"
            y="1"
            width="38"
            height="38"
            rx="7"
            stroke="#AEB4BE"
            strokeWidth="1"
          />
          <path
            d="M11 29V11L29 29V11"
            stroke="#F5F5F6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div>
          <div className="brand-name">NEXO</div>
          <div className="brand-subtitle">GESTÃO PESSOAL</div>
        </div>
      </Link>

      <div className="sidebar-section-label">MENU PRINCIPAL</div>

      <nav className="navigation" aria-label="Navegação principal">
        <Link
          href="/"
          className={`nav-item ${isActive("/") ? "active" : ""}`}
          aria-current={isActive("/") ? "page" : undefined}
        >
          <span className="nav-icon">⌂</span>
          <span>Visão geral</span>
        </Link>

        {/* FINANCEIRO */}
        <div className="nav-group">
          <button
            type="button"
            className={`nav-item nav-finance-parent ${
              isFinanceRoute ? "active" : ""
            }`}
            onClick={() => {
              setFinanceMenuOpen((current) => !current);
              setRoutineMenuOpen(false);
            }}
            aria-expanded={financeMenuOpen}
            aria-controls="finance-submenu"
          >
            <span className="nav-icon">◈</span>
            <span className="nav-finance-label">Financeiro</span>
            <span className={`nav-chevron ${financeMenuOpen ? "open" : ""}`}>
              ›
            </span>
          </button>

          {financeMenuOpen && (
            <div className="nav-submenu" id="finance-submenu">
              {financeMenuItems.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className={`nav-subitem ${
                    isActive(item.href) ? "active" : ""
                  }`}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* MINHA ROTINA */}
        <div className="nav-group">
          <button
            type="button"
            className={`nav-item nav-finance-parent ${
              isRoutineRoute ? "active" : ""
            }`}
            onClick={() => {
              setRoutineMenuOpen((current) => !current);
              setFinanceMenuOpen(false);
            }}
            aria-expanded={routineMenuOpen}
            aria-controls="routine-submenu"
          >
            <span className="nav-icon">▤</span>
            <span className="nav-finance-label">Minha rotina</span>
            <span className={`nav-chevron ${routineMenuOpen ? "open" : ""}`}>
              ›
            </span>
          </button>

          {routineMenuOpen && (
            <div className="nav-submenu" id="routine-submenu">
              {routineMenuItems.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className={`nav-subitem ${
                    isActive(item.href) ? "active nav-subitem-main" : ""
                  }`}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  <span className="nav-subitem-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-status">
          <span className="status-dot" />
          Sistema operacional
        </div>

        <div className="sidebar-version">NEXO · VERSÃO 2.0</div>
      </div>
    </aside>
  );
}
