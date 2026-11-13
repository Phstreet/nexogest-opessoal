
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  icon?: string;
};

const financeMenuItems: MenuItem[] = [
  { label: "Visão geral financeira", href: "/financeiro", icon: "◈" },
  { label: "Contas", href: "/financeiro/contas", icon: "▤" },
  { label: "Contas a pagar", href: "/financeiro/contas-a-pagar", icon: "↗" },
  { label: "Contas a receber", href: "/financeiro/contas-a-receber", icon: "↙" },
  { label: "Histórico financeiro", href: "/financeiro/historico", icon: "◷" },
  { label: "Investimentos", href: "/financeiro/investimentos", icon: "◉" },
  { label: "Reserva financeira", href: "/financeiro/reservas", icon: "◇" },
  { label: "Planejamento", href: "/financeiro/planejamento", icon: "▦" },
  { label: "Dashboard financeiro", href: "/financeiro/dashboard", icon: "▥" },
];

const routineMenuItems: MenuItem[] = [
  { label: "Visão geral da rotina", href: "/rotina", icon: "⌂" },
  { label: "Agenda diária", href: "/rotina/agenda", icon: "▦" },
  { label: "Tarefas", href: "/rotina/tarefas", icon: "☑" },
  { label: "Planejamento semanal", href: "/rotina/planejamento", icon: "▤" },
  { label: "Hábitos", href: "/rotina/habitos", icon: "↻" },
  { label: "Produtividade", href: "/rotina/produtividade", icon: "◷" },
];

const mainMenuItems: MenuItem[] = [
  { label: "Visão geral", href: "/", icon: "⌂" },
  ...financeMenuItems,
  ...routineMenuItems,
];

const FAVORITES_STORAGE_KEY = "nexo_navigation_favorites";
const SIDEBAR_STORAGE_KEY = "nexo_navigation_collapsed";

