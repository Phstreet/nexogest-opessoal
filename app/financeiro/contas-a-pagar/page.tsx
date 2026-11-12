
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

type FilterType = "Todas" | "Em aberto" | "Pagas" | "Atrasadas" | "Canceladas";

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

  const expenses = useMemo(() => {
    return transactions.filter((item) => item.type === "Despesa");
  }, [transactions]);

  const activeExpenses = expenses.filter(
    (item) => !isCancelled(item.status)
  );

  const totalOpen = activeExpenses
    .filter((item) => !isPaid(item.status))
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const totalPaid = activeExpenses
    .filter((item) => isPaid(item.status))
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const totalOverdue = activeExpenses
    .filter((item) => isOverdue(item))
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const totalCancelled = expenses
    .filter((item) => isCancelled(item.status))
    .reduce((total, item) => total + Number(item.amount || 0), 0);

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
    <main className="payable-page">
      <header className="payable-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Início</Link>
            <span>/</span>
            <Link href="/financeiro">Financeiro</Link>
            <span>/</span>
            <span>Contas a pagar</span>
          </div>

          <h1>Contas a pagar</h1>
          <p>
            Acompanhe suas despesas, vencimentos e pagamentos em um só lugar.
          </p>
        </div>

        <Link href="/financeiro" className="back-button">
          <span>←</span> Voltar ao financeiro
        </Link>
      </header>

      <nav className="finance-navigation">
        {financeNavigation.map((item) => {
          const active = item.href === "/financeiro/contas-a-pagar";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`navigation-button ${active ? "selected" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <section className="payable-summary">
        <article className="summary-card">
          <div className="summary-top">
            <span>Contas em aberto</span>
            <span className="summary-icon">◷</span>
          </div>
          <strong>{formatCurrency(totalOpen)}</strong>
          <small>Valores ainda não pagos</small>
        </article>

        <article className="summary-card">
          <div className="summary-top">
            <span>Total pago</span>
            <span className="summary-icon">✓</span>
          </div>
          <strong>{formatCurrency(totalPaid)}</strong>
          <small>Despesas já quitadas</small>
        </article>

        <article className="summary-card overdue-card">
          <div className="summary-top">
            <span>Contas atrasadas</span>
            <span className="summary-icon">!</span>
          </div>
          <strong>{formatCurrency(totalOverdue)}</strong>
          <small>Despesas com vencimento vencido</small>
        </article>

        <article className="summary-card">
          <div className="summary-top">
            <span>Contas canceladas</span>
            <span className="summary-icon">×</span>
          </div>
          <strong>{formatCurrency(totalCancelled)}</strong>
          <small>Despesas canceladas</small>
        </article>
      </section>

      <section className="payable-content">
        <div className="content-heading">
          <div>
            <h2>Histórico de contas</h2>
            <p>Consulte e acompanhe todas as despesas cadastradas.</p>
          </div>

          <Link href="/financeiro" className="new-expense-button">
            + Nova despesa
          </Link>
        </div>

        <div className="payable-filters">
          <div className="search-box">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Buscar por descrição ou categoria..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <select
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
                  <td colSpan={7} className="empty-state">
                    Carregando contas...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    <div className="empty-icon">▤</div>
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
                        <div className="expense-description">
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
                              ? "date-value date-overdue"
                              : "date-value"
                          }
                        >
                          {formatDate(item.date)}
                        </span>
                      </td>

                      <td>{item.account || "Não informada"}</td>

                      <td className="amount-value">
                        {formatCurrency(Number(item.amount || 0))}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            status === "Pago"
                              ? "status-paid"
                              : status === "Atrasada"
                              ? "status-overdue"
                              : status === "Cancelada"
                              ? "status-cancelled"
                              : "status-pending"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td>
                        {!isPaid(item.status) &&
                        !isCancelled(item.status) ? (
                          <button
                            className="pay-button"
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
                            className="undo-button"
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
                          <span className="no-action">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Exibindo <strong>{filteredExpenses.length}</strong> de{" "}
            <strong>{expenses.length}</strong> despesas
          </span>
          <span>
            Total listado:{" "}
            <strong>
              {formatCurrency(
                filteredExpenses.reduce(
                  (total, item) => total + Number(item.amount || 0),
                  0
                )
              )}
            </strong>
          </span>
        </div>
      </section>

      <style jsx global>{`
        .payable-page {
          min-height: 100vh;
          padding: 32px;
          color: #f5f5f6;
          background: #0a0a0b;
          font-family: "DM Sans", sans-serif;
        }

        .payable-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 13px;
          color: #89898f;
          font-size: 12px;
        }

        .breadcrumb a {
          color: #c3c7ce;
          text-decoration: none;
        }

        .breadcrumb a:hover {
          color: #fff;
        }

        .payable-header h1 {
          margin: 0;
          font-family: "Manrope", sans-serif;
          font-size: 29px;
          font-weight: 700;
          letter-spacing: -1px;
        }

        .payable-header p {
          margin: 8px 0 0;
          color: #89898f;
          font-size: 13px;
        }

        .back-button,
        .new-expense-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 15px;
          border: 1px solid #303034;
          border-radius: 9px;
          color: #e5e5e7;
          background: #151517;
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
          transition: 0.2s;
          white-space: nowrap;
        }

        .back-button:hover,
        .new-expense-button:hover {
          border-color: #777d87;
          background: #1b1b1e;
        }

        .finance-navigation {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          margin-bottom: 23px;
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

        .payable-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }

        .summary-card {
          min-width: 0;
          padding: 20px;
          border: 1px solid #29292d;
          border-radius: 13px;
          background: #151517;
        }

        .summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #99999f;
          font-size: 12px;
        }

        .summary-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 29px;
          height: 29px;
          border: 1px solid #303034;
          border-radius: 8px;
          color: #c3c7ce;
          background: #1b1b1e;
          font-size: 15px;
        }

        .summary-card > strong {
          display: block;
          margin-top: 17px;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 23px;
          font-weight: 700;
          letter-spacing: -0.7px;
          overflow-wrap: anywhere;
        }

        .summary-card > small {
          display: block;
          margin-top: 7px;
          color: #77777e;
          font-size: 11px;
        }

        .overdue-card {
          border-color: #493033;
        }

        .overdue-card .summary-icon {
          border-color: #493033;
          color: #d18c8c;
        }

        .overdue-card > strong {
          color: #d18c8c;
        }

        .payable-content {
          overflow: hidden;
          border: 1px solid #29292d;
          border-radius: 13px;
          background: #111113;
        }

        .content-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 22px 23px;
          border-bottom: 1px solid #29292d;
        }

        .content-heading h2 {
          margin: 0;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 16px;
          font-weight: 700;
        }

        .content-heading p {
          margin: 6px 0 0;
          color: #85858b;
          font-size: 12px;
        }

        .payable-filters {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 17px 23px;
          border-bottom: 1px solid #29292d;
        }

        .search-box {
          display: flex;
          align-items: center;
          flex: 1;
          gap: 10px;
          min-width: 180px;
          height: 40px;
          padding: 0 12px;
          border: 1px solid #303034;
          border-radius: 8px;
          background: #151517;
        }

        .search-box > span {
          color: #85858b;
          font-size: 21px;
        }

        .search-box input {
          width: 100%;
          border: 0;
          outline: none;
          color: #f5f5f6;
          background: transparent;
          font: inherit;
          font-size: 12px;
        }

        .search-box input::placeholder {
          color: #707077;
        }

        .payable-filters select {
          height: 40px;
          min-width: 155px;
          padding: 0 12px;
          border: 1px solid #303034;
          border-radius: 8px;
          outline: none;
          color: #e5e5e7;
          background: #151517;
          font: inherit;
          font-size: 12px;
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
          padding: 14px 16px;
          border-bottom: 1px solid #29292d;
          color: #85858b;
          background: #151517;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .payable-table th:first-child,
        .payable-table td:first-child {
          padding-left: 23px;
        }

        .payable-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #242427;
          color: #c6c6ca;
          font-size: 12px;
        }

        .payable-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .payable-table tbody tr:hover {
          background: #171719;
        }

        .expense-description {
          display: flex;
          flex-direction: column;
          gap: 5px;
          max-width: 220px;
          white-space: normal;
        }

        .expense-description strong {
          color: #ededee;
          font-size: 12px;
          font-weight: 600;
        }

        .expense-description small {
          color: #77777e;
          font-size: 10px;
        }

        .date-value {
          color: #c6c6ca;
        }

        .date-overdue {
          color: #d18c8c;
        }

        .amount-value {
          color: #f0f0f1 !important;
          font-weight: 700;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border: 1px solid #343438;
          border-radius: 20px;
          color: #c3c7ce;
          background: #1b1b1e;
          font-size: 10px;
          font-weight: 600;
        }

        .status-paid {
          border-color: #35443b;
          color: #a8c7b3;
          background: #18201b;
        }

        .status-overdue {
          border-color: #543437;
          color: #d18c8c;
          background: #241719;
        }

        .status-cancelled {
          border-color: #39393d;
          color: #85858b;
          background: #1b1b1e;
        }

        .status-pending {
          border-color: #49433a;
          color: #c5b99e;
          background: #211e19;
        }

        .pay-button,
        .undo-button {
          padding: 7px 10px;
          border: 1px solid #414148;
          border-radius: 7px;
          color: #e5e5e7;
          background: #202023;
          font: inherit;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }

        .pay-button:hover {
          border-color: #78917e;
          color: #b8d4c0;
          background: #1b2520;
        }

        .undo-button:hover {
          border-color: #777d87;
          background: #29292d;
        }

        .no-action {
          color: #66666c;
        }

        .empty-state {
          height: 190px;
          text-align: center !important;
          white-space: normal;
        }

        .empty-state > strong,
        .empty-state > span {
          display: block;
        }

        .empty-state > strong {
          margin: 8px 0 5px;
          color: #dedee0;
          font-size: 13px;
        }

        .empty-state > span {
          color: #85858b;
          font-size: 11px;
        }

        .empty-icon {
          color: #777d87;
          font-size: 25px;
        }

        .table-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 23px;
          border-top: 1px solid #29292d;
          color: #85858b;
          font-size: 11px;
        }

        .table-footer strong {
          color: #dedee0;
        }

        @media (max-width: 1050px) {
          .payable-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .payable-page {
            padding: 20px 14px;
          }

          .payable-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .payable-header h1 {
            font-size: 25px;
          }

          .payable-summary {
            gap: 10px;
          }

          .summary-card {
            padding: 15px;
          }

          .summary-card > strong {
            font-size: 19px;
          }

          .content-heading {
            align-items: flex-start;
            flex-direction: column;
            padding: 18px;
          }

          .payable-filters {
            align-items: stretch;
            flex-direction: column;
            padding: 15px;
          }

          .payable-filters select {
            width: 100%;
          }

          .table-footer {
            align-items: flex-start;
            flex-direction: column;
            padding: 15px;
          }
        }

        @media (max-width: 380px) {
          .payable-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
