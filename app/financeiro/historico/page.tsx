
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MovementType =
  | "Receita"
  | "Despesa"
  | "Transferência"
  | "Aplicação"
  | "Reserva";

type Transaction = {
  id: string;
  description: string;
  type: MovementType;
  amount: number;
  date: string;
  category?: string;
  subcategory?: string;
  account?: string;
  destination?: string;
  method?: string;
  status?: string;
  recurrence?: string;
  reserveType?: string;
  investment?: string;
  institution?: string;
  [key: string]: unknown;
};

const STORAGE_KEY = "nexo_transactions";

const financeNavigation = [
  { label: "Visão geral", href: "/financeiro", icon: "⌂" },
  { label: "Contas", href: "/financeiro/contas", icon: "▣" },
  { label: "Contas a pagar", href: "/financeiro/contas-a-pagar", icon: "↓" },
  { label: "Contas a receber", href: "/financeiro/contas-a-receber", icon: "↑" },
  { label: "Histórico financeiro", href: "/financeiro/historico", icon: "↻" },
  { label: "Investimentos", href: "/financeiro/investimentos", icon: "◈" },
  { label: "Reserva financeira", href: "/financeiro/reservas", icon: "▣" },
  { label: "Planejamento", href: "/financeiro/planejamento", icon: "▤" },
  { label: "Dashboard financeiro", href: "/financeiro/dashboard", icon: "▥" },
];

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDate = (date: string) => {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("pt-BR");
};

const isCancelled = (status?: string) =>
  (status || "").toLowerCase().includes("cancel");

const getTypeClass = (type: MovementType) => {
  switch (type) {
    case "Receita":
      return "income";
    case "Despesa":
      return "expense";
    case "Transferência":
      return "transfer";
    case "Aplicação":
      return "investment";
    case "Reserva":
      return "reserve";
    default:
      return "";
  }
};

const getAmountClass = (type: MovementType) => {
  if (type === "Receita") return "amount-income";
  if (type === "Despesa") return "amount-expense";
  return "amount-neutral";
};

