
"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MovementType =
  | "Receita"
  | "Despesa"
  | "Transferência"
  | "Investimento"
  | "Aplicação"
  | "Reserva";

type Transaction = {
  id: string | number;
  description: string;
  type: MovementType;
  amount: number;
  date?: string;
  category?: string;
  subcategory?: string;
  account?: string;
  destination?: string;
  destinationAccount?: string;
  method?: string;
  paymentMethod?: string;
  status?: string;
  recurrence?: string;
  reserveType?: string;
  investment?: string;
  institution?: string;
  [key: string]: unknown;
};

const STORAGE_KEY = "nexo_transactions";

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDate = (date?: string) => {
  if (!date) return "—";

  const parsed = new Date(`${date}T12:00:00`);

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
    case "Investimento":
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

const getStatusClass = (status?: string) => {
  const normalized = (status || "Pendente").toLowerCase();

  if (normalized.includes("cancel")) return "cancelled";

  if (
    normalized.includes("pago") ||
    normalized.includes("recebid") ||
    normalized.includes("aplicado")
  ) {
    return "completed";
  }

  return "pending";
};

export default function HistoricoFinanceiroPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [periodFilter, setPeriodFilter] = useState("Todos");
  const [sortOrder, setSortOrder] = useState("recentes");
  const [selectedTransaction, setSelectedTransaction] = useState<
    string | null
  >(null);

  const loadTransactions = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        setTransactions([]);
        return;
      }

      const parsed: unknown = JSON.parse(saved);

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

  const totalReceitas = useMemo(
    () =>
      activeTransactions
        .filter((item) => item.type === "Receita")
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [activeTransactions]
  );

  const totalDespesas = useMemo(
    () =>
      activeTransactions
        .filter((item) => item.type === "Despesa")
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [activeTransactions]
  );

  const resultado = totalReceitas - totalDespesas;

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (search.trim()) {
      const term = search.trim().toLowerCase();

      result = result.filter((item) =>
        [
          item.description,
          item.category,
          item.subcategory,
          item.account,
          item.destination,
          item.destinationAccount,
          item.method,
          item.paymentMethod,
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

        const date = new Date(`${item.date}T12:00:00`);

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
      const dateA = a.date
        ? new Date(`${a.date}T12:00:00`).getTime()
        : 0;

      const dateB = b.date
        ? new Date(`${b.date}T12:00:00`).getTime()
        : 0;

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

  const getTransactionKey = (item: Transaction) => String(item.id);

  return (
    <div className="content history-content">
      <section className="history-intro">
        <div>
          <span className="history-eyebrow">
            CONTROLE E ACOMPANHAMENTO
          </span>

          <h2>Histórico de movimentações.</h2>

          <p>
            Consulte, pesquise e acompanhe todas as movimentações
            financeiras cadastradas no NEXO.
          </p>
        </div>

        <Link href="/financeiro" className="history-back-button">
          <span>←</span>
          Voltar ao financeiro
        </Link>
      </section>

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
                <option value="Investimento">Investimento</option>
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
                <option value="Prevista">Prevista</option>
                <option value="Pendente">Pendente</option>
                <option value="Recebida parcialmente">
                  Recebida parcialmente
                </option>
                <option value="Paga parcialmente">
                  Paga parcialmente
                </option>
                <option value="Pago">Pago</option>
                <option value="Recebida">Recebida</option>
                <option value="Recebido">Recebido</option>
                <option value="Aplicado">Aplicado</option>
                <option value="Atrasada">Atrasada</option>
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
                  <th aria-label="Ações"></th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map((item) => {
                  const key = getTransactionKey(item);
                  const isSelected = selectedTransaction === key;

                  return (
                    <Fragment key={key}>
                      <tr
                        className={
                          isSelected
                            ? "history-row selected"
                            : "history-row"
                        }
                      >
                        <td>
                          <div className="history-description">
                            <strong>
                              {item.description || "Sem descrição"}
                            </strong>
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
                            className={`history-status ${getStatusClass(item.status)}`}
                          >
                            {item.status || "Pendente"}
                          </span>
                        </td>

                        <td>
                          <strong
                            className={`history-amount ${getAmountClass(item.type)}`}
                          >
                            {currency(Number(item.amount || 0))}
                          </strong>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="history-details-button"
                            onClick={() =>
                              setSelectedTransaction(isSelected ? null : key)
                            }
                          >
                            {isSelected ? "Fechar" : "Detalhes"}
                          </button>
                        </td>
                      </tr>

                      {isSelected && (
                        <tr className="history-details-row">
                          <td colSpan={7}>
                            <div className="history-details">
                              <div>
                                <small>Conta financeira</small>
                                <strong>
                                  {item.account || "Não informada"}
                                </strong>
                              </div>

                              <div>
                                <small>Forma de pagamento</small>
                                <strong>
                                  {item.method ||
                                    item.paymentMethod ||
                                    "Não informada"}
                                </strong>
                              </div>

                              <div>
                                <small>Recorrência</small>
                                <strong>
                                  {item.recurrence || "Não informada"}
                                </strong>
                              </div>

                              <div>
                                <small>Destino / Instituição</small>
                                <strong>
                                  {item.destination ||
                                    item.destinationAccount ||
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
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <footer className="routine-footer">
        <span>© 2026 NEXO — GESTÃO PESSOAL</span>
        <span>PLANEJE. ORGANIZE. CONQUISTE.</span>
      </footer>

      <style jsx global>{`
        .history-content {
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: flex-start !important;
          width: 100% !important;
          max-width: none !important;
          gap: 12px !important;
          box-sizing: border-box;
        }

        .history-intro {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          min-height: 115px;
          padding: 20px 23px;
          border: 1px solid #35353a;
          border-radius: 9px;
          background: linear-gradient(
            100deg,
            #222326 0%,
            #171719 60%,
            #101012 100%
          );
        }

        .history-intro h2 {
          margin: 8px 0 5px;
          color: #f0f0f2;
          font-family: var(--font-heading);
          font-size: clamp(20px, 2.2vw, 27px);
          font-weight: 800;
          letter-spacing: -0.8px;
        }

        .history-intro p {
          margin: 0;
          color: #a1a2a8;
          font-size: 11px;
          line-height: 1.6;
        }

        .history-eyebrow {
          display: block;
          margin-bottom: 8px;
          color: #9298a2;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .history-back-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          gap: 9px;
          min-height: 35px;
          padding: 0 13px;
          border: 1px solid #414149;
          border-radius: 6px;
          color: #d5d5da;
          background: #202024;
          text-decoration: none;
          font-size: 10px;
          white-space: nowrap;
          transition: var(--transition);
        }

        .history-back-button:hover {
          border-color: #77777f;
          background: #303035;
          color: #fff;
        }

        .history-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          width: 100%;
        }

        .history-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          min-height: 105px;
          padding: 15px;
          gap: 5px;
          border: 1px solid #2c2c31;
          border-radius: 8px;
          background: linear-gradient(145deg, #1b1b1e, #131315);
        }

        .history-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 7px;
          color: #a5a6ac;
          font-size: 11px;
        }

        .history-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 29px;
          height: 29px;
          border-radius: 7px;
          background: #222226;
          font-size: 15px;
        }

        .income-icon,
        .positive {
          color: #a8c7b3;
        }

        .expense-icon,
        .negative {
          color: #d18c8c;
        }

        .neutral-icon {
          color: #c3c7ce;
        }

        .history-card > strong {
          display: block;
          overflow-wrap: anywhere;
          color: #f0f0f2;
          font-family: var(--font-heading);
          font-size: clamp(17px, 2vw, 22px);
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .history-card > strong.positive {
          color: #a8c7b3;
        }

        .history-card > strong.negative {
          color: #d18c8c;
        }

        .history-card small {
          display: block;
          margin-top: 3px;
          color: #777980;
          font-size: 9px;
        }

        .history-panel {
          width: 100%;
          min-width: 0;
          overflow: hidden;
          border: 1px solid #2c2c31;
          border-radius: 8px;
          background: linear-gradient(145deg, #19191c, #131315);
          box-sizing: border-box;
        }

        .history-panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 17px 18px;
          border-bottom: 1px solid #28282d;
        }

        .history-panel-heading h2 {
          margin: 5px 0 0;
          color: #f0f0f2;
          font-family: var(--font-heading);
          font-size: 15px;
          font-weight: 700;
        }

        .history-panel-heading p {
          margin: 6px 0 0;
          color: #85858d;
          font-size: 10px;
        }

        .history-refresh {
          min-height: 33px;
          padding: 0 12px;
          border: 1px solid #34343a;
          border-radius: 6px;
          color: #d5d5da;
          background: transparent;
          font-family: inherit;
          font-size: 10px;
          cursor: pointer;
          transition: var(--transition);
        }

        .history-refresh:hover {
          border-color: #77777f;
          background: #202024;
        }

        .history-filters {
          padding: 16px 18px;
          border-bottom: 1px solid #28282d;
        }

        .history-search {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 38px;
          padding: 0 12px;
          border: 1px solid #303036;
          border-radius: 6px;
          background: #101012;
        }

        .history-search span {
          color: #898991;
          font-size: 19px;
        }

        .history-search input {
          width: 100%;
          border: none;
          outline: none;
          color: #f2f2f4;
          background: transparent;
          font-family: inherit;
          font-size: 11px;
        }

        .history-search input::placeholder {
          color: #707078;
        }

        .history-filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 13px;
        }

        .history-filter-grid label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: #a7a8ae;
          font-size: 10px;
          font-weight: 600;
        }

        .history-filter-grid select {
          width: 100%;
          height: 34px;
          min-width: 0;
          padding: 0 9px;
          border: 1px solid #37373d;
          border-radius: 6px;
          outline: none;
          color: #e4e4e8;
          background: #101012;
          font-family: inherit;
          font-size: 10px;
          color-scheme: dark;
        }

        .history-filter-grid select:focus {
          border-color: #aeb4be;
        }

        .history-filter-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-top: 13px;
          color: #85858d;
          font-size: 9px;
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
          padding: 12px 14px;
          color: #85858d;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .history-table td {
          padding: 13px 14px;
          border-top: 1px solid #252529;
          color: #d2d2d7;
          font-size: 10px;
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
          gap: 4px;
          min-width: 130px;
        }

        .history-description strong {
          color: #e8e8eb;
          font-size: 10px;
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

        .history-type.income,
        .history-status.completed {
          color: #a8c7b3;
          background: #1c2922;
          border-color: #304538;
        }

        .history-type.expense {
          color: #d18c8c;
          background: #2b1d1d;
          border-color: #493030;
        }

        .history-type.transfer,
        .history-status.pending {
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

        .history-status.cancelled {
          color: #d18c8c;
          background: #2b1d1d;
          border-color: #493030;
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
          color: #b2b2b9 !important;
          font-size: 10px !important;
        }

        .history-amount {
          font-size: 10px;
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
          min-height: 27px;
          padding: 0 9px;
          border: 1px solid #38383e;
          border-radius: 5px;
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

        .history-details-row td {
          padding: 10px 14px;
          background: #171719;
        }

        .history-details {
          display: flex;
          flex-wrap: wrap;
          gap: 22px;
          padding: 13px;
          border: 1px solid #303036;
          border-radius: 7px;
          background: #19191c;
        }

        .history-details > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 125px;
        }

        .history-details small {
          color: #85858d;
          font-size: 9px;
        }

        .history-details strong {
          color: #e0e0e4;
          font-size: 10px;
          font-weight: 500;
        }

        .history-empty {
          padding: 55px 20px;
          text-align: center;
        }

        .history-empty > span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 45px;
          height: 45px;
          border: 1px solid #36363d;
          border-radius: 10px;
          color: #aeb2bb;
          background: #1c1c20;
          font-size: 22px;
        }

        .history-empty h3 {
          margin: 14px 0 7px;
          color: #e5e5e9;
          font-size: 12px;
        }

        .history-empty p {
          max-width: 370px;
          margin: 0 auto;
          color: #85858d;
          font-size: 10px;
          line-height: 1.7;
        }

        @media (max-width: 1050px) {
          .history-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .history-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .history-intro {
            align-items: flex-start;
            flex-direction: column;
            padding: 18px;
          }

          .history-back-button {
            align-self: flex-start;
          }

          .history-panel-heading {
            align-items: flex-start;
            padding: 15px;
          }

          .history-filters {
            padding: 14px;
          }
        }

        @media (max-width: 520px) {
          .history-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .history-card {
            min-height: 88px;
            padding: 11px;
          }

          .history-card > strong {
            font-size: 16px;
          }

          .history-filter-grid {
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .history-filter-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .history-panel-heading {
            gap: 10px;
          }

          .history-details {
            gap: 14px;
          }
        }

        @media (max-width: 380px) {
          .history-filter-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
