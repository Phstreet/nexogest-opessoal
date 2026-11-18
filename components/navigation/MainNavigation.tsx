
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import { fetchRemoteCollections, saveRemoteCollection } from "@/lib/supabase/client";

import {
  financeMenuItems,
  routineMenuItems,
  reportsMenuItems,
  settingsMenuItems,
  mainMenuItems,
  type MenuItem,
} from "./navigationConfig";

export default function MainNavigation() {
  const pathname = usePathname();
  const { session, loading: authLoading } = useNexoAuth();
  const [activeSettingsTab, setActiveSettingsTab] = useState("");

  const isFinanceRoute = pathname.startsWith("/financeiro");
  const isRoutineRoute = pathname.startsWith("/rotina");
  const isReportsRoute = pathname.startsWith("/relatorios");
  const isSettingsRoute = pathname.startsWith("/configuracoes");

  const [financeMenuOpen, setFinanceMenuOpen] = useState(false);
  const [routineMenuOpen, setRoutineMenuOpen] = useState(false);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");
  const preferencesRevisionRef = useRef(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function loadNavigationPreferences() {
      if (authLoading) return;
      if (!session) {
        setFavorites([]);
        setCollapsed(false);
        setPreferencesError("Entre na sua conta para carregar as preferências de navegação.");
        setPreferencesLoaded(true);
        return;
      }
      try {
        const collections = await fetchRemoteCollections();
        if (!active) return;
        const row = collections.find((item) => item.data_key === "nexo_preferences");
        const payload = row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? row.payload as Record<string, unknown>
          : {};
        const savedFavorites = payload.navigationFavorites;
        setFavorites(Array.isArray(savedFavorites)
          ? savedFavorites.filter((href): href is string =>
              typeof href === "string" && mainMenuItems.some((item) => item.href === href))
          : []);
        setCollapsed(payload.sidebarCollapsed === true);
        preferencesRevisionRef.current = Number(row?.revision) || 0;
        setPreferencesError("");
      } catch (error) {
        if (active) setPreferencesError(error instanceof Error ? error.message : "Não foi possível carregar as preferências da nuvem.");
      } finally {
        if (active) setPreferencesLoaded(true);
      }
    }
    void loadNavigationPreferences();
    return () => { active = false; };
  }, [authLoading, session]);

  async function persistNavigationPreferences(nextFavorites: string[], nextCollapsed: boolean) {
    if (!session || !preferencesLoaded) throw new Error("As preferências ainda não foram carregadas.");
    const collections = await fetchRemoteCollections();
    const row = collections.find((item) => item.data_key === "nexo_preferences");
    const latest = row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload as Record<string, unknown>
      : {};
    const result = await saveRemoteCollection("nexo_preferences", {
      ...latest,
      navigationFavorites: nextFavorites,
      sidebarCollapsed: nextCollapsed,
    }, Number(row?.revision) || 0);
    if (!result.saved) {
      const refreshed = await fetchRemoteCollections();
      const current = refreshed.find((item) => item.data_key === "nexo_preferences");
      const payload = current?.payload && typeof current.payload === "object" && !Array.isArray(current.payload)
        ? current.payload as Record<string, unknown>
        : {};
      setFavorites(Array.isArray(payload.navigationFavorites)
        ? payload.navigationFavorites.filter((href): href is string =>
            typeof href === "string" && mainMenuItems.some((item) => item.href === href))
        : []);
      setCollapsed(payload.sidebarCollapsed === true);
      preferencesRevisionRef.current = Number(current?.revision) || 0;
      throw new Error("As preferências foram alteradas em outro dispositivo. A versão mais recente foi carregada.");
    }
    preferencesRevisionRef.current = result.current_revision ?? preferencesRevisionRef.current + 1;
    setPreferencesError("");
  }

  // Fecha os submenus sempre que a rota mudar.
  useEffect(() => {
    setFinanceMenuOpen(false);
    setRoutineMenuOpen(false);
    setReportsMenuOpen(false);
    setSettingsMenuOpen(false);
    setActiveSettingsTab(new URLSearchParams(window.location.search).get("tab") || "");
  }, [pathname]);

  // Fecha os submenus também quando a sidebar for compactada.
  useEffect(() => {
    if (collapsed) {
      setFinanceMenuOpen(false);
      setRoutineMenuOpen(false);
      setReportsMenuOpen(false);
      setSettingsMenuOpen(false);
    }
  }, [collapsed]);

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
    const [targetPath, targetQuery] = href.split("?");
    if (pathname !== targetPath) return false;
    if (!targetQuery) return true;

    const params = new URLSearchParams(targetQuery);
    const tab = params.get("tab");
    return !tab || activeSettingsTab === tab;
  }

  function toggleFavorite(href: string) {
    const nextFavorites = favorites.includes(href)
      ? favorites.filter((item) => item !== href)
      : [...favorites, href];
    void persistNavigationPreferences(nextFavorites, collapsed)
      .then(() => setFavorites(nextFavorites))
      .catch((error) => setPreferencesError(error instanceof Error ? error.message : "Não foi possível salvar a preferência."));
  }

  function toggleCollapsed() {
    const nextCollapsed = !collapsed;
    void persistNavigationPreferences(favorites, nextCollapsed)
      .then(() => setCollapsed(nextCollapsed))
      .catch((error) => setPreferencesError(error instanceof Error ? error.message : "Não foi possível salvar a preferência."));
  }

  // Fecha os submenus ao navegar, mantendo a largura escolhida pelo usuário.
  function handleNavigation() {
    setFinanceMenuOpen(false);
    setRoutineMenuOpen(false);
    setReportsMenuOpen(false);
    setSettingsMenuOpen(false);
    setSearchOpen(false);
    setSearchTerm("");
  }

  function handleSearchNavigation() {
    setSearchOpen(false);
    setSearchTerm("");
    setFinanceMenuOpen(false);
    setRoutineMenuOpen(false);
    setReportsMenuOpen(false);
    setSettingsMenuOpen(false);
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

  function renderSubmenu(items: MenuItem[], id: string, isOpen: boolean) {
    return (
      <div className={`nav-submenu ${isOpen ? "is-open" : ""}`} id={id} aria-hidden={!isOpen}>
        {items.map((item) => (
          <div className="nav-subitem-row" key={item.href}>
            <Link
              href={item.href}
              className={`nav-subitem ${
                isActive(item.href) ? "active" : ""
              }`}
              aria-current={isActive(item.href) ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              onClick={() => {
                const query = item.href.split("?")[1] || "";
                setActiveSettingsTab(new URLSearchParams(query).get("tab") || "");
                handleNavigation();
              }}
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
        {preferencesError && <div role="alert" className="nav-preferences-error">{preferencesError}</div>}
        <div className="sidebar-brand-row">
          <Link
            href="/"
            className="brand"
            title="NEXO - Página inicial"
            onClick={handleNavigation}
          >
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
            onClick={toggleCollapsed}
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
              title={collapsed ? "Central do Dia" : undefined}
              onClick={handleNavigation}
            >
              <span className="nav-icon">⌂</span>
              <span className="nav-item-label">Central do Dia</span>
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
                if (collapsed) {
                  setCollapsed(false);
                  setFinanceMenuOpen(true);
                  setRoutineMenuOpen(false);
                  setReportsMenuOpen(false);
                  setSettingsMenuOpen(false);
                  return;
                }

                setFinanceMenuOpen((current) => !current);
                setRoutineMenuOpen(false);
                setReportsMenuOpen(false);
                setSettingsMenuOpen(false);
              }}
              aria-expanded={financeMenuOpen && !collapsed}
              aria-controls="finance-submenu"
              title={collapsed ? "Financeiro" : undefined}
            >
              <span className="nav-icon">◈</span>
              <span className="nav-finance-label">Financeiro</span>
              <span
                className={`nav-chevron ${
                  financeMenuOpen && !collapsed ? "open" : ""
                }`}
              >
                ›
              </span>
            </button>

            {!collapsed && renderSubmenu(financeMenuItems, "finance-submenu", financeMenuOpen)}
          </div>

          {/* ROTINA */}
          <div className="nav-group">
            <button
              type="button"
              className={`nav-item nav-finance-parent ${isRoutineRoute ? "active" : ""}`}
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false);
                  setRoutineMenuOpen(true);
                  setFinanceMenuOpen(false);
                  setReportsMenuOpen(false);
                  setSettingsMenuOpen(false);
                  return;
                }
                setRoutineMenuOpen((current) => !current);
                setFinanceMenuOpen(false);
                setReportsMenuOpen(false);
                setSettingsMenuOpen(false);
              }}
              aria-expanded={routineMenuOpen && !collapsed}
              aria-controls="routine-submenu"
              title={collapsed ? "Rotina" : undefined}
            >
              <span className="nav-icon">▤</span>
              <span className="nav-finance-label">Rotina</span>
              <span className={`nav-chevron ${routineMenuOpen && !collapsed ? "open" : ""}`}>›</span>
            </button>
            {!collapsed && renderSubmenu(routineMenuItems, "routine-submenu", routineMenuOpen)}
          </div>

          {/* RELATÓRIOS */}
          <div className="nav-group">
            <button
              type="button"
              className={`nav-item nav-finance-parent ${isReportsRoute ? "active" : ""}`}
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false);
                  setReportsMenuOpen(true);
                  setFinanceMenuOpen(false);
                  setRoutineMenuOpen(false);
                  setSettingsMenuOpen(false);
                  return;
                }
                setReportsMenuOpen((current) => !current);
                setFinanceMenuOpen(false);
                setRoutineMenuOpen(false);
                setSettingsMenuOpen(false);
              }}
              aria-expanded={reportsMenuOpen && !collapsed}
              aria-controls="reports-submenu"
              title={collapsed ? "Relatórios" : undefined}
            >
              <span className="nav-icon">▥</span>
              <span className="nav-finance-label">Relatórios</span>
              <span className={`nav-chevron ${reportsMenuOpen && !collapsed ? "open" : ""}`}>›</span>
            </button>
            {!collapsed && renderSubmenu(reportsMenuItems, "reports-submenu", reportsMenuOpen)}
          </div>

          {/* CONFIGURAÇÕES */}
          <div className="nav-group">
            <button
              type="button"
              className={`nav-item nav-finance-parent ${isSettingsRoute ? "active" : ""}`}
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false);
                  setSettingsMenuOpen(true);
                  setFinanceMenuOpen(false);
                  setRoutineMenuOpen(false);
                  setReportsMenuOpen(false);
                  return;
                }
                setSettingsMenuOpen((current) => !current);
                setFinanceMenuOpen(false);
                setRoutineMenuOpen(false);
                setReportsMenuOpen(false);
              }}
              aria-expanded={settingsMenuOpen && !collapsed}
              aria-controls="settings-submenu"
              title={collapsed ? "Configurações" : undefined}
            >
              <span className="nav-icon">⚙</span>
              <span className="nav-finance-label">Configurações</span>
              <span className={`nav-chevron ${settingsMenuOpen && !collapsed ? "open" : ""}`}>›</span>
            </button>
            {!collapsed && renderSubmenu(settingsMenuItems, "settings-submenu", settingsMenuOpen)}
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
                    onClick={handleNavigation}
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

        /* Submenus não aparecem como pop-up na sidebar compacta. */
        .sidebar-collapsed .nav-group > .nav-submenu {
          display: none !important;
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

        /* Transições contínuas dos submenus: anima abertura e fechamento. */
        .sidebar {
          transition:
            width 280ms cubic-bezier(0.22, 1, 0.36, 1),
            min-width 280ms cubic-bezier(0.22, 1, 0.36, 1),
            flex-basis 280ms cubic-bezier(0.22, 1, 0.36, 1),
            padding 220ms ease;
          will-change: width;
        }

        .sidebar .brand-text,
        .sidebar .sidebar-section-label,
        .sidebar .nav-finance-label,
        .sidebar .nav-item-label,
        .sidebar .sidebar-status-label,
        .sidebar .sidebar-version,
        .sidebar .favorites-empty-label,
        .sidebar .sidebar-search-label {
          transition: opacity 160ms ease, transform 220ms ease;
        }

        .sidebar .nav-submenu {
          max-height: 0;
          overflow: hidden;
          padding-top: 0;
          padding-bottom: 0;
          margin-top: 0;
          margin-bottom: 0;
          border-left-color: transparent;
          opacity: 0;
          transform: translateY(-6px);
          visibility: hidden;
          pointer-events: none;
          transition:
            max-height 320ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 180ms ease,
            transform 220ms ease,
            padding 220ms ease,
            margin 220ms ease,
            border-color 180ms ease,
            visibility 0s linear 320ms;
        }

        .sidebar .nav-submenu.is-open {
          max-height: 720px;
          overflow: hidden;
          padding: 5px 0 5px 12px;
          margin: 4px 0 8px 18px;
          border-left-color: #414147;
          opacity: 1;
          transform: translateY(0);
          visibility: visible;
          pointer-events: auto;
          transition:
            max-height 360ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 220ms ease 40ms,
            transform 260ms ease,
            padding 220ms ease,
            margin 220ms ease,
            border-color 180ms ease,
            visibility 0s;
        }

        .sidebar .nav-chevron {
          transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .sidebar .nav-item,
        .sidebar .nav-subitem,
        .sidebar .nav-favorite-button,
        .sidebar .sidebar-toggle,
        .sidebar .sidebar-search-button {
          transition:
            color 180ms ease,
            background-color 180ms ease,
            border-color 180ms ease,
            box-shadow 180ms ease,
            transform 220ms ease,
            opacity 180ms ease;
        }

        .sidebar .nav-item:active,
        .sidebar .sidebar-toggle:active,
        .sidebar .sidebar-search-button:active {
          transform: scale(0.985);
        }

        @media (max-width: 760px) {
          .sidebar .nav-submenu:not(.is-open) {
            max-height: 0 !important;
            overflow: hidden !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            border-color: transparent !important;
          }

          .sidebar .nav-submenu.is-open {
            max-height: 900px;
            overflow: visible !important;
            padding: 8px !important;
            margin: 4px 0 10px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sidebar,
          .sidebar *,
          .sidebar *::before,
          .sidebar *::after {
            transition: none !important;
            animation: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </>
  );
}