export default function HistoricoFinanceiroPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [periodFilter, setPeriodFilter] = useState("Todos");
  const [sortOrder, setSortOrder] = useState("recentes");
  const [selectedTransaction, setSelectedTransaction] =
    useState<string | null>(null);

  const loadTransactions = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        setTransactions([]);
        return;
      }

      const parsed = JSON.parse(saved);

      setTransactions(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error("Erro ao carregar histórico financeiro:", error);
      setTransactions([]);
    }
  }, []);

  useEffect(() => {
    loadTransactions();

    window.addEventListener("storage", loadTransactions);

    return () => {
      window.removeEventListener("storage", loadTransactions);
    };
  }, [loadTransactions]);

  const activeTransactions = useMemo(
    () => transactions.filter((item) => !isCancelled(item.status)),
    [transactions]
  );

  const totalReceitas = activeTransactions
    .filter((item) => item.type === "Receita")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const totalDespesas = activeTransactions
    .filter((item) => item.type === "Despesa")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const resultado = totalReceitas - totalDespesas;

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (search.trim()) {
      const term = search.toLowerCase();

      result = result.filter((item) =>
        [
          item.description,
          item.category,
          item.subcategory,
          item.account,
          item.destination,
          item.institution,
          item.investment,
          item.id,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    }

    if (typeFilter !== "Todos") {
      result = result.filter((item) => item.type === typeFilter);
    }

    if (statusFilter === "Cancelados") {
      result = result.filter((item) => isCancelled(item.status));
    } else if (statusFilter === "Ativos") {
      result = result.filter((item) => !isCancelled(item.status));
    } else if (statusFilter !== "Todos") {
      result = result.filter(
        (item) =>
          (item.status || "Pendente").toLowerCase() ===
          statusFilter.toLowerCase()
      );
    }

    if (periodFilter !== "Todos") {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      result = result.filter((item) => {
        if (!item.date) return false;

        const date = new Date(`${item.date}T00:00:00`);

        if (Number.isNaN(date.getTime())) return false;

        if (periodFilter === "Este mês") {
          return (
            date.getMonth() === currentMonth &&
            date.getFullYear() === currentYear
          );
        }

        if (periodFilter === "Mês anterior") {
          const previousMonth = new Date(
            currentYear,
            currentMonth - 1,
            1
          );

          return (
            date.getMonth() === previousMonth.getMonth() &&
            date.getFullYear() === previousMonth.getFullYear()
          );
        }

        if (periodFilter === "Este ano") {
          return date.getFullYear() === currentYear;
        }

        return true;
      });
    }

    result.sort((a, b) => {
      const dateA = new Date(`${a.date || "2000-01-01"}T00:00:00`).getTime();
      const dateB = new Date(`${b.date || "2000-01-01"}T00:00:00`).getTime();

      return sortOrder === "recentes" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [
    transactions,
    search,
    typeFilter,
    statusFilter,
    periodFilter,
    sortOrder,
  ]);

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("Todos");
    setStatusFilter("Todos");
    setPeriodFilter("Todos");
    setSortOrder("recentes");
  };

  return (
    <main className="history-page">
      <div className="history-container">
        <header className="history-header">
          <div>
            <div className="history-breadcrumb">
              <Link href="/">Início</Link>
              <span>/</span>
              <Link href="/financeiro">Financeiro</Link>
              <span>/</span>
              <strong>Histórico financeiro</strong>
            </div>

            <span className="history-eyebrow">CONTROLE FINANCEIRO</span>
            <h1>Histórico financeiro</h1>
            <p>
              Consulte e acompanhe todas as movimentações financeiras
              cadastradas no NEXO.
            </p>
          </div>

          <Link href="/financeiro" className="history-back-button">
            <span>←</span> Voltar ao financeiro
          </Link>
        </header>

        <nav className="finance-navigation">
          {financeNavigation.map((item) => {
            const active = item.href === "/financeiro/historico";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navigation-button ${active ? "selected" : ""}`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <section className="history-summary">
          <article className="history-card">
            <div className="history-card-top">
              <span>Receitas</span>
              <span className="history-icon income-icon">↗</span>
            </div>
            <strong className="positive">
              {currency(totalReceitas)}
            </strong>
            <small>Total de receitas não canceladas</small>
          </article>

          <article className="history-card">
            <div className="history-card-top">
              <span>Despesas</span>
              <span className="history-icon expense-icon">↙</span>
            </div>
            <strong className="negative">
              {currency(totalDespesas)}
            </strong>
            <small>Total de despesas não canceladas</small>
          </article>

          <article className="history-card">
            <div className="history-card-top">
              <span>Resultado</span>
              <span className="history-icon neutral-icon">＝</span>
            </div>
            <strong className={resultado >= 0 ? "positive" : "negative"}>
              {currency(resultado)}
            </strong>
            <small>Receitas menos despesas</small>
          </article>

          <article className="history-card">
            <div className="history-card-top">
              <span>Movimentações</span>
              <span className="history-icon neutral-icon">▤</span>
            </div>
            <strong>{transactions.length}</strong>
            <small>Registros no histórico completo</small>
          </article>
        </section>

        <section className="history-panel">
          <div className="history-panel-heading">
            <div>
              <span className="history-eyebrow">CONSULTA</span>
              <h2>Todas as movimentações</h2>
              <p>
                Pesquise, filtre e consulte os lançamentos financeiros.
              </p>
            </div>

            <button
              type="button"
              className="history-refresh"
              onClick={loadTransactions}
            >
              ↻ Atualizar
            </button>
          </div>

          <div className="history-filters">
            <div className="history-search">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Buscar por descrição, categoria ou conta..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="history-filter-grid">
              <label>
                Tipo
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="Todos">Todos os tipos</option>
                  <option value="Receita">Receita</option>
                  <option value="Despesa">Despesa</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Aplicação">Aplicação</option>
                  <option value="Reserva">Reserva</option>
                </select>
              </label>

              <label>
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="Todos">Todos os status</option>
                  <option value="Ativos">Não cancelados</option>
                  <option value="Cancelados">Cancelados</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                  <option value="Recebida">Recebida</option>
                  <option value="Recebido">Recebido</option>
                </select>
              </label>

              <label>
                Período
                <select
                  value={periodFilter}
                  onChange={(event) => setPeriodFilter(event.target.value)}
                >
                  <option value="Todos">Todo o período</option>
                  <option value="Este mês">Este mês</option>
                  <option value="Mês anterior">Mês anterior</option>
                  <option value="Este ano">Este ano</option>
                </select>
              </label>

              <label>
                Ordenação
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                >
                  <option value="recentes">Mais recentes</option>
                  <option value="antigos">Mais antigos</option>
                </select>
              </label>
            </div>

            <div className="history-filter-footer">
              <span>
                {filteredTransactions.length} movimentação(ões) encontrada(s)
              </span>
              <button type="button" onClick={clearFilters}>
                Limpar filtros
              </button>
            </div>
          </div>

          <div className="history-table-wrapper">
            {filteredTransactions.length === 0 ? (
              <div className="history-empty">
                <span>▤</span>
                <h3>Nenhuma movimentação encontrada</h3>
                <p>
                  Não existem registros para os filtros selecionados.
                  Experimente alterar sua pesquisa.
                </p>
              </div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Categoria</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Valor</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map((item) => (
                    <>
                      <tr
                        key={item.id}
                        className={
                          selectedTransaction === item.id
                            ? "history-row selected"
                            : "history-row"
                        }
                      >
                        <td>
                          <div className="history-description">
                            <strong>{item.description || "Sem descrição"}</strong>
                            <small>{item.id}</small>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`history-type ${getTypeClass(item.type)}`}
                          >
                            {item.type}
                          </span>
                        </td>

                        <td>
                          <div className="history-category">
                            <span>{item.category || "—"}</span>
                            {item.subcategory && (
                              <small>{item.subcategory}</small>
                            )}
                          </div>
                        </td>

                        <td className="history-date">
                          {formatDate(item.date)}
                        </td>

                        <td>
                          <span
                            className={`history-status ${
                              isCancelled(item.status)
                                ? "cancelled"
                                : (item.status || "Pendente")
                                    .toLowerCase()
                                    .includes("pago") ||
                                  (item.status || "")
                                    .toLowerCase()
                                    .includes("recebid")
                                ? "completed"
                                : "pending"
                            }`}
                          >
                            {item.status || "Pendente"}
                          </span>
                        </td>

                        <td>
                          <strong
                            className={`history-amount ${getAmountClass(
                              item.type
                            )}`}
                          >
                            {currency(Number(item.amount || 0))}
                          </strong>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="history-details-button"
                            onClick={() =>
                              setSelectedTransaction(
                                selectedTransaction === item.id
                                  ? null
                                  : item.id
                              )
                            }
                          >
                            {selectedTransaction === item.id
                              ? "Fechar"
                              : "Detalhes"}
                          </button>
                        </td>
                      </tr>

                      {selectedTransaction === item.id && (
                        <tr key={`${item.id}-details`}>
                          <td colSpan={7}>
                            <div className="history-details">
                              <div>
                                <small>Conta financeira</small>
                                <strong>{item.account || "Não informada"}</strong>
                              </div>
                              <div>
                                <small>Forma de pagamento</small>
                                <strong>{item.method || "Não informada"}</strong>
                              </div>
                              <div>
                                <small>Recorrência</small>
                                <strong>{item.recurrence || "Não informada"}</strong>
                              </div>
                              <div>
                                <small>Destino / Instituição</small>
                                <strong>
                                  {item.destination ||
                                    item.institution ||
                                    "Não informado"}
                                </strong>
                              </div>
                              {item.investment && (
                                <div>
                                  <small>Investimento</small>
                                  <strong>{item.investment}</strong>
                                </div>
                              )}
                              {item.reserveType && (
                                <div>
                                  <small>Tipo de reserva</small>
                                  <strong>{item.reserveType}</strong>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <footer className="history-footer">
          <span>NEXO</span>
          <p>Planeje. Organize. Conquiste.</p>
        </footer>
      </div>

      <style jsx global>{`
        .history-page {
          min-height: 100vh;
          width: 100%;
          padding: 34px;
          color: #f5f5f6;
          background: #0a0a0b;
          font-family: "DM Sans", sans-serif;
        }

        .history-container {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 24px;
          margin-bottom: 28px;
        }

        .history-breadcrumb {
          display: flex;
          gap: 9px;
          align-items: center;
          margin-bottom: 25px;
          color: #77777e;
          font-size: 12px;
        }

        .history-breadcrumb a {
          color: #9999a1;
          text-decoration: none;
        }

        .history-breadcrumb a:hover {
          color: #fff;
        }

        .history-breadcrumb strong {
          color: #e1e1e4;
          font-weight: 500;
        }

        .history-eyebrow {
          display: block;
          color: #9297a0;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 9px;
        }

        .history-header h1 {
          margin: 0;
          font-family: "Manrope", sans-serif;
          font-size: clamp(27px, 3vw, 36px);
          font-weight: 700;
          letter-spacing: -1.2px;
        }

        .history-header p {
          margin: 9px 0 0;
          color: #92929a;
          font-size: 13px;
        }

        .history-back-button {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 11px 15px;
          border: 1px solid #303035;
          border-radius: 9px;
          color: #d5d5da;
          text-decoration: none;
          font-size: 12px;
          white-space: nowrap;
          transition: 0.2s;
        }

        .history-back-button:hover,
        .history-refresh:hover {
          background: #202024;
          border-color: #55555d;
        }

        .finance-navigation {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          margin-bottom: 22px;
          overflow-x: auto;
          border: 1px solid #29292e;
          border-radius: 9px;
          background: #151517;
          scrollbar-width: thin;
        }

        .navigation-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          flex-shrink: 0;
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid #34343a;
          border-radius: 6px;
          color: #bdbdc5;
          background: #202024;
          font-size: 11px;
          text-decoration: none;
          transition: 0.2s;
        }

        .navigation-button:hover {
          color: #fff;
          border-color: #77777f;
          background: #303035;
        }

        .navigation-button.selected {
          color: #fff;
          border-color: #77777f;
          background: #38383e;
          font-weight: 700;
        }

        .navigation-button span {
          font-size: 15px;
        }

        .history-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 23px;
        }

        .history-card {
          min-width: 0;
          padding: 19px;
          border: 1px solid #29292e;
          border-radius: 12px;
          background: #151517;
        }

        .history-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 17px;
          color: #a1a1a9;
          font-size: 12px;
        }

        .history-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 29px;
          height: 29px;
          border-radius: 8px;
          background: #222226;
          font-size: 16px;
        }

        .income-icon {
          color: #a8c7b3;
        }

        .expense-icon {
          color: #d18c8c;
        }

        .neutral-icon {
          color: #c3c7ce;
        }

        .history-card > strong {
          display: block;
          overflow-wrap: anywhere;
          font-family: "Manrope", sans-serif;
          font-size: clamp(18px, 2vw, 24px);
          font-weight: 700;
          letter-spacing: -0.7px;
        }

        .history-card small {
          display: block;
          margin-top: 8px;
          color: #77777f;
          font-size: 10px;
        }

        .positive {
          color: #a8c7b3;
        }

        .negative {
          color: #d18c8c;
        }

        .history-panel {
          overflow: hidden;
          border: 1px solid #29292e;
          border-radius: 13px;
          background: #121214;
        }

        .history-panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 23px 24px;
          border-bottom: 1px solid #28282d;
        }

        .history-panel-heading h2 {
          margin: 0;
          font-family: "Manrope", sans-serif;
          font-size: 18px;
          font-weight: 700;
        }

        .history-panel-heading p {
          margin: 7px 0 0;
          color: #85858d;
          font-size: 11px;
        }

        .history-refresh {
          padding: 9px 13px;
          border: 1px solid #34343a;
          border-radius: 8px;
          color: #d5d5da;
          background: transparent;
          font-size: 11px;
          cursor: pointer;
          transition: 0.2s;
        }

        .history-filters {
          padding: 20px 24px;
          border-bottom: 1px solid #28282d;
        }

        .history-search {
          display: flex;
          align-items: center;
          gap: 11px;
          height: 43px;
          padding: 0 13px;
          border: 1px solid #303036;
          border-radius: 8px;
          background: #19191c;
        }

        .history-search span {
          color: #898991;
          font-size: 20px;
        }

        .history-search input {
          width: 100%;
          border: none;
          outline: none;
          color: #f2f2f4;
          background: transparent;
          font-family: inherit;
          font-size: 12px;
        }

        .history-search input::placeholder {
          color: #707078;
        }

        .history-filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-top: 16px;
        }

        .history-filter-grid label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #96969e;
          font-size: 10px;
          font-weight: 600;
        }

        .history-filter-grid select {
          width: 100%;
          height: 39px;
          padding: 0 10px;
          border: 1px solid #303036;
          border-radius: 7px;
          outline: none;
          color: #e4e4e8;
          background: #19191c;
          font-family: inherit;
          font-size: 11px;
        }

        .history-filter-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-top: 17px;
          color: #77777f;
          font-size: 10px;
        }

        .history-filter-footer button {
          padding: 0;
          border: none;
          color: #c3c7ce;
          background: transparent;
          font-family: inherit;
          font-size: 10px;
          cursor: pointer;
        }

        .history-filter-footer button:hover {
          color: #fff;
          text-decoration: underline;
        }

        .history-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          white-space: nowrap;
        }

        .history-table thead {
          background: #18181b;
        }

        .history-table th {
          padding: 13px 16px;
          color: #85858d;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .history-table td {
          padding: 15px 16px;
          border-top: 1px solid #252529;
          font-size: 11px;
        }

        .history-row {
          transition: background 0.15s;
        }

        .history-row:hover,
        .history-row.selected {
          background: #1b1b1f;
        }

        .history-description {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 130px;
        }

        .history-description strong {
          color: #e8e8eb;
          font-size: 11px;
          font-weight: 600;
        }

        .history-description small {
          color: #73737b;
          font-size: 9px;
        }

        .history-type,
        .history-status {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border: 1px solid transparent;
          border-radius: 5px;
          font-size: 9px;
          font-weight: 600;
        }

        .history-type.income {
          color: #a8c7b3;
          background: #1c2922;
          border-color: #304538;
        }

        .history-type.expense {
          color: #d18c8c;
          background: #2b1d1d;
          border-color: #493030;
        }

        .history-type.transfer {
          color: #c3c7ce;
          background: #25252a;
          border-color: #3c3c43;
        }

        .history-type.investment,
        .history-type.reserve {
          color: #b7bbc5;
          background: #22242a;
          border-color: #3b3e48;
        }

        .history-category {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #d2d2d7;
        }

        .history-category small {
          color: #77777f;
          font-size: 9px;
        }

        .history-date {
          color: #b2b2b9;
          font-size: 10px !important;
        }

        .history-status.completed {
          color: #a8c7b3;
          background: #1c2922;
          border-color: #304538;
        }

        .history-status.pending {
          color: #c3c7ce;
          background: #25252a;
          border-color: #3c3c43;
        }

        .history-status.cancelled {
          color: #d18c8c;
          background: #2b1d1d;
          border-color: #493030;
        }

        .history-amount {
          font-size: 11px;
          font-weight: 700;
        }

        .amount-income {
          color: #a8c7b3;
        }

        .amount-expense {
          color: #d18c8c;
        }

        .amount-neutral {
          color: #d1d1d6;
        }

        .history-details-button {
          padding: 7px 9px;
          border: 1px solid #38383e;
          border-radius: 6px;
          color: #c5c5cc;
          background: transparent;
          font-family: inherit;
          font-size: 9px;
          cursor: pointer;
        }

        .history-details-button:hover {
          color: #fff;
          background: #29292e;
        }

        .history-details {
          display: flex;
          flex-wrap: wrap;
          gap: 28px;
          padding: 17px;
          border: 1px solid #303036;
          border-radius: 8px;
          background: #19191c;
        }

        .history-details > div {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 130px;
        }

        .history-details small {
          color: #85858d;
          font-size: 9px;
        }

        .history-details strong {
          color: #e0e0e4;
          font-size: 11px;
          font-weight: 500;
        }

        .history-empty {
          padding: 65px 20px;
          text-align: center;
        }

        .history-empty > span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border: 1px solid #36363d;
          border-radius: 12px;
          color: #aeb2bb;
          background: #1c1c20;
          font-size: 23px;
        }

        .history-empty h3 {
          margin: 17px 0 8px;
          color: #e5e5e9;
          font-size: 14px;
        }

        .history-empty p {
          max-width: 370px;
          margin: 0 auto;
          color: #85858d;
          font-size: 11px;
          line-height: 1.7;
        }

        .history-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 25px;
          padding: 0 3px;
        }

        .history-footer span {
          color: #c3c7ce;
          font-family: "Manrope", sans-serif;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 3px;
        }

        .history-footer p {
          color: #66666e;
          font-size: 10px;
          letter-spacing: 0.5px;
        }

        @media (max-width: 1050px) {
          .history-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .history-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .history-page {
            padding: 20px 14px;
          }

          .history-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .finance-navigation {
            flex-wrap: nowrap;
            overflow-x: auto;
          }

          .navigation-button {
            flex-shrink: 0;
          }

          .history-panel-heading {
            align-items: flex-start;
            padding: 19px;
          }

          .history-filters {
            padding: 17px;
          }

          .history-filter-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 420px) {
          .history-summary {
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .history-card {
            padding: 13px;
          }

          .history-card > strong {
            font-size: 17px;
          }

          .history-filter-grid {
            grid-template-columns: 1fr;
          }

          .history-footer {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
          }
        }
      `}</style>
    </main>
  );
}
