
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MainNavigation from "../../../components/navigation/MainNavigation";

type Transaction = {
  id: number;
  description: string;
  type: "Receita" | "Despesa" | "Transferência" | "Aplicação" | "Reserva";
  amount: number;
  date?: string;
  category?: string;
  subcategory?: string;
  account?: string;
  destinationAccount?: string;
  paymentMethod?: string;
  status?: string;
  recurrence?: string;
  reserveType?: string;
  investment?: string;
  institution?: string;
};

type FilterType =
  | "Todas"
  | "Em aberto"
  | "Pagas"
  | "Atrasadas"
  | "Canceladas";

const STORAGE_KEY = "nexo_transactions";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "Sem data";

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "Sem data";

  return date.toLocaleDateString("pt-BR");
}

function formatLongDate() {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isPaid(status?: string) {
  return status === "Pago" || status === "Recebida";
}

function isCancelled(status?: string) {
  return status === "Cancelada";
}

function isOverdue(transaction: Transaction) {
  if (
    !transaction.date ||
    isPaid(transaction.status) ||
    isCancelled(transaction.status)
  ) {
    return false;
  }

  return transaction.date.slice(0, 10) < getToday();
}

function getStatus(transaction: Transaction) {
  if (isCancelled(transaction.status)) return "Cancelada";
  if (isPaid(transaction.status)) return "Pago";
  if (isOverdue(transaction)) return "Atrasada";

  return transaction.status || "Pendente";
}

export default function ContasAPagarPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("Todas");
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];

      setTransactions(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        loadTransactions();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadTransactions]);

  const expenses = useMemo(
    () => transactions.filter((item) => item.type === "Despesa"),
    [transactions]
  );

  const activeExpenses = useMemo(
    () => expenses.filter((item) => !isCancelled(item.status)),
    [expenses]
  );

  const totalOpen = useMemo(
    () =>
      activeExpenses
        .filter((item) => !isPaid(item.status))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [activeExpenses]
  );

  const totalPaid = useMemo(
    () =>
      activeExpenses
        .filter((item) => isPaid(item.status))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [activeExpenses]
  );

  const totalOverdue = useMemo(
    () =>
      activeExpenses
        .filter((item) => isOverdue(item))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [activeExpenses]
  );

  const totalCancelled = useMemo(
    () =>
      expenses
        .filter((item) => isCancelled(item.status))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [expenses]
  );

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return expenses
      .filter((item) => {
        const matchesSearch =
          item.description.toLowerCase().includes(normalizedSearch) ||
          (item.category || "").toLowerCase().includes(normalizedSearch) ||
          (item.subcategory || "").toLowerCase().includes(normalizedSearch);

        const status = getStatus(item);

        let matchesFilter = true;

        if (filter === "Em aberto") {
          matchesFilter = !isPaid(item.status) && !isCancelled(item.status);
        }

        if (filter === "Pagas") {
          matchesFilter = isPaid(item.status);
        }

        if (filter === "Atrasadas") {
          matchesFilter = isOverdue(item);
        }

        if (filter === "Canceladas") {
          matchesFilter = status === "Cancelada";
        }

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const dateA = a.date || "9999-12-31";
        const dateB = b.date || "9999-12-31";

        return dateA.localeCompare(dateB);
      });
  }, [expenses, search, filter]);

  function updateStatus(id: number, newStatus: string) {
    const updatedTransactions = transactions.map((item) =>
      item.id === id ? { ...item, status: newStatus } : item
    );

    setTransactions(updatedTransactions);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedTransactions)
      );
    } catch {
      alert("Não foi possível salvar a alteração.");
      loadTransactions();
    }
  }

  return (
    <main className="app-shell">
      <MainNavigation />

      <section className="main-area">
        <header className="topbar">
          <div className="payable-topbar-left">
            <div className="payable-breadcrumb">
              <Link href="/">NEXO</Link>
              <span>/</span>
              <Link href="/financeiro">FINANCEIRO</Link>
              <span>/</span>
              <span>CONTAS A PAGAR</span>
            </div>

            <h1>Contas a pagar</h1>
            <p>Acompanhe suas despesas, vencimentos e pagamentos.</p>
          </div>

          <div className="payable-topbar-right">
            <span className="payable-date">{formatLongDate()}</span>
            <div className="payable-avatar">N</div>
          </div>
        </header>

        <div className="content payable-content-page">
          <section className="payable-intro">
            <div>
              <span className="payable-eyebrow">
                CONTROLE DE DESPESAS
              </span>
              <h2>Gestão de pagamentos</h2>
              <p>
                Consulte os compromissos financeiros e acompanhe o que
                ainda precisa ser pago.
              </p>
            </div>

            <Link href="/financeiro" className="payable-new-button">
              <span>+</span>
              Nova despesa
            </Link>
          </section>

          <section className="payable-summary">
            <article className="payable-summary-card">
              <div className="payable-summary-top">
                <span>Contas em aberto</span>
                <span className="payable-summary-icon">◷</span>
              </div>
              <strong>{formatCurrency(totalOpen)}</strong>
              <small>Valores ainda não pagos</small>
            </article>

            <article className="payable-summary-card">
              <div className="payable-summary-top">
                <span>Total pago</span>
                <span className="payable-summary-icon">✓</span>
              </div>
              <strong>{formatCurrency(totalPaid)}</strong>
              <small>Despesas já quitadas</small>
            </article>

            <article className="payable-summary-card overdue">
              <div className="payable-summary-top">
                <span>Contas atrasadas</span>
                <span className="payable-summary-icon">!</span>
              </div>
              <strong>{formatCurrency(totalOverdue)}</strong>
              <small>Despesas com vencimento vencido</small>
            </article>

            <article className="payable-summary-card">
              <div className="payable-summary-top">
                <span>Contas canceladas</span>
                <span className="payable-summary-icon">×</span>
              </div>
              <strong>{formatCurrency(totalCancelled)}</strong>
              <small>Despesas canceladas</small>
            </article>
          </section>

          <section className="payable-panel">
            <div className="payable-section-heading">
              <div>
                <span className="payable-eyebrow">ACOMPANHAMENTO</span>
                <h2>Histórico de contas</h2>
                <p>
                  Consulte e acompanhe todas as despesas cadastradas.
                </p>
              </div>

              <span className="payable-count">
                {filteredExpenses.length}{" "}
                {filteredExpenses.length === 1 ? "despesa" : "despesas"}
              </span>
            </div>

            <div className="payable-filters">
              <div className="payable-search">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Buscar por descrição ou categoria..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Buscar despesas"
                />
              </div>

              <div className="payable-filter-field">
                <label htmlFor="payable-filter">Situação</label>
                <select
                  id="payable-filter"
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as FilterType)
                  }
                >
                  <option value="Todas">Todas as contas</option>
                  <option value="Em aberto">Em aberto</option>
                  <option value="Pagas">Pagas</option>
                  <option value="Atrasadas">Atrasadas</option>
                  <option value="Canceladas">Canceladas</option>
                </select>
              </div>
            </div>

            <div className="payable-table-wrapper">
              <table className="payable-table">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Vencimento</th>
                    <th>Conta</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="payable-empty-state">
                        Carregando contas...
                      </td>
                    </tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="payable-empty-state">
                        <div className="payable-empty-icon">▤</div>
                        <strong>Nenhuma conta encontrada</strong>
                        <span>
                          Cadastre uma despesa na página Financeiro para
                          visualizar aqui.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((item) => {
                      const status = getStatus(item);

                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="payable-description">
                              <strong>{item.description}</strong>
                              <small>
                                {item.subcategory || "Sem subcategoria"}
                              </small>
                            </div>
                          </td>

                          <td>{item.category || "Não informada"}</td>

                          <td>
                            <span
                              className={
                                isOverdue(item)
                                  ? "payable-date-value overdue"
                                  : "payable-date-value"
                              }
                            >
                              {formatDate(item.date)}
                            </span>
                          </td>

                          <td>{item.account || "Não informada"}</td>

                          <td className="payable-amount">
                            {formatCurrency(Number(item.amount || 0))}
                          </td>

                          <td>
                            <span
                              className={`payable-status ${
                                status === "Pago"
                                  ? "paid"
                                  : status === "Atrasada"
                                  ? "overdue"
                                  : status === "Cancelada"
                                  ? "cancelled"
                                  : "pending"
                              }`}
                            >
                              {status}
                            </span>
                          </td>

                          <td>
                            {!isPaid(item.status) &&
                            !isCancelled(item.status) ? (
                              <button
                                type="button"
                                className="payable-action-button"
                                onClick={() => {
                                  const confirmed = window.confirm(
                                    `Confirma o pagamento de "${item.description}" no valor de ${formatCurrency(
                                      Number(item.amount || 0)
                                    )}?`
                                  );

                                  if (confirmed) {
                                    updateStatus(item.id, "Pago");
                                  }
                                }}
                              >
                                Marcar como pago
                              </button>
                            ) : isPaid(item.status) ? (
                              <button
                                type="button"
                                className="payable-undo-button"
                                onClick={() => {
                                  const confirmed = window.confirm(
                                    "Deseja voltar esta conta para Pendente?"
                                  );

                                  if (confirmed) {
                                    updateStatus(item.id, "Pendente");
                                  }
                                }}
                              >
                                Reabrir
                              </button>
                            ) : (
                              <span className="payable-no-action">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="payable-table-footer">
              <span>
                Exibindo <strong>{filteredExpenses.length}</strong> de{" "}
                <strong>{expenses.length}</strong> despesas
              </span>
              <span>
                Total listado:{" "}
                <strong>
                  {formatCurrency(
                    filteredExpenses.reduce(
                      (total, item) =>
                        total + Number(item.amount || 0),
                      0
                    )
                  )}
                </strong>
              </span>
            </div>
          </section>

          <footer className="payable-footer">
            NEXO · Planeje. Organize. Conquiste.
          </footer>
        </div>
      </section>

      <style jsx global>{`
        .payable-content-page {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .payable-topbar-left {
          min-width: 0;
        }

        .payable-breadcrumb {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
          margin-bottom: 8px;
          color: #85858d;
          font-size: 10px;
          letter-spacing: 0.7px;
        }

        .payable-breadcrumb a {
          color: #bdbdc5;
          text-decoration: none;
        }

        .payable-breadcrumb a:hover {
          color: #fff;
        }

        .payable-topbar-left h1 {
          margin: 0;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 25px;
          font-weight: 700;
          letter-spacing: -0.8px;
        }

        .payable-topbar-left p {
          margin: 5px 0 0;
          color: #898991;
          font-size: 12px;
        }

        .payable-topbar-right {
          display: flex;
          align-items: center;
          gap: 15px;
          flex-shrink: 0;
        }

        .payable-date {
          color: #9999a2;
          font-size: 11px;
          white-space: nowrap;
        }

        .payable-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: 1px solid #414148;
          border-radius: 50%;
          color: #f5f5f6;
          background: #252529;
          font-size: 13px;
          font-weight: 700;
        }

        .payable-intro {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
        }

        .payable-eyebrow {
          display: block;
          color: #888891;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .payable-intro h2 {
          margin: 6px 0 0;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .payable-intro p {
          margin: 6px 0 0;
          color: #89898f;
          font-size: 12px;
          line-height: 1.5;
        }

        .payable-new-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 37px;
          padding: 0 14px;
          flex-shrink: 0;
          border: 1px solid #77777f;
          border-radius: 8px;
          color: #fff;
          background: #303035;
          font-size: 11px;
          font-weight: 700;
          text-decoration: none;
          transition: 0.2s;
        }

        .payable-new-button:hover {
          background: #414147;
        }

        .payable-new-button span {
          font-size: 16px;
        }

        .payable-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .payable-summary-card {
          min-width: 0;
          padding: 19px;
          border: 1px solid #29292d;
          border-radius: 12px;
          background: #151517;
        }

        .payable-summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #99999f;
          font-size: 11px;
        }

        .payable-summary-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 29px;
          height: 29px;
          border: 1px solid #303034;
          border-radius: 8px;
          color: #c3c7ce;
          background: #1b1b1e;
          font-size: 14px;
        }

        .payable-summary-card > strong {
          display: block;
          margin-top: 16px;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 21px;
          font-weight: 700;
          letter-spacing: -0.7px;
          overflow-wrap: anywhere;
        }

        .payable-summary-card > small {
          display: block;
          margin-top: 7px;
          color: #77777e;
          font-size: 10px;
          line-height: 1.5;
        }

        .payable-summary-card.overdue {
          border-color: #493033;
        }

        .payable-summary-card.overdue .payable-summary-icon {
          border-color: #493033;
          color: #d18c8c;
        }

        .payable-summary-card.overdue > strong {
          color: #d18c8c;
        }

        .payable-panel {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #29292d;
          border-radius: 12px;
          background: #111113;
        }

        .payable-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 21px 22px;
          border-bottom: 1px solid #29292d;
        }

        .payable-section-heading h2 {
          margin: 5px 0 0;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 15px;
          font-weight: 700;
        }

        .payable-section-heading p {
          margin: 6px 0 0;
          color: #85858b;
          font-size: 11px;
          line-height: 1.5;
        }

        .payable-count {
          padding: 6px 10px;
          border: 1px solid #343438;
          border-radius: 20px;
          color: #bdbdc5;
          background: #1b1b1e;
          font-size: 10px;
          white-space: nowrap;
        }

        .payable-filters {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 22px;
          border-bottom: 1px solid #29292d;
        }

        .payable-search {
          display: flex;
          align-items: center;
          flex: 1;
          gap: 10px;
          min-width: 180px;
          height: 39px;
          padding: 0 12px;
          border: 1px solid #303034;
          border-radius: 8px;
          background: #151517;
        }

        .payable-search > span {
          color: #85858b;
          font-size: 20px;
        }

        .payable-search input {
          width: 100%;
          border: 0;
          outline: none;
          color: #f5f5f6;
          background: transparent;
          font: inherit;
          font-size: 11px;
        }

        .payable-search input::placeholder {
          color: #707077;
        }

        .payable-filter-field {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .payable-filter-field label {
          color: #85858b;
          font-size: 10px;
        }

        .payable-filter-field select {
          height: 39px;
          min-width: 150px;
          padding: 0 11px;
          border: 1px solid #303034;
          border-radius: 8px;
          outline: none;
          color: #e5e5e7;
          background: #151517;
          font: inherit;
          font-size: 11px;
        }

        .payable-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .payable-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          white-space: nowrap;
        }

        .payable-table th {
          padding: 13px 15px;
          border-bottom: 1px solid #29292d;
          color: #85858b;
          background: #151517;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .payable-table th:first-child,
        .payable-table td:first-child {
          padding-left: 22px;
        }

        .payable-table td {
          padding: 14px 15px;
          border-bottom: 1px solid #242427;
          color: #c6c6ca;
          font-size: 11px;
        }

        .payable-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .payable-table tbody tr:hover {
          background: #171719;
        }

        .payable-description {
          display: flex;
          flex-direction: column;
          gap: 5px;
          max-width: 220px;
          white-space: normal;
        }

        .payable-description strong {
          color: #ededee;
          font-size: 11px;
          font-weight: 600;
        }

        .payable-description small {
          color: #77777e;
          font-size: 9px;
        }

        .payable-date-value {
          color: #c6c6ca;
        }

        .payable-date-value.overdue {
          color: #d18c8c;
        }

        .payable-amount {
          color: #f0f0f1 !important;
          font-weight: 700;
        }

        .payable-status {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border: 1px solid #343438;
          border-radius: 20px;
          color: #c3c7ce;
          background: #1b1b1e;
          font-size: 9px;
          font-weight: 600;
        }

        .payable-status.paid {
          border-color: #35443b;
          color: #a8c7b3;
          background: #18201b;
        }

        .payable-status.overdue {
          border-color: #543437;
          color: #d18c8c;
          background: #241719;
        }

        .payable-status.cancelled {
          border-color: #39393d;
          color: #85858b;
          background: #1b1b1e;
        }

        .payable-status.pending {
          border-color: #49433a;
          color: #c5b99e;
          background: #211e19;
        }

        .payable-action-button,
        .payable-undo-button {
          min-height: 29px;
          padding: 0 9px;
          border: 1px solid #414148;
          border-radius: 7px;
          color: #e5e5e7;
          background: #202023;
          font: inherit;
          font-size: 9px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }

        .payable-action-button:hover {
          border-color: #78917e;
          color: #b8d4c0;
          background: #1b2520;
        }

        .payable-undo-button:hover {
          border-color: #777d87;
          background: #29292d;
        }

        .payable-no-action {
          color: #66666c;
        }

        .payable-empty-state {
          height: 180px;
          text-align: center !important;
          white-space: normal;
        }

        .payable-empty-state > strong,
        .payable-empty-state > span {
          display: block;
        }

        .payable-empty-state > strong {
          margin: 8px 0 5px;
          color: #dedee0;
          font-size: 12px;
        }

        .payable-empty-state > span {
          color: #85858b;
          font-size: 10px;
          line-height: 1.5;
        }

        .payable-empty-icon {
          color: #777d87;
          font-size: 24px;
        }

        .payable-table-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 15px 22px;
          border-top: 1px solid #29292d;
          color: #85858b;
          font-size: 10px;
        }

        .payable-table-footer strong {
          color: #dedee0;
        }

        .payable-footer {
          padding: 8px;
          color: #77777f;
          text-align: center;
          font-size: 9px;
        }

        @media (max-width: 1100px) {
          .payable-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .payable-topbar-left h1 {
            font-size: 21px;
          }

          .payable-topbar-right {
            gap: 9px;
          }

          .payable-date {
            font-size: 10px;
          }

          .payable-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          .payable-summary {
            gap: 10px;
          }

          .payable-summary-card {
            padding: 15px;
          }

          .payable-summary-card > strong {
            font-size: 18px;
          }

          .payable-section-heading {
            align-items: flex-start;
            flex-direction: column;
            padding: 18px;
          }

          .payable-filters {
            align-items: stretch;
            flex-direction: column;
            padding: 15px;
          }

          .payable-filter-field {
            align-items: center;
            justify-content: space-between;
          }

          .payable-filter-field select {
            flex: 1;
          }

          .payable-table-footer {
            align-items: flex-start;
            flex-direction: column;
            padding: 15px;
          }
        }

        @media (max-width: 420px) {
          .payable-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