export default function MainNavigation() {
  const pathname = usePathname();

  const isFinanceRoute = pathname.startsWith("/financeiro");
  const isRoutineRoute = pathname.startsWith("/rotina");

  const [financeMenuOpen, setFinanceMenuOpen] = useState(isFinanceRoute);
  const [routineMenuOpen, setRoutineMenuOpen] = useState(isRoutineRoute);

  const [collapsed, setCollapsed] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const savedCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY);

      if (savedFavorites) {
        const parsed = JSON.parse(savedFavorites);

        if (Array.isArray(parsed)) {
          setFavorites(
            parsed.filter(
              (href): href is string =>
                typeof href === "string" &&
                mainMenuItems.some((item) => item.href === href)
            )
          );
        }
      }

      if (savedCollapsed !== null) {
        setCollapsed(savedCollapsed === "true");
      }
    } catch (error) {
      console.error("Erro ao carregar preferências da navegação:", error);
    } finally {
      setStorageLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;

    try {
      localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(favorites)
      );

      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch (error) {
      console.error("Erro ao salvar preferências da navegação:", error);
    }
  }, [favorites, collapsed, storageLoaded]);

  useEffect(() => {
    if (isFinanceRoute) {
      setFinanceMenuOpen(true);
    }

    if (isRoutineRoute) {
      setRoutineMenuOpen(true);
    }
  }, [pathname, isFinanceRoute, isRoutineRoute]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const isSearchShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k";

      if (isSearchShortcut) {
        event.preventDefault();
        setSearchOpen((current) => !current);
        setSearchTerm("");
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setSearchTerm("");
      }
    }

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) {
      const timeout = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);

      return () => window.clearTimeout(timeout);
    }
  }, [searchOpen]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedSearch) return mainMenuItems;

    return mainMenuItems.filter((item) =>
      item.label.toLocaleLowerCase("pt-BR").includes(normalizedSearch)
    );
  }, [searchTerm]);

  const favoriteItems = useMemo(
    () => mainMenuItems.filter((item) => favorites.includes(item.href)),
    [favorites]
  );

  function isActive(href: string) {
    return pathname === href;
  }

  function toggleFavorite(href: string) {
    setFavorites((current) =>
      current.includes(href)
        ? current.filter((item) => item !== href)
        : [...current, href]
    );
  }

  function handleSearchNavigation() {
    setSearchOpen(false);
    setSearchTerm("");
  }

  function renderFavoriteButton(item: MenuItem) {
    const isFavorite = favorites.includes(item.href);

    return (
      <button
        type="button"
        className={`nav-favorite-button ${
          isFavorite ? "is-favorite" : ""
        }`}
        onClick={() => toggleFavorite(item.href)}
        aria-label={
          isFavorite
            ? `Remover ${item.label} dos favoritos`
            : `Adicionar ${item.label} aos favoritos`
        }
        title={
          isFavorite
            ? "Remover dos favoritos"
            : "Adicionar aos favoritos"
        }
      >
        {isFavorite ? "★" : "☆"}
      </button>
    );
  }

  function renderSubmenu(items: MenuItem[], id: string) {
    return (
      <div className="nav-submenu" id={id}>
        {items.map((item) => (
          <div className="nav-subitem-row" key={item.href}>
            <Link
              href={item.href}
              className={`nav-subitem ${
                isActive(item.href) ? "active" : ""
              }`}
              aria-current={isActive(item.href) ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              {item.icon && (
                <span className="nav-subitem-icon">{item.icon}</span>
              )}
              <span className="nav-subitem-label">{item.label}</span>
            </Link>

            {renderFavoriteButton(item)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-brand-row">
          <Link href="/" className="brand" title="NEXO - Página inicial">
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

            <div className="brand-text">
              <div className="brand-name">NEXO</div>
              <div className="brand-subtitle">GESTÃO PESSOAL</div>
            </div>
          </Link>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={
              collapsed ? "Expandir menu lateral" : "Recolher menu lateral"
            }
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <div className="sidebar-section-label">MENU PRINCIPAL</div>

        <nav className="navigation" aria-label="Navegação principal">
          <div className="nav-link-row">
            <Link
              href="/"
              className={`nav-item ${isActive("/") ? "active" : ""}`}
              aria-current={isActive("/") ? "page" : undefined}
              title={collapsed ? "Visão geral" : undefined}
            >
              <span className="nav-icon">⌂</span>
              <span className="nav-item-label">Visão geral</span>
            </Link>

            {renderFavoriteButton(mainMenuItems[0])}
          </div>

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
              title={collapsed ? "Financeiro" : undefined}
            >
              <span className="nav-icon">◈</span>
              <span className="nav-finance-label">Financeiro</span>
              <span
                className={`nav-chevron ${
                  financeMenuOpen ? "open" : ""
                }`}
              >
                ›
              </span>
            </button>

            {financeMenuOpen &&
              renderSubmenu(financeMenuItems, "finance-submenu")}
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
              title={collapsed ? "Minha rotina" : undefined}
            >
              <span className="nav-icon">▤</span>
              <span className="nav-finance-label">Minha rotina</span>
              <span
                className={`nav-chevron ${
                  routineMenuOpen ? "open" : ""
                }`}
              >
                ›
              </span>
            </button>

            {routineMenuOpen &&
              renderSubmenu(routineMenuItems, "routine-submenu")}
          </div>
        </nav>

        {/* FAVORITOS */}
        <section className="sidebar-favorites">
          <div className="sidebar-section-label">
            <span>MEUS FAVORITOS</span>
          </div>

          {favoriteItems.length > 0 ? (
            <div className="favorites-list">
              {favoriteItems.map((item) => (
                <div className="nav-link-row" key={item.href}>
                  <Link
                    href={item.href}
                    className={`nav-item favorite-nav-item ${
                      isActive(item.href) ? "active" : ""
                    }`}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="nav-icon">★</span>
                    <span className="nav-item-label">{item.label}</span>
                  </Link>

                  <button
                    type="button"
                    className="nav-favorite-button is-favorite"
                    onClick={() => toggleFavorite(item.href)}
                    aria-label={`Remover ${item.label} dos favoritos`}
                    title="Remover dos favoritos"
                  >
                    ★
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="favorites-empty">
              <span>☆</span>
              <span className="favorites-empty-label">
                Adicione páginas aos favoritos
              </span>
            </div>
          )}
        </section>

        <div className="sidebar-bottom">
          <button
            type="button"
            className="sidebar-search-button"
            onClick={() => {
              setSearchOpen(true);
              setSearchTerm("");
            }}
            title="Buscar no NEXO"
          >
            <span className="nav-icon">⌕</span>
            <span className="sidebar-search-label">Buscar no NEXO</span>
            {!collapsed && <kbd>Ctrl K</kbd>}
          </button>

          <div className="sidebar-status">
            <span className="status-dot" />
            <span className="sidebar-status-label">
              Sistema operacional
            </span>
          </div>

          <div className="sidebar-version">NEXO · VERSÃO 2.0</div>
        </div>
      </aside>

      {/* BUSCA GLOBAL */}
      {searchOpen && (
        <div
          className="nexo-search-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleSearchNavigation();
            }
          }}
        >
          <section
            className="nexo-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Busca global do NEXO"
          >
            <div className="nexo-search-input-wrapper">
              <span className="nexo-search-icon">⌕</span>

              <input
                ref={searchInputRef}
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="O que você está procurando?"
                className="nexo-search-input"
              />

              <button
                type="button"
                className="nexo-search-close"
                onClick={handleSearchNavigation}
                aria-label="Fechar busca"
              >
                ESC
              </button>
            </div>

            <div className="nexo-search-results">
              <div className="nexo-search-section-label">
                {searchTerm.trim()
                  ? "RESULTADOS DA BUSCA"
                  : "PÁGINAS DISPONÍVEIS"}
              </div>

              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <div className="nexo-search-result-row" key={item.href}>
                    <Link
                      href={item.href}
                      className={`nexo-search-result ${
                        isActive(item.href) ? "active" : ""
                      }`}
                      onClick={handleSearchNavigation}
                    >
                      <span className="nexo-search-result-icon">
                        {item.icon || "•"}
                      </span>
                      <span>{item.label}</span>
                      {isActive(item.href) && (
                        <span className="nexo-search-current">
                          Página atual
                        </span>
                      )}
                    </Link>

                    <button
                      type="button"
                      className={`nexo-search-favorite ${
                        favorites.includes(item.href) ? "is-favorite" : ""
                      }`}
                      onClick={() => toggleFavorite(item.href)}
                      aria-label={
                        favorites.includes(item.href)
                          ? "Remover dos favoritos"
                          : "Adicionar aos favoritos"
                      }
                    >
                      {favorites.includes(item.href) ? "★" : "☆"}
                    </button>
                  </div>
                ))
              ) : (
                <div className="nexo-search-empty">
                  <span>⌕</span>
                  <strong>Nenhuma página encontrada</strong>
                  <p>
                    Tente pesquisar por outro nome ou palavra-chave.
                  </p>
                </div>
              )}
            </div>

            <div className="nexo-search-footer">
              <span>ESC para fechar</span>
              <span>Selecione uma página para navegar</span>
            </div>
          </section>
        </div>
      )}

      <style jsx global>{`
        /* CABEÇALHO DO MENU */
        .sidebar-brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .sidebar-brand-row .brand {
          min-width: 0;
        }

        .brand-text {
          min-width: 0;
        }

        .sidebar-toggle {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.04);
          color: #aeb4be;
          font-size: 19px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .sidebar-toggle:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        /* LINHAS DE NAVEGAÇÃO */
        .nav-link-row,
        .nav-subitem-row {
          display: flex;
          align-items: center;
          position: relative;
          width: 100%;
          min-width: 0;
        }

        .nav-link-row > .nav-item,
        .nav-subitem-row > .nav-subitem {
          flex: 1;
          min-width: 0;
        }

        .nav-favorite-button {
          width: 27px;
          height: 27px;
          flex: 0 0 27px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #737d8b;
          font-size: 15px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.18s ease, color 0.18s ease,
            background 0.18s ease;
        }

        .nav-link-row:hover > .nav-favorite-button,
        .nav-subitem-row:hover > .nav-favorite-button,
        .nav-favorite-button.is-favorite {
          opacity: 1;
        }

        .nav-favorite-button:hover,
        .nav-favorite-button.is-favorite {
          color: #e5b85c;
        }

        .nav-favorite-button:hover {
          background: rgba(229, 184, 92, 0.1);
        }

        .nav-subitem-row .nav-subitem {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-subitem-label {
          min-width: 0;
        }

        .sidebar .nav-group {
          position: relative;
        }

        .sidebar .nav-group > .nav-finance-parent {
          width: 100%;
        }

        .sidebar-favorites {
          margin-top: 18px;
        }

        .favorites-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .favorite-nav-item {
          min-width: 0;
        }

        .favorites-empty {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 12px;
          color: #7f8997;
          font-size: 12px;
        }

        .favorites-empty > span:first-child {
          font-size: 17px;
        }

        /* BUSCA NA PARTE INFERIOR */
        .sidebar-search-button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          margin-bottom: 14px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.035);
          color: #b8c0ca;
          text-align: left;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .sidebar-search-button:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.17);
        }

        .sidebar-search-button kbd {
          margin-left: auto;
          padding: 3px 5px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          color: #8993a1;
          font-size: 10px;
          white-space: nowrap;
        }

        /* MENU RECOLHIDO */
        .sidebar.sidebar-collapsed {
          width: 84px;
          min-width: 84px;
          flex: 0 0 84px;
          overflow: visible;
          transition: width 0.22s ease, flex-basis 0.22s ease;
        }

        .sidebar:not(.sidebar-collapsed) {
          transition: width 0.22s ease, flex-basis 0.22s ease;
        }

        .sidebar-collapsed .sidebar-brand-row {
          justify-content: center;
          flex-wrap: wrap;
        }

        .sidebar-collapsed .sidebar-brand-row .brand {
          justify-content: center;
        }

        .sidebar-collapsed .brand-text,
        .sidebar-collapsed .sidebar-section-label,
        .sidebar-collapsed .nav-finance-label,
        .sidebar-collapsed .nav-item-label,
        .sidebar-collapsed .nav-subitem-label,
        .sidebar-collapsed .sidebar-status-label,
        .sidebar-collapsed .sidebar-version,
        .sidebar-collapsed .favorites-empty-label,
        .sidebar-collapsed .sidebar-search-label,
        .sidebar-collapsed .sidebar-search-button kbd {
          display: none;
        }

        .sidebar-collapsed .sidebar-toggle {
          margin: 0 auto;
        }

        .sidebar-collapsed .nav-item {
          justify-content: center;
          padding-left: 8px;
          padding-right: 8px;
        }

        .sidebar-collapsed .nav-icon {
          margin: 0;
        }

        .sidebar-collapsed .nav-chevron {
          display: none;
        }

        .sidebar-collapsed .nav-link-row > .nav-favorite-button,
        .sidebar-collapsed .nav-subitem-row > .nav-favorite-button {
          display: none;
        }

        .sidebar-collapsed .nav-group > .nav-submenu {
          position: absolute;
          z-index: 80;
          top: 0;
          left: calc(100% + 10px);
          width: 245px;
          max-height: 65vh;
          overflow-y: auto;
          padding: 9px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 9px;
          background: #171c24;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.32);
        }

        .sidebar-collapsed .nav-subitem {
          padding: 10px;
        }

        .sidebar-collapsed .nav-subitem-label {
          display: inline;
        }

        .sidebar-collapsed .sidebar-search-button {
          justify-content: center;
          padding: 10px 5px;
        }

        .sidebar-collapsed .sidebar-status {
          justify-content: center;
        }

        .sidebar-collapsed .favorites-empty {
          justify-content: center;
          padding: 9px 0;
        }

        .sidebar-collapsed .favorite-nav-item {
          justify-content: center;
        }

        /* BUSCA GLOBAL */
        .nexo-search-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: min(15vh, 120px) 20px 30px;
          background: rgba(5, 8, 13, 0.72);
          backdrop-filter: blur(5px);
        }

        .nexo-search-dialog {
          width: 100%;
          max-width: 590px;
          max-height: min(680px, 75vh);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 13px;
          background: #171c24;
          color: #edf0f4;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
        }

        .nexo-search-input-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 17px 19px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
        }

        .nexo-search-icon {
          color: #9ba6b5;
          font-size: 23px;
        }

        .nexo-search-input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: none;
          background: transparent;
          color: #f5f6f8;
          font: inherit;
          font-size: 15px;
        }

        .nexo-search-input::placeholder {
          color: #7f8997;
        }

        .nexo-search-close {
          padding: 5px 7px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 5px;
          background: transparent;
          color: #aeb7c3;
          font-size: 10px;
          cursor: pointer;
        }

        .nexo-search-results {
          overflow-y: auto;
          padding: 13px;
        }

        .nexo-search-section-label {
          padding: 5px 9px 10px;
          color: #788392;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .nexo-search-result-row {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 3px;
        }

        .nexo-search-result {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 10px;
          border-radius: 7px;
          color: #cbd2dc;
          font-size: 13px;
          text-decoration: none;
          transition: 0.15s ease;
        }

        .nexo-search-result:hover,
        .nexo-search-result.active {
          background: rgba(255, 255, 255, 0.075);
          color: #fff;
        }

        .nexo-search-result-icon {
          width: 22px;
          color: #aab4c2;
          text-align: center;
          font-size: 16px;
        }

        .nexo-search-current {
          margin-left: auto;
          color: #8794a5;
          font-size: 10px;
        }

        .nexo-search-favorite {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #7f8997;
          font-size: 16px;
          cursor: pointer;
        }

        .nexo-search-favorite:hover,
        .nexo-search-favorite.is-favorite {
          color: #e5b85c;
        }

        .nexo-search-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 38px 15px;
          color: #cbd2dc;
          text-align: center;
        }

        .nexo-search-empty > span {
          color: #8994a3;
          font-size: 30px;
        }

        .nexo-search-empty strong {
          font-size: 13px;
        }

        .nexo-search-empty p {
          margin: 0;
          color: #8792a0;
          font-size: 12px;
        }

        .nexo-search-footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 11px 17px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: #7f8997;
          font-size: 10px;
        }

        @media (max-width: 760px) {
          .sidebar.sidebar-collapsed {
            width: 70px;
            min-width: 70px;
            flex-basis: 70px;
          }

          .nexo-search-overlay {
            padding: 9vh 12px 20px;
          }

          .nexo-search-dialog {
            max-height: 82vh;
          }

          .nexo-search-footer {
            flex-wrap: wrap;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sidebar,
          .sidebar-toggle,
          .sidebar-search-button,
          .nav-favorite-button {
            transition: none !important;
          }
        }
      `}</style>
    </>
  );
}
