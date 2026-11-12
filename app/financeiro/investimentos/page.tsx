
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type InvestmentTransaction = {
  id: number;
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

export default function InvestimentosPage() {
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [institutionFilter, setInstitutionFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    function loadInvestments() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
          const parsed = JSON.parse(saved);

          if (Array.isArray(parsed)) {
            setTransactions(
              parsed.filter(
                (item): item is InvestmentTransaction =>
                  item &&
                  typeof item.id === "number" &&
                  typeof item.amount === "number" &&
                  typeof item.type === "string" &&
                  isInvestment(item)
              )
            );
          } else {
            setTransactions([]);
          }
        } else {
          setTransactions([]);
        }
      } catch {
        console.error("Não foi possível carregar os investimentos.");
        setTransactions([]);
      }

      setLoaded(true);
    }

    loadInvestments();

    window.addEventListener("storage", loadInvestments);

    return () => {
      window.removeEventListener("storage", loadInvestments);
    };
  }, []);

  const activeInvestments = useMemo(
    () =>
      transactions.filter(
        (transaction) => getStatus(transaction).toLowerCase() !== "cancelada"
      ),
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
        (total, investment) => total + investment.amount,
        0
      ),
    [appliedInvestments]
  );

  const totalPending = useMemo(
    () =>
      pendingInvestments.reduce(
        (total, investment) => total + investment.amount,
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
          (statusFilter === "Ativos" && status.toLowerCase() !== "cancelada") ||
          (statusFilter === "Cancelados" &&
            status.toLowerCase() === "cancelada");

        const searchText = [
          investment.description,
          investmentType,
          institution,
          investment.account || "",
          investment.destinationAccount || "",
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch = searchText.includes(search.toLowerCase());

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

  if (!loaded) {
    return (
      <main className="investments-page loading-page">
        <div className="loading-state">Carregando investimentos...</div>

        <style jsx>{`
          .investments-page {
            min-height: 100vh;
            display: grid;
            place-items: center;
            color: #ededf0;
            background: #0d0d0f;
          }

          .loading-state {
            color: #a5a5ad;
            font-size: 13px;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="investments-page">
      <header className="investments-header">
        <div className="header-content">
          <div className="breadcrumb">
            <Link href="/">Início</Link>
            <span>/</span>
            <Link href="/financeiro">Financeiro</Link>
            <span>/</span>
            <strong>Investimentos</strong>
          </div>

          <span className="eyebrow">NEXO / GESTÃO FINANCEIRA</span>
          <h1>Investimentos</h1>
          <p>
            Acompanhe suas aplicações e organize sua carteira de investimentos.
          </p>
        </div>

        <div className="header-actions">
          <div className="header-date">
            {new Date().toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>

          <Link href="/financeiro" className="back-link">
            <span>←</span>
            Voltar ao financeiro
          </Link>
        </div>
      </header>

      <nav className="finance-navigation">
        {financeNavigation.map((item) => {
          const active = item.href === "/financeiro/investimentos";

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
          <small>{pendingInvestments.length} movimentação(ões) pendente(s)</small>
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
                    (investment) => getInvestmentType(investment) === type
                  )
                  .reduce(
                    (total, investment) => total + investment.amount,
                    0
                  );

                const percentage =
                  totalInvested > 0 ? (typeTotal / totalInvested) * 100 : 0;

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
                const institutionTotal = appliedInvestments
                  .filter(
                    (investment) =>
                      getInstitution(investment) === institution
                  )
                  .reduce(
                    (total, investment) => total + investment.amount,
                    0
                  );

                const quantity = appliedInvestments.filter(
                  (investment) =>
                    getInstitution(investment) === institution
                ).length;

                return (
                  <div className="institution-item" key={institution}>
                    <div className="institution-icon">▣</div>

                    <div className="institution-info">
                      <strong>{institution}</strong>
                      <small>
                        {quantity} aplicação(ões) efetivada(s)
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
            <p>Consulte e filtre suas aplicações registradas na Visão geral.</p>
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
              onChange={(event) => setInstitutionFilter(event.target.value)}
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
              const cancelled = status.toLowerCase() === "cancelada";
              const pending = status.toLowerCase() !== "aplicado" && !cancelled;

              return (
                <article
                  className={`investment-item ${cancelled ? "cancelled" : ""}`}
                  key={investment.id}
                >
                  <div className="investment-icon">◈</div>

                  <div className="investment-info">
                    <strong>
                      {investment.description || getInvestmentType(investment)}
                    </strong>

                    <span>
                      {getInvestmentType(investment)} ·{" "}
                      {getInstitution(investment)}
                    </span>

                    <small>Aplicação em {formatDate(investment.date)}</small>

                    {investment.account && (
                      <small>Conta de origem: {investment.account}</small>
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
            na Visão geral. O sistema ainda não possui atualização automática
            de cotação, valorização, juros ou rendimentos. Por isso, o total
            investido representa o valor efetivamente aplicado, e não
            necessariamente o valor atual de resgate.
          </p>
        </div>
      </section>

      <footer>NEXO · Planeje. Organize. Conquiste.</footer>

      <style jsx>{`
        .investments-page {
          min-height: 100vh;
          width: 100%;
          padding: 26px 30px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          color: #ededf0;
          background: #0d0d0f;
          box-sizing: border-box;
        }

        .investments-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
        }

        .header-content {
          min-width: 0;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          color: #77777f;
          font-size: 11px;
        }

        .breadcrumb a {
          color: #9999a2;
          text-decoration: none;
          transition: color 0.2s;
        }

        .breadcrumb a:hover {
          color: #fff;
        }

        .breadcrumb strong {
          color: #ededf0;
          font-weight: 600;
        }

        .header-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .header-date {
          color: #9999a2;
          font-size: 12px;
          white-space: nowrap;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-shrink: 0;
          min-height: 40px;
          padding: 0 15px;
          border: 1px solid #34343a;
          border-radius: 9px;
          color: #bdbdc5;
          background: #151517;
          font-size: 11px;
          text-decoration: none;
          white-space: nowrap;
          transition: 0.2s;
          box-sizing: border-box;
        }

        .back-link:hover {
          color: #fff;
          border-color: #77777f;
          background: #202024;
        }

        .back-link span {
          font-size: 15px;
          line-height: 1;
        }

        .eyebrow {
          display: block;
          color: #888891;
          font-size: 10px;
          letter-spacing: 1.5px;
          font-weight: 700;
        }

        h1 {
          margin: 7px 0;
          color: #f2f2f4;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .investments-header p {
          margin: 0;
          color: #9999a2;
          font-size: 13px;
        }

        :global(.finance-navigation) {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          overflow-x: auto;
          border: 1px solid #29292e;
          border-radius: 9px;
          background: #151517;
          scrollbar-width: thin;
          box-sizing: border-box;
        }

        :global(.finance-navigation .navigation-button) {
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
          white-space: nowrap;
          transition: 0.2s;
          box-sizing: border-box;
        }

        :global(.finance-navigation .navigation-button:hover) {
          color: #fff;
          border-color: #77777f;
          background: #303035;
        }

        :global(.finance-navigation .navigation-button.selected) {
          color: #fff;
          border-color: #77777f;
          background: #38383e;
          font-weight: 700;
        }

        :global(.finance-navigation .navigation-button span) {
          font-size: 15px;
          line-height: 1;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .summary-card {
          display: flex;
          flex-direction: column;
          gap: 9px;
          min-width: 0;
          padding: 18px;
          border: 1px solid #29292e;
          border-radius: 9px;
          background: #151517;
          box-sizing: border-box;
        }

        .summary-card.featured {
          background: #202024;
          border-color: #55555d;
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
          font-size: 23px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .summary-card small {
          color: #85858e;
          font-size: 10px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 12px;
        }

        .panel {
          min-width: 0;
          padding: 18px;
          border: 1px solid #29292e;
          border-radius: 9px;
          background: #151517;
          box-sizing: border-box;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 17px;
        }

        h2 {
          margin: 5px 0 0;
          color: #ededf0;
          font-size: 17px;
          font-weight: 650;
        }

        .section-heading p {
          margin: 6px 0 0;
          color: #92929a;
          font-size: 11px;
        }

        .distribution-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
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
          font-size: 12px;
        }

        .distribution-top span {
          color: #d5d5db;
          font-size: 12px;
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
          font-size: 10px;
        }

        .institution-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .institution-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border: 1px solid #2d2d32;
          border-radius: 7px;
          background: #19191c;
        }

        .institution-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border-radius: 7px;
          color: #dedee3;
          background: #303035;
          font-size: 16px;
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
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .institution-info small {
          color: #92929a;
          font-size: 10px;
        }

        .institution-value {
          color: #e5e5e9;
          font-size: 12px;
          white-space: nowrap;
        }

        .empty-distribution {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 145px;
          text-align: center;
          color: #a0a0a8;
        }

        .empty-distribution > span {
          margin-bottom: 10px;
          font-size: 27px;
        }

        .empty-distribution strong {
          color: #e3e3e7;
          font-size: 12px;
        }

        .empty-distribution p {
          max-width: 320px;
          margin: 7px 0 0;
          font-size: 11px;
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
          font-size: 10px;
          white-space: nowrap;
        }

        .filters {
          display: grid;
          grid-template-columns: 2fr 1.2fr 1.2fr 1fr;
          gap: 10px;
          margin-bottom: 15px;
        }

        .search-field,
        .filter-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .filters label {
          color: #bdbdc5;
          font-size: 10px;
          font-weight: 600;
        }

        .filters input,
        .filters select {
          width: 100%;
          height: 37px;
          padding: 0 10px;
          border: 1px solid #38383e;
          border-radius: 6px;
          outline: none;
          color: #ededf0;
          background: #202024;
          font-size: 11px;
          box-sizing: border-box;
        }

        .filters input:focus,
        .filters select:focus {
          border-color: #85858d;
        }

        .filters input::placeholder {
          color: #777780;
        }

        .investment-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .investment-item {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px;
          border: 1px solid #2d2d32;
          border-radius: 8px;
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
          width: 39px;
          height: 39px;
          flex-shrink: 0;
          border-radius: 8px;
          color: #dedee3;
          background: #303035;
          font-size: 19px;
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
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .investment-info span,
        .investment-info small {
          color: #a0a0a8;
          font-size: 10px;
        }

        .investment-value {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 125px;
        }

        .investment-value span {
          color: #92929a;
          font-size: 10px;
        }

        .investment-value strong {
          color: #ededf0;
          font-size: 13px;
        }

        .investment-status {
          min-width: 85px;
          text-align: right;
        }

        .status {
          display: inline-block;
          padding: 5px 8px;
          border-radius: 5px;
          font-size: 10px;
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
          padding: 40px 15px;
          text-align: center;
          color: #aaaab2;
        }

        .empty-state > span {
          display: block;
          margin-bottom: 12px;
          font-size: 32px;
        }

        .empty-state strong {
          color: #e3e3e7;
          font-size: 13px;
        }

        .empty-state p {
          max-width: 430px;
          margin: 8px 0 0;
          font-size: 11px;
          line-height: 1.6;
        }

        .information {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 15px;
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
          font-size: 12px;
        }

        .information p {
          margin: 5px 0 0;
          color: #a5a5ad;
          font-size: 11px;
          line-height: 1.6;
        }

        footer {
          padding: 8px;
          color: #77777f;
          text-align: center;
          font-size: 10px;
        }

        @media (max-width: 950px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .investments-page {
            padding: 15px;
            gap: 12px;
          }

          .investments-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
          }

          .breadcrumb {
            flex-wrap: wrap;
            margin-bottom: 14px;
          }

          h1 {
            font-size: 24px;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .summary-card {
            padding: 14px;
          }

          .summary-card strong {
            font-size: 20px;
          }

          .panel {
            padding: 13px;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .investment-item {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .investment-info {
            min-width: calc(100% - 55px);
          }

          .investment-value {
            margin-left: 52px;
          }

          .investment-status {
            margin-left: auto;
          }

          .history-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .institution-value {
            font-size: 11px;
          }
        }

        @media (max-width: 400px) {
          .institution-item {
            flex-wrap: wrap;
          }

          .institution-value {
            width: 100%;
            margin-left: 44px;
          }

          .investment-value {
            margin-left: 0;
          }
        }
      `}</style>
    </main>
  );
}
