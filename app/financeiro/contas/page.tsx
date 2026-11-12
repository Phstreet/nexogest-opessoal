
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Account = {
  id: number;
  name: string;
  institution: string;
  type: string;
  initialBalance: number;
  createdAt: string;
  active: boolean;
};

const STORAGE_KEY = "nexo_accounts";

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

const accountTypes = [
  "Conta corrente",
  "Conta poupança",
  "Carteira digital",
  "Dinheiro em espécie",
  "Conta de investimento",
  "Outro",
];

const institutions = [
  "Nubank",
  "Banco Inter",
  "Itaú",
  "Bradesco",
  "Banco do Brasil",
  "Caixa Econômica Federal",
  "Santander",
  "C6 Bank",
  "BTG Pactual",
  "Mercado Pago",
  "PicPay",
  "Outra instituição",
];

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return NaN;

  if (normalized.includes(",")) {
    return Number(normalized.replace(/\./g, "").replace(",", "."));
  }

  return Number(normalized);
}

function localDate() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function ContasFinanceirasPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("Nubank");
  const [type, setType] = useState("Conta corrente");
  const [initialBalance, setInitialBalance] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setAccounts(parsed);
        }
      }
    } catch {
      console.error("Não foi possível carregar as contas.");
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    }
  }, [accounts, loaded]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.active),
    [accounts]
  );

  const totalInitialBalance = useMemo(
    () =>
      activeAccounts.reduce(
        (sum, account) => sum + account.initialBalance,
        0
      ),
    [activeAccounts]
  );

  const filteredAccounts = accounts.filter((account) => {
    if (filter === "Todas") return true;
    if (filter === "Ativas") return account.active;
    return !account.active;
  });

  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedBalance = parseAmount(initialBalance);

    if (!name.trim()) {
      alert("Informe o nome da conta.");
      return;
    }

    if (!Number.isFinite(parsedBalance)) {
      alert("Informe um saldo inicial válido.");
      return;
    }

    const duplicate = accounts.some(
      (account) =>
        account.name.toLowerCase() === name.trim().toLowerCase() &&
        account.active
    );

    if (duplicate) {
      alert("Já existe uma conta ativa com esse nome.");
      return;
    }

    const newAccount: Account = {
      id: Date.now(),
      name: name.trim(),
      institution,
      type,
      initialBalance: parsedBalance,
      createdAt: localDate(),
      active: true,
    };

    setAccounts((current) => [newAccount, ...current]);

    setName("");
    setInstitution("Nubank");
    setType("Conta corrente");
    setInitialBalance("");
  }

  function toggleAccount(id: number) {
    setAccounts((current) =>
      current.map((account) =>
        account.id === id
          ? { ...account, active: !account.active }
          : account
      )
    );
  }

  function removeAccount(id: number) {
    const confirmed = confirm(
      "Deseja excluir definitivamente esta conta? Essa ação não poderá ser desfeita."
    );

    if (!confirmed) return;

    setAccounts((current) =>
      current.filter((account) => account.id !== id)
    );
  }

  return (
    <main className="accounts-page">
      <header className="accounts-header">
        <div className="header-content">
          <div className="breadcrumb">
            <Link href="/">Início</Link>
            <span>/</span>
            <Link href="/financeiro">Financeiro</Link>
            <span>/</span>
            <span>Contas</span>
          </div>

          <span className="eyebrow">NEXO / GESTÃO FINANCEIRA</span>

          <h1>Contas financeiras</h1>

          <p>
            Cadastre suas contas e organize os saldos disponíveis.
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
          const active = item.href === "/financeiro/contas";

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
        <article className="summary-card">
          <div className="summary-top">
            <span>Contas cadastradas</span>
            <span className="summary-icon">▣</span>
          </div>
          <strong>{accounts.length}</strong>
          <small>Total de contas registradas</small>
        </article>

        <article className="summary-card">
          <div className="summary-top">
            <span>Contas ativas</span>
            <span className="summary-icon">✓</span>
          </div>
          <strong>{activeAccounts.length}</strong>
          <small>Disponíveis para movimentação</small>
        </article>

        <article className="summary-card featured">
          <div className="summary-top">
            <span>Saldo inicial total</span>
            <span className="summary-icon">R$</span>
          </div>
          <strong>{money(totalInitialBalance)}</strong>
          <small>Soma dos saldos iniciais das contas ativas</small>
        </article>
      </section>

      <section className="account-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CADASTRO</span>
            <h2>Nova conta</h2>
            <p>Cadastre uma conta para organizar seu patrimônio financeiro.</p>
          </div>
        </div>

        <form onSubmit={addAccount}>
          <div className="form-grid">
            <div className="field">
              <label>Nome da conta</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Minha conta principal"
                required
              />
            </div>

            <div className="field">
              <label>Banco / Instituição</label>
              <select
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
              >
                {institutions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Tipo de conta</label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {accountTypes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Saldo inicial (R$)</label>
              <input
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit">+ Cadastrar conta</button>
          </div>
        </form>
      </section>

      <section className="account-panel">
        <div className="section-heading history-heading">
          <div>
            <span className="eyebrow">CONTROLE</span>
            <h2>Minhas contas</h2>
            <p>Consulte, ative ou desative suas contas cadastradas.</p>
          </div>

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="filter-select"
          >
            <option>Todas</option>
            <option>Ativas</option>
            <option>Inativas</option>
          </select>
        </div>

        {!loaded ? (
          <div className="empty-state">
            <strong>Carregando contas...</strong>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="empty-state">
            <span>▣</span>
            <strong>Nenhuma conta cadastrada</strong>
            <p>
              Cadastre sua primeira conta para começar a organizar seu
              patrimônio financeiro.
            </p>
          </div>
        ) : (
          <div className="account-list">
            {filteredAccounts.map((account) => (
              <article className="account-item" key={account.id}>
                <div className="account-icon">▣</div>

                <div className="account-info">
                  <strong>{account.name}</strong>
                  <span>
                    {account.institution} · {account.type}
                  </span>
                  <small>
                    Cadastrada em{" "}
                    {new Date(
                      account.createdAt + "T12:00:00"
                    ).toLocaleDateString("pt-BR")}
                  </small>
                </div>

                <div className="account-balance">
                  <span>Saldo inicial</span>
                  <strong>{money(account.initialBalance)}</strong>
                </div>

                <div className="account-actions">
                  <span
                    className={
                      account.active ? "status active" : "status inactive"
                    }
                  >
                    {account.active ? "Ativa" : "Inativa"}
                  </span>

                  <button
                    type="button"
                    onClick={() => toggleAccount(account.id)}
                    title={account.active ? "Desativar conta" : "Ativar conta"}
                  >
                    {account.active ? "Desativar" : "Ativar"}
                  </button>

                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => removeAccount(account.id)}
                    title="Excluir conta"
                  >
                    ×
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="information">
        <strong>Importante</strong>
        <p>
          Nesta etapa, o sistema registra os saldos iniciais. O saldo
          disponível será calculado na próxima etapa, considerando receitas,
          despesas, transferências, aplicações e resgates efetivados.
          Os lançamentos existentes não serão alterados.
        </p>
      </div>

      <footer>NEXO · Planeje. Organize. Conquiste.</footer>

      <style jsx global>{`
        .accounts-page {
          min-height: 100vh;
          padding: 32px;
          color: #f5f5f6;
          background: #0a0a0b;
          font-family: "DM Sans", sans-serif;
          box-sizing: border-box;
        }

        .accounts-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .header-content {
          min-width: 0;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
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

        .eyebrow {
          display: block;
          color: #888891;
          font-size: 10px;
          letter-spacing: 1.5px;
          font-weight: 700;
        }

        .accounts-header h1 {
          margin: 7px 0;
          font-family: "Manrope", sans-serif;
          font-size: 29px;
          font-weight: 700;
          letter-spacing: -1px;
        }

        .accounts-header p {
          margin: 8px 0 0;
          color: #89898f;
          font-size: 13px;
        }

        .header-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: flex-end;
          gap: 10px;
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

        .back-link:hover {
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
          box-sizing: border-box;
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
          white-space: nowrap;
          transition: 0.2s;
          box-sizing: border-box;
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
          line-height: 1;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
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
          font-size: 12px;
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

        .summary-card.featured {
          border-color: #494950;
          background: #202024;
        }

        .account-panel {
          margin-bottom: 20px;
          padding: 22px 23px;
          border: 1px solid #29292d;
          border-radius: 13px;
          background: #111113;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 20px;
        }

        .section-heading h2 {
          margin: 5px 0 0;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 16px;
          font-weight: 700;
        }

        .section-heading p {
          margin: 6px 0 0;
          color: #85858b;
          font-size: 12px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 2fr 1.4fr 1.3fr 1fr;
          gap: 12px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .field label {
          color: #bdbdc5;
          font-size: 11px;
          font-weight: 600;
        }

        .field input,
        .field select,
        .filter-select {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border: 1px solid #303034;
          border-radius: 8px;
          outline: none;
          color: #e5e5e7;
          background: #151517;
          font: inherit;
          font-size: 12px;
          box-sizing: border-box;
        }

        .field input:focus,
        .field select:focus,
        .filter-select:focus {
          border-color: #777d87;
        }

        .field input::placeholder {
          color: #707077;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 17px;
        }

        .form-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 17px;
          border: 1px solid #77777f;
          border-radius: 8px;
          color: #fff;
          background: #303035;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
        }

        .form-actions button:hover {
          background: #414147;
        }

        .filter-select {
          width: 155px;
          flex-shrink: 0;
        }

        .account-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .account-item {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 15px;
          border: 1px solid #29292d;
          border-radius: 9px;
          background: #151517;
          transition: 0.2s;
        }

        .account-item:hover {
          background: #19191c;
        }

        .account-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 39px;
          height: 39px;
          flex-shrink: 0;
          border: 1px solid #303034;
          border-radius: 8px;
          color: #c3c7ce;
          background: #1b1b1e;
          font-size: 19px;
        }

        .account-info {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .account-info strong {
          color: #ededee;
          font-size: 12px;
          font-weight: 600;
        }

        .account-info span,
        .account-info small {
          color: #85858b;
          font-size: 11px;
        }

        .account-balance {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 140px;
        }

        .account-balance span {
          color: #85858b;
          font-size: 10px;
        }

        .account-balance strong {
          color: #f0f0f1;
          font-size: 14px;
          font-weight: 700;
        }

        .account-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border: 1px solid #343438;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
        }

        .status.active {
          border-color: #35443b;
          color: #a8c7b3;
          background: #18201b;
        }

        .status.inactive {
          border-color: #39393d;
          color: #85858b;
          background: #1b1b1e;
        }

        .account-actions button {
          min-height: 30px;
          padding: 0 10px;
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

        .account-actions button:hover {
          border-color: #777d87;
          background: #29292d;
        }

        .account-actions .delete-button {
          width: 30px;
          height: 30px;
          padding: 0;
          color: #d18c8c;
          font-size: 17px;
        }

        .empty-state {
          min-height: 170px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 25px 15px;
          text-align: center;
        }

        .empty-state > span {
          margin-bottom: 10px;
          color: #777d87;
          font-size: 25px;
        }

        .empty-state strong {
          color: #dedee0;
          font-size: 13px;
        }

        .empty-state p {
          margin: 7px 0 0;
          color: #85858b;
          font-size: 11px;
          line-height: 1.5;
        }

        .information {
          margin-bottom: 5px;
          padding: 15px 17px;
          border: 1px solid #29292d;
          border-radius: 9px;
          background: #151517;
        }

        .information strong {
          color: #ededee;
          font-size: 12px;
        }

        .information p {
          margin: 6px 0 0;
          color: #85858b;
          font-size: 11px;
          line-height: 1.6;
        }

        .accounts-page footer {
          padding: 8px;
          color: #77777f;
          text-align: center;
          font-size: 10px;
        }

        @media (max-width: 1050px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .account-item {
            flex-wrap: wrap;
          }

          .account-info {
            min-width: calc(100% - 60px);
          }

          .account-balance {
            margin-left: 52px;
          }

          .account-actions {
            margin-left: auto;
          }
        }

        @media (max-width: 700px) {
          .accounts-page {
            padding: 20px 14px;
          }

          .accounts-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .accounts-header h1 {
            font-size: 25px;
          }

          .header-actions {
            width: 100%;
            align-items: flex-start;
            flex-direction: row;
            justify-content: space-between;
            flex-wrap: wrap;
          }

          .summary-grid {
            gap: 10px;
          }

          .summary-card {
            padding: 15px;
          }

          .summary-card > strong {
            font-size: 19px;
          }

          .account-panel {
            padding: 18px;
          }

          .section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .filter-select {
            width: 100%;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-actions button {
            width: 100%;
          }

          .account-item {
            align-items: flex-start;
          }

          .account-balance {
            margin-left: 0;
          }

          .account-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }

        @media (max-width: 380px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
