
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
};

type FilterType =
  | "Todas"
  | "Em aberto"
  | "Recebidas"
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

function getToday() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isReceived(status?: string) {
  return status === "Recebida";
}

function isCancelled(status?: string) {
  return status === "Cancelada";
}

function isOverdue(transaction: Transaction) {
  if (
    !transaction.date ||
    isReceived(transaction.status) ||
    isCancelled(transaction.status)
  ) {
    return false;
  }

  return transaction.date.slice(0, 10) < getToday();
}

function getStatus(transaction: Transaction) {
  if (isCancelled(transaction.status)) return "Cancelada";
  if (isReceived(transaction.status)) return "Recebida";
  if (isOverdue(transaction)) return "Atrasada";

  return transaction.status || "Pendente";
}

export default function ContasAReceberPage() {
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

  const revenues = useMemo(() => {
    return transactions.filter((item) => item.type === "Receita");
  }, [transactions]);

  const activeRevenues = useMemo(
    () => revenues.filter((item) => !isCancelled(item.status)),
    [revenues]
  );

  const totalOpen = useMemo(
    () =>
      activeRevenues
        .filter((item) => !isReceived(item.status))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [activeRevenues]
  );

  const totalReceived = useMemo(
    () =>
      activeRevenues
        .filter((item) => isReceived(item.status))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [activeRevenues]
  );

  const totalOverdue = useMemo(
    () =>
      activeRevenues
        .filter((item) => isOverdue(item))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [activeRevenues]
  );

  const totalCancelled = useMemo(
    () =>
      revenues
        .filter((item) => isCancelled(item.status))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [revenues]
  );

  const filteredRevenues = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return revenues
      .filter((item) => {
        const matchesSearch =
          item.description.toLowerCase().includes(normalizedSearch) ||
          (item.category || "").toLowerCase().includes(normalizedSearch) ||
          (item.subcategory || "").toLowerCase().includes(normalizedSearch);

        const status = getStatus(item);

        let matchesFilter = true;

        if (filter === "Em aberto") {
          matchesFilter =
            !isReceived(item.status) && !isCancelled(item.status);
        }

        if (filter === "Recebidas") {
          matchesFilter = isReceived(item.status);
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
  }, [revenues, search, filter]);

  function updateStatus(id: number, newStatus: string) {
    const updatedTransactions = transactions.map((item) =>
      item.id === id ? { ...item, status: newStatus } : item
    );

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedTransactions)
      );

      setTransactions(updatedTransactions);
    } catch {
      alert("Não foi possível salvar a alteração.");
      loadTransactions();
    }
  }

  function markAsReceived(item: Transaction) {
    const confirmed = window.confirm(
      `Confirma o recebimento de "${item.description}" no valor de ${formatCurrency(
        Number(item.amount || 0)
      )}?`
    );

    if (confirmed) {
      updateStatus(item.id, "Recebida");
    }
  }

  function reopenRevenue(item: Transaction) {
    const confirmed = window.confirm(
      `Deseja reabrir a receita "${item.description}"?`
    );

    if (confirmed) {
      updateStatus(item.id, "Pendente");
    }
  }

  return (
    <div className="content receivable-content-page">
      <div className="receivable-intro">
        <div>
          <p>
            Acompanhe suas receitas, recebimentos e valores pendentes.
          </p>
        </div>

        <Link href="/financeiro" className="receivable-back">
          ← Voltar ao financeiro
        </Link>
      </div>

      <section className="receivable-summary">
        <article className="receivable-card">
          <div className="receivable-card-top">
            <span>Receitas em aberto</span>
            <span className="receivable-icon">◷</span>
          </div>

          <strong>{formatCurrency(totalOpen)}</strong>
          <small>Valores ainda não recebidos</small>
        </article>

        <article className="receivable-card">
          <div className="receivable-card-top">
            <span>Total recebido</span>
            <span className="receivable-icon">✓</span>
          </div>

          <strong>{formatCurrency(totalReceived)}</strong>
          <small>Receitas já confirmadas</small>
        </article>

        <article className="receivable-card overdue-card">
          <div className="receivable-card-top">
            <span>Receitas atrasadas</span>
            <span className="receivable-icon">!</span>
          </div>

          <strong>{formatCurrency(totalOverdue)}</strong>
          <small>Receitas com data vencida</small>
        </article>

        <article className="receivable-card">
          <div className="receivable-card-top">
            <span>Receitas canceladas</span>
            <span className="receivable-icon">×</span>
          </div>

          <strong>{formatCurrency(totalCancelled)}</strong>
          <small>Valores cancelados</small>
        </article>
      </section>

      <section className="receivable-content">
        <div className="receivable-heading">
          <div>
            <h2>Histórico de recebimentos</h2>
            <p>
              Consulte e acompanhe todas as receitas cadastradas.
            </p>
          </div>

          <Link
            href="/financeiro"
            className="receivable-new-button"
          >
            + Nova receita
          </Link>
        </div>

        <div className="receivable-filters">
          <div className="receivable-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Buscar por descrição ou categoria..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar receitas"
            />
          </div>

          <select
            aria-label="Filtrar receitas por situação"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as FilterType)
            }
          >
            <option value="Todas">Todas as receitas</option>
            <option value="Em aberto">Em aberto</option>
            <option value="Recebidas">Recebidas</option>
            <option value="Atrasadas">Atrasadas</option>
            <option value="Canceladas">Canceladas</option>
          </select>
        </div>

        <div className="receivable-table-wrapper">
          <table className="receivable-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Data prevista</th>
                <th>Conta</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="receivable-empty">
                    Carregando receitas...
                  </td>
                </tr>
              ) : filteredRevenues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="receivable-empty">
                    <div className="receivable-empty-icon">▤</div>

                    <strong>Nenhuma receita encontrada</strong>

                    <span>
                      Cadastre uma receita na página Financeiro
                      para visualizar aqui.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredRevenues.map((item) => {
                  const status = getStatus(item);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="receivable-description">
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
                              ? "receivable-date date-overdue"
                              : "receivable-date"
                          }
                        >
                          {formatDate(item.date)}
                        </span>
                      </td>

                      <td>{item.account || "Não informada"}</td>

                      <td className="receivable-amount">
                        {formatCurrency(Number(item.amount || 0))}
                      </td>

                      <td>
                        <span
                          className={`receivable-status ${
                            status === "Recebida"
                              ? "status-received"
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
                        {!isReceived(item.status) &&
                        !isCancelled(item.status) ? (
                          <button
                            type="button"
                            className="receive-button"
                            onClick={() => markAsReceived(item)}
                          >
                            Marcar recebida
                          </button>
                        ) : isReceived(item.status) ? (
                          <button
                            type="button"
                            className="reopen-button"
                            onClick={() => reopenRevenue(item)}
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

        <div className="receivable-footer-table">
          <span>
            Exibindo <strong>{filteredRevenues.length}</strong> de{" "}
            <strong>{revenues.length}</strong> receitas
          </span>

          <span>
            Total listado:{" "}
            <strong>
              {formatCurrency(
                filteredRevenues.reduce(
                  (total, item) =>
                    total + Number(item.amount || 0),
                  0
                )
              )}
            </strong>
          </span>
        </div>
      </section>

      <footer className="routine-footer">
        NEXO · Planeje. Organize. Conquiste.
      </footer>

      <style jsx global>{`
        .receivable-content-page {
          display: flex;
          flex-direction: column;
          gap: 22px;
          min-width: 0;
        }

        .receivable-intro {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .receivable-intro p {
          margin: 0;
          color: #89898f;
          font-size: 13px;
        }

        .receivable-back,
        .receivable-new-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
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

        .receivable-back:hover,
        .receivable-new-button:hover {
          border-color: #777d87;
          background: #1b1b1e;
        }

        .receivable-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
        }

        .receivable-card {
          min-width: 0;
          padding: 20px;
          border: 1px solid #29292d;
          border-radius: 13px;
          background: #151517;
        }

        .receivable-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #99999f;
          font-size: 12px;
        }

        .receivable-icon {
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

        .receivable-card > strong {
          display: block;
          margin-top: 17px;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 23px;
          font-weight: 700;
          letter-spacing: -0.7px;
          overflow-wrap: anywhere;
        }

        .receivable-card > small {
          display: block;
          margin-top: 7px;
          color: #77777e;
          font-size: 11px;
        }

        .overdue-card {
          border-color: #493033;
        }

        .overdue-card .receivable-icon {
          border-color: #493033;
          color: #d18c8c;
        }

        .overdue-card > strong {
          color: #d18c8c;
        }

        .receivable-content {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #29292d;
          border-radius: 13px;
          background: #111113;
        }

        .receivable-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 22px 23px;
          border-bottom: 1px solid #29292d;
        }

        .receivable-heading h2 {
          margin: 0;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 16px;
          font-weight: 700;
        }

        .receivable-heading p {
          margin: 6px 0 0;
          color: #85858b;
          font-size: 12px;
        }

        .receivable-filters {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 17px 23px;
          border-bottom: 1px solid #29292d;
        }

        .receivable-search {
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

        .receivable-search > span {
          color: #85858b;
          font-size: 21px;
        }

        .receivable-search input {
          width: 100%;
          border: 0;
          outline: none;
          color: #f5f5f6;
          background: transparent;
          font: inherit;
          font-size: 12px;
        }

        .receivable-search input::placeholder {
          color: #707077;
        }

        .receivable-filters select {
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

        .receivable-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .receivable-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          white-space: nowrap;
        }

        .receivable-table th {
          padding: 14px 16px;
          border-bottom: 1px solid #29292d;
          color: #85858b;
          background: #151517;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .receivable-table th:first-child,
        .receivable-table td:first-child {
          padding-left: 23px;
        }

        .receivable-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #242427;
          color: #c6c6ca;
          font-size: 12px;
        }

        .receivable-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .receivable-table tbody tr:hover {
          background: #171719;
        }

        .receivable-description {
          display: flex;
          flex-direction: column;
          gap: 5px;
          max-width: 220px;
          white-space: normal;
        }

        .receivable-description strong {
          color: #ededee;
          font-size: 12px;
          font-weight: 600;
        }

        .receivable-description small {
          color: #77777e;
          font-size: 10px;
        }

        .receivable-date {
          color: #c6c6ca;
        }

        .date-overdue {
          color: #d18c8c;
        }

        .receivable-amount {
          color: #f0f0f1 !important;
          font-weight: 700;
        }

        .receivable-status {
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

        .status-received {
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

        .receive-button,
        .reopen-button {
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

        .receive-button:hover {
          border-color: #78917e;
          color: #b8d4c0;
          background: #1b2520;
        }

        .reopen-button:hover {
          border-color: #777d87;
          background: #29292d;
        }

        .no-action {
          color: #66666c;
        }

        .receivable-empty {
          height: 190px;
          text-align: center !important;
          white-space: normal;
        }

        .receivable-empty strong,
        .receivable-empty span {
          display: block;
        }

        .receivable-empty strong {
          margin: 8px 0 5px;
          color: #dedee0;
          font-size: 13px;
        }

        .receivable-empty span {
          color: #85858b;
          font-size: 11px;
        }

        .receivable-empty-icon {
          color: #777d87;
          font-size: 25px;
        }

        .receivable-footer-table {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 23px;
          border-top: 1px solid #29292d;
          color: #85858b;
          font-size: 11px;
        }

        .receivable-footer-table strong {
          color: #dedee0;
        }

        @media (max-width: 1050px) {
          .receivable-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .receivable-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          .receivable-heading {
            align-items: flex-start;
            flex-direction: column;
            padding: 18px;
          }

          .receivable-filters {
            align-items: stretch;
            flex-direction: column;
            padding: 15px;
          }

          .receivable-filters select {
            width: 100%;
          }

          .receivable-footer-table {
            align-items: flex-start;
            flex-direction: column;
            padding: 15px;
          }
        }

        @media (max-width: 380px) {
          .receivable-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
