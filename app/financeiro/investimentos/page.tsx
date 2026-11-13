
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MainNavigation from "../../../components/navigation/MainNavigation";

type InvestmentTransaction = {
  id: number | string;
  description: string;
  type: string;
  amount: number;
  date?: string;
  category?: string;
  subcategory?: string;
  account?: string;
  destinationAccount?: string;
  paymentMethod?: string;
  status?: string;
  recurrence?: string;
  investment?: string;
  institution?: string;
};

const STORAGE_KEY = "nexo_transactions";

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string) {
  if (!value) return "Data não informada";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "Data não informada";

  return date.toLocaleDateString("pt-BR");
}

function formatLongDate(date = new Date()) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getInvestmentType(transaction: InvestmentTransaction) {
  return (
    transaction.investment ||
    transaction.subcategory ||
    transaction.category ||
    "Outros investimentos"
  );
}

function getInstitution(transaction: InvestmentTransaction) {
  return transaction.institution || "Instituição não informada";
}

function getStatus(transaction: InvestmentTransaction) {
  return transaction.status || "Aplicado";
}

function isInvestment(transaction: InvestmentTransaction) {
  return (
    transaction.type === "Investimento" ||
    transaction.type === "Aplicação"
  );
}

function isCancelled(transaction: InvestmentTransaction) {
  return getStatus(transaction).toLowerCase().includes("cancel");
}

export default function InvestimentosPage() {
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [institutionFilter, setInstitutionFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    function loadInvestments() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
          setTransactions([]);
          return;
        }

        const parsed: unknown = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setTransactions(
            parsed.filter(
              (item): item is InvestmentTransaction =>
                item !== null &&
                typeof item === "object" &&
                (typeof item.id === "number" ||
                  typeof item.id === "string") &&
                typeof item.amount === "number" &&
                typeof item.type === "string" &&
                isInvestment(item)
            )
          );
        } else {
          setTransactions([]);
        }
      } catch (error) {
        console.error("Não foi possível carregar os investimentos:", error);
        setTransactions([]);
      }
    }

    loadInvestments();

    window.addEventListener("storage", loadInvestments);

    return () => {
      window.removeEventListener("storage", loadInvestments);
    };
  }, []);

  const activeInvestments = useMemo(
    () => transactions.filter((transaction) => !isCancelled(transaction)),
    [transactions]
  );

  const appliedInvestments = useMemo(
    () =>
      activeInvestments.filter(
        (transaction) => getStatus(transaction).toLowerCase() === "aplicado"
      ),
    [activeInvestments]
  );

  const pendingInvestments = useMemo(
    () =>
      activeInvestments.filter(
        (transaction) => getStatus(transaction).toLowerCase() !== "aplicado"
      ),
    [activeInvestments]
  );

  const totalInvested = useMemo(
    () =>
      appliedInvestments.reduce(
        (total, investment) => total + Number(investment.amount || 0),
        0
      ),
    [appliedInvestments]
  );

  const totalPending = useMemo(
    () =>
      pendingInvestments.reduce(
        (total, investment) => total + Number(investment.amount || 0),
        0
      ),
    [pendingInvestments]
  );

  const investmentTypes = useMemo(
    () =>
      Array.from(
        new Set(
          activeInvestments.map((investment) =>
            getInvestmentType(investment)
          )
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [activeInvestments]
  );

  const institutions = useMemo(
    () =>
      Array.from(
        new Set(
          activeInvestments.map((investment) =>
            getInstitution(investment)
          )
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [activeInvestments]
  );

  const filteredInvestments = useMemo(() => {
    return transactions
      .filter((investment) => {
        const investmentType = getInvestmentType(investment);
        const institution = getInstitution(investment);
        const status = getStatus(investment);

        const matchesType =
          typeFilter === "Todos" || investmentType === typeFilter;

        const matchesInstitution =
          institutionFilter === "Todas" ||
          institution === institutionFilter;

        const matchesStatus =
          statusFilter === "Todos" ||
          (statusFilter === "Ativos" && !isCancelled(investment)) ||
          (statusFilter === "Cancelados" && isCancelled(investment));

        const searchText = [
          investment.description,
          investmentType,
          institution,
          investment.account || "",
          investment.destinationAccount || "",
          investment.paymentMethod || "",
          investment.id,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch = searchText.includes(search.trim().toLowerCase());

        return (
          matchesType &&
          matchesInstitution &&
          matchesStatus &&
          matchesSearch
        );
      })
      .sort((a, b) => {
        const dateA = a.date || "";
        const dateB = b.date || "";
        return dateB.localeCompare(dateA);
      });
  }, [
    transactions,
    typeFilter,
    institutionFilter,
    statusFilter,
    search,
  ]);

  const clearFilters = () => {
    setTypeFilter("Todos");
    setInstitutionFilter("Todas");
    setStatusFilter("Todos");
    setSearch("");
  };

  return (
    <main className="app-shell">
      <MainNavigation />

      <section className="main-area">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              NEXO / FINANCEIRO / INVESTIMENTOS
            </div>
            <h1>Investimentos</h1>
          </div>

          <div className="topbar-right">
            <div className="date-display">
              <span className="date-icon">◷</span>
              {formatLongDate()}
            </div>

            <div className="profile-avatar">N</div>
          </div>
        </header>

        <div className="content investments-content">
          <section className="investments-intro">
            <div>
              <span className="eyebrow">
                GESTÃO E PATRIMÔNIO
              </span>

              <h2>Organize seus investimentos.</h2>

              <p>
                Acompanhe suas aplicações, instituições financeiras e valores
                investidos em um só lugar.
              </p>
            </div>

            <Link href="/financeiro" className="back-link">
              <span>←</span>
              Voltar ao financeiro
            </Link>
          </section>

          <section className="summary-grid">
            <article className="summary-card featured">
              <div className="summary-card-top">
                <span>Total investido</span>
                <span className="summary-icon">◈</span>
              </div>

              <strong>{money(totalInvested)}</strong>
              <small>Valor das aplicações efetivadas</small>
            </article>

            <article className="summary-card">
              <div className="summary-card-top">
                <span>Investimentos ativos</span>
                <span className="summary-icon">▣</span>
              </div>

              <strong>{appliedInvestments.length}</strong>
              <small>Aplicações com status aplicado</small>
            </article>

            <article className="summary-card">
              <div className="summary-card-top">
                <span>Aplicações pendentes</span>
                <span className="summary-icon">◷</span>
              </div>

              <strong>{money(totalPending)}</strong>
              <small>
                {pendingInvestments.length} movimentação(ões) pendente(s)
              </small>
            </article>
          </section>

          <section className="content-grid">
            <article className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">CARTEIRA</span>
                  <h2>Distribuição por tipo</h2>
                  <p>Visualize como seus recursos estão distribuídos.</p>
                </div>
              </div>

              {investmentTypes.length === 0 ? (
                <div className="empty-distribution">
                  <span>◈</span>
                  <strong>Nenhum investimento registrado</strong>
                  <p>
                    As aplicações realizadas na Visão geral aparecerão
                    automaticamente nesta seção.
                  </p>
                </div>
              ) : (
                <div className="distribution-list">
                  {investmentTypes.map((type) => {
                    const typeTotal = appliedInvestments
                      .filter(
                        (investment) =>
                          getInvestmentType(investment) === type
                      )
                      .reduce(
                        (total, investment) =>
                          total + Number(investment.amount || 0),
                        0
                      );

                    const percentage =
                      totalInvested > 0
                        ? (typeTotal / totalInvested) * 100
                        : 0;

                    return (
                      <div className="distribution-item" key={type}>
                        <div className="distribution-top">
                          <strong>{type}</strong>
                          <span>{money(typeTotal)}</span>
                        </div>

                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>

                        <small>
                          {percentage.toFixed(1).replace(".", ",")}% da carteira
                        </small>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">INSTITUIÇÕES</span>
                  <h2>Onde você investe</h2>
                  <p>Distribuição das aplicações por instituição.</p>
                </div>
              </div>

              {institutions.length === 0 ? (
                <div className="empty-distribution">
                  <span>▣</span>
                  <strong>Nenhuma instituição registrada</strong>
                  <p>Suas instituições financeiras aparecerão aqui.</p>
                </div>
              ) : (
                <div className="institution-list">
                  {institutions.map((institution) => {
                    const institutionInvestments = appliedInvestments.filter(
                      (investment) =>
                        getInstitution(investment) === institution
                    );

                    const institutionTotal = institutionInvestments.reduce(
                      (total, investment) =>
                        total + Number(investment.amount || 0),
                      0
                    );

                    return (
                      <div className="institution-item" key={institution}>
                        <div className="institution-icon">▣</div>

                        <div className="institution-info">
                          <strong>{institution}</strong>
                          <small>
                            {institutionInvestments.length} aplicação(ões)
                            efetivada(s)
                          </small>
                        </div>

                        <strong className="institution-value">
                          {money(institutionTotal)}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </section>

          <section className="panel history-panel">
            <div className="section-heading history-heading">
              <div>
                <span className="eyebrow">ACOMPANHAMENTO</span>
                <h2>Minha carteira de investimentos</h2>
                <p>
                  Consulte e filtre suas aplicações registradas na Visão geral.
                </p>
              </div>

              <span className="record-counter">
                {filteredInvestments.length} registro(s)
              </span>
            </div>

            <div className="filters">
              <div className="search-field">
                <label htmlFor="investment-search">Pesquisar</label>
                <input
                  id="investment-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, investimento ou instituição..."
                />
              </div>

              <div className="filter-field">
                <label htmlFor="investment-type">Tipo de investimento</label>
                <select
                  id="investment-type"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="Todos">Todos</option>
                  {investmentTypes.map((type) => (
                    <option value={type} key={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-field">
                <label htmlFor="investment-institution">Instituição</label>
                <select
                  id="investment-institution"
                  value={institutionFilter}
                  onChange={(event) =>
                    setInstitutionFilter(event.target.value)
                  }
                >
                  <option value="Todas">Todas</option>
                  {institutions.map((institution) => (
                    <option value={institution} key={institution}>
                      {institution}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-field">
                <label htmlFor="investment-status">Situação</label>
                <select
                  id="investment-status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="Todos">Todas</option>
                  <option value="Ativos">Ativos</option>
                  <option value="Cancelados">Cancelados</option>
                </select>
              </div>
            </div>

            <div className="filter-footer">
              <span>
                Exibindo {filteredInvestments.length} de {transactions.length}{" "}
                investimento(s)
              </span>

              <button type="button" onClick={clearFilters}>
                Limpar filtros
              </button>
            </div>

            {filteredInvestments.length === 0 ? (
              <div className="empty-state">
                <span>◈</span>
                <strong>Nenhum investimento encontrado</strong>
                <p>
                  {transactions.length === 0
                    ? "Quando você registrar uma aplicação na Visão geral, ela aparecerá automaticamente aqui."
                    : "Não existem investimentos que correspondam aos filtros selecionados."}
                </p>
              </div>
            ) : (
              <div className="investment-list">
                {filteredInvestments.map((investment) => {
                  const status = getStatus(investment);
                  const cancelled = isCancelled(investment);
                  const pending =
                    status.toLowerCase() !== "aplicado" && !cancelled;

                  return (
                    <article
                      className={`investment-item ${
                        cancelled ? "cancelled" : ""
                      }`}
                      key={String(investment.id)}
                    >
                      <div className="investment-icon">◈</div>

                      <div className="investment-info">
                        <strong>
                          {investment.description ||
                            getInvestmentType(investment)}
                        </strong>

                        <span>
                          {getInvestmentType(investment)} ·{" "}
                          {getInstitution(investment)}
                        </span>

                        <small>
                          Aplicação em {formatDate(investment.date)}
                        </small>

                        {investment.account && (
                          <small>Conta de origem: {investment.account}</small>
                        )}

                        {investment.destinationAccount && (
                          <small>
                            Conta de destino: {investment.destinationAccount}
                          </small>
                        )}

                        {investment.paymentMethod && (
                          <small>
                            Forma de pagamento: {investment.paymentMethod}
                          </small>
                        )}
                      </div>

                      <div className="investment-value">
                        <span>Valor aplicado</span>
                        <strong>{money(investment.amount)}</strong>
                      </div>

                      <div className="investment-status">
                        <span
                          className={`status ${
                            cancelled
                              ? "status-cancelled"
                              : pending
                                ? "status-pending"
                                : "status-applied"
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="information">
            <div className="information-icon">i</div>

            <div>
              <strong>Sobre os valores da carteira</strong>
              <p>
                Os valores apresentados correspondem às aplicações registradas
                na Visão geral. O sistema ainda não possui atualização
                automática de cotação, valorização, juros ou rendimentos. Por
                isso, o total investido representa o valor efetivamente
                aplicado, e não necessariamente o valor atual de resgate.
              </p>
            </div>
          </section>

          <footer className="routine-footer">
            <span>© 2026 NEXO — GESTÃO PESSOAL</span>
            <span>PLANEJE. ORGANIZE. CONQUISTE.</span>
          </footer>
        </div>
      </section>

      <style jsx global>{`
        .investments-content {
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: flex-start !important;
          width: 100% !important;
          max-width: none !important;
          gap: 12px !important;
          box-sizing: border-box;
        }

        .investments-intro {
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

        .investments-intro h2 {
          margin: 8px 0 5px;
          color: #f0f0f2;
          font-family: var(--font-heading);
          font-size: clamp(20px, 2.2vw, 27px);
          font-weight: 800;
          letter-spacing: -0.8px;
        }

        .investments-intro p {
          margin: 0;
          color: #a1a2a8;
          font-size: 11px;
          line-height: 1.6;
        }

        .eyebrow {
          display: block;
          color: #9298a2;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .back-link {
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

        .back-link:hover {
          border-color: #77777f;
          background: #303035;
          color: #fff;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          width: 100%;
        }

        .summary-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
          padding: 16px;
          border: 1px solid #2c2c31;
          border-radius: 8px;
          background: linear-gradient(145deg, #1b1b1e, #131315);
          box-sizing: border-box;
        }

        .summary-card.featured {
          border-color: #48484f;
          background: linear-gradient(145deg, #222226, #171719);
        }

        .summary-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .summary-card-top > span:first-child {
          color: #a3a3ac;
          font-size: 11px;
        }

        .summary-icon {
          color: #a5a5ad;
          font-size: 17px;
        }

        .summary-card strong {
          color: #f0f0f2;
          font-family: var(--font-heading);
          font-size: clamp(18px, 2vw, 23px);
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .summary-card small {
          color: #85858e;
          font-size: 9px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 10px;
          width: 100%;
        }

        .panel {
          min-width: 0;
          padding: 17px;
          border: 1px solid #2c2c31;
          border-radius: 8px;
          background: linear-gradient(145deg, #19191c, #131315);
          box-sizing: border-box;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .section-heading h2 {
          margin: 5px 0 0;
          color: #ededf0;
          font-family: var(--font-heading);
          font-size: 15px;
          font-weight: 700;
        }

        .section-heading p {
          margin: 6px 0 0;
          color: #92929a;
          font-size: 10px;
        }

        .distribution-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .distribution-item {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .distribution-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .distribution-top strong {
          color: #e4e4e8;
          font-size: 11px;
        }

        .distribution-top span {
          color: #d5d5db;
          font-size: 11px;
          font-weight: 600;
        }

        .progress-track {
          width: 100%;
          height: 7px;
          overflow: hidden;
          border-radius: 10px;
          background: #303035;
        }

        .progress-fill {
          height: 100%;
          border-radius: 10px;
          background: #a6a6af;
          transition: width 0.3s ease;
        }

        .distribution-item small {
          color: #898991;
          font-size: 9px;
        }

        .institution-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .institution-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px;
          border: 1px solid #2d2d32;
          border-radius: 7px;
          background: #19191c;
        }

        .institution-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border-radius: 7px;
          color: #dedee3;
          background: #303035;
          font-size: 15px;
        }

        .institution-info {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .institution-info strong {
          color: #e5e5e9;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .institution-info small {
          color: #92929a;
          font-size: 9px;
        }

        .institution-value {
          color: #e5e5e9;
          font-size: 11px;
          white-space: nowrap;
        }

        .empty-distribution {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 135px;
          text-align: center;
          color: #a0a0a8;
        }

        .empty-distribution > span {
          margin-bottom: 9px;
          font-size: 25px;
        }

        .empty-distribution strong {
          color: #e3e3e7;
          font-size: 11px;
        }

        .empty-distribution p {
          max-width: 320px;
          margin: 7px 0 0;
          font-size: 10px;
          line-height: 1.5;
        }

        .history-heading {
          align-items: flex-end;
        }

        .record-counter {
          padding: 6px 9px;
          border: 1px solid #38383e;
          border-radius: 5px;
          color: #c5c5cc;
          background: #202024;
          font-size: 9px;
          white-space: nowrap;
        }

        .filters {
          display: grid;
          grid-template-columns: 2fr 1.2fr 1.2fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }

        .search-field,
        .filter-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .filters label {
          color: #a7a8ae;
          font-size: 9px;
          font-weight: 600;
        }

        .filters input,
        .filters select {
          width: 100%;
          height: 35px;
          padding: 0 9px;
          border: 1px solid #37373d;
          border-radius: 6px;
          outline: none;
          color: #e4e4e8;
          background: #101012;
          font-family: inherit;
          font-size: 10px;
          box-sizing: border-box;
          color-scheme: dark;
        }

        .filters input:focus,
        .filters select:focus {
          border-color: #85858d;
        }

        .filters input::placeholder {
          color: #777780;
        }

        .filter-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 13px;
          color: #85858d;
          font-size: 9px;
        }

        .filter-footer button {
          padding: 0;
          border: none;
          color: #c3c7ce;
          background: transparent;
          font-family: inherit;
          font-size: 9px;
          cursor: pointer;
        }

        .filter-footer button:hover {
          color: #fff;
          text-decoration: underline;
        }

        .investment-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .investment-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #2d2d32;
          border-radius: 7px;
          background: #19191c;
          transition: border-color 0.2s, background 0.2s;
        }

        .investment-item:hover {
          border-color: #48484f;
          background: #1e1e22;
        }

        .investment-item.cancelled {
          opacity: 0.6;
        }

        .investment-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border-radius: 7px;
          color: #dedee3;
          background: #303035;
          font-size: 17px;
        }

        .investment-info {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .investment-info strong {
          color: #ededf0;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .investment-info span,
        .investment-info small {
          color: #a0a0a8;
          font-size: 9px;
        }

        .investment-value {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 115px;
        }

        .investment-value span {
          color: #92929a;
          font-size: 9px;
        }

        .investment-value strong {
          color: #ededf0;
          font-size: 11px;
        }

        .investment-status {
          min-width: 80px;
          text-align: right;
        }

        .status {
          display: inline-block;
          padding: 5px 8px;
          border-radius: 5px;
          font-size: 9px;
          white-space: nowrap;
        }

        .status-applied {
          color: #dedee3;
          background: #303036;
        }

        .status-pending {
          color: #e0d5b5;
          background: #39352a;
        }

        .status-cancelled {
          color: #c4a5a5;
          background: #382a2a;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 38px 15px;
          text-align: center;
          color: #aaaab2;
        }

        .empty-state > span {
          display: block;
          margin-bottom: 11px;
          font-size: 30px;
        }

        .empty-state strong {
          color: #e3e3e7;
          font-size: 12px;
        }

        .empty-state p {
          max-width: 430px;
          margin: 8px 0 0;
          font-size: 10px;
          line-height: 1.6;
        }

        .information {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 13px 15px;
          border: 1px solid #34343a;
          border-radius: 8px;
          background: #19191c;
        }

        .information-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 23px;
          height: 23px;
          flex-shrink: 0;
          border: 1px solid #77777f;
          border-radius: 50%;
          color: #dedee3;
          font-size: 12px;
          font-weight: 700;
        }

        .information strong {
          color: #ededf0;
          font-size: 11px;
        }

        .information p {
          margin: 5px 0 0;
          color: #a5a5ad;
          font-size: 10px;
          line-height: 1.6;
        }

        @media (max-width: 950px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .investments-intro {
            align-items: flex-start;
            flex-direction: column;
            padding: 18px;
          }

          .back-link {
            align-self: flex-start;
          }

          .investment-item {
            flex-wrap: wrap;
          }

          .investment-info {
            min-width: calc(100% - 50px);
          }

          .investment-value {
            margin-left: 48px;
          }

          .investment-status {
            margin-left: auto;
          }
        }

        @media (max-width: 520px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .summary-card {
            padding: 13px;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .history-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .institution-item {
            flex-wrap: wrap;
          }

          .institution-value {
            margin-left: 42px;
          }

          .investment-value {
            margin-left: 0;
          }

          .filter-footer {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
