
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

function formatDate(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString("pt-BR");
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

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        if (filter === "Todas") return true;
        if (filter === "Ativas") return account.active;
        return !account.active;
      }),
    [accounts, filter]
  );

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
    <div className="content accounts-content">
      <section className="accounts-intro">
        <div>
          <span className="accounts-eyebrow">
            GESTÃO FINANCEIRA
          </span>
          <h2>Minhas contas</h2>
          <p>
            Centralize suas contas bancárias, carteiras e demais
            recursos financeiros em um só lugar.
          </p>
        </div>

        <Link href="/financeiro" className="accounts-back-link">
          <span>←</span>
          Voltar ao financeiro
        </Link>
      </section>

      <section className="accounts-summary-grid">
        <article className="accounts-summary-card">
          <div className="accounts-summary-top">
            <span>Contas cadastradas</span>
            <span className="accounts-summary-icon">▣</span>
          </div>
          <strong>{accounts.length}</strong>
          <small>Total de contas registradas</small>
        </article>

        <article className="accounts-summary-card">
          <div className="accounts-summary-top">
            <span>Contas ativas</span>
            <span className="accounts-summary-icon">✓</span>
          </div>
          <strong>{activeAccounts.length}</strong>
          <small>Disponíveis para movimentação</small>
        </article>

        <article className="accounts-summary-card featured">
          <div className="accounts-summary-top">
            <span>Saldo inicial total</span>
            <span className="accounts-summary-icon">R$</span>
          </div>
          <strong>{money(totalInitialBalance)}</strong>
          <small>
            Soma dos saldos iniciais das contas ativas
          </small>
        </article>
      </section>

      <section className="accounts-panel">
        <div className="accounts-section-heading">
          <div>
            <span className="accounts-eyebrow">CADASTRO</span>
            <h2>Nova conta</h2>
            <p>
              Cadastre uma conta para organizar seu patrimônio
              financeiro.
            </p>
          </div>
        </div>

        <form onSubmit={addAccount}>
          <div className="accounts-form-grid">
            <div className="accounts-field">
              <label htmlFor="account-name">Nome da conta</label>
              <input
                id="account-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Minha conta principal"
                required
              />
            </div>

            <div className="accounts-field">
              <label htmlFor="account-institution">
                Banco / Instituição
              </label>
              <select
                id="account-institution"
                value={institution}
                onChange={(event) =>
                  setInstitution(event.target.value)
                }
              >
                {institutions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="accounts-field">
              <label htmlFor="account-type">Tipo de conta</label>
              <select
                id="account-type"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {accountTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="accounts-field">
              <label htmlFor="account-balance">
                Saldo inicial (R$)
              </label>
              <input
                id="account-balance"
                value={initialBalance}
                onChange={(event) =>
                  setInitialBalance(event.target.value)
                }
                placeholder="0,00"
                inputMode="decimal"
                required
              />
            </div>
          </div>

          <div className="accounts-form-actions">
            <button type="submit">
              <span>+</span>
              Cadastrar conta
            </button>
          </div>
        </form>
      </section>

      <section className="accounts-panel">
        <div className="accounts-section-heading accounts-history-heading">
          <div>
            <span className="accounts-eyebrow">CONTROLE</span>
            <h2>Contas cadastradas</h2>
            <p>
              Consulte, ative, desative ou exclua suas contas.
            </p>
          </div>

          <div className="accounts-filter">
            <label htmlFor="account-filter">Exibir</label>
            <select
              id="account-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="Todas">Todas</option>
              <option value="Ativas">Ativas</option>
              <option value="Inativas">Inativas</option>
            </select>
          </div>
        </div>

        {!loaded ? (
          <div className="accounts-empty-state">
            <strong>Carregando contas...</strong>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="accounts-empty-state">
            <span>▣</span>
            <strong>Nenhuma conta encontrada</strong>
            <p>
              {filter === "Todas"
                ? "Cadastre sua primeira conta para começar a organizar seu patrimônio financeiro."
                : `Não existem contas ${filter.toLowerCase()} no momento.`}
            </p>
          </div>
        ) : (
          <div className="accounts-list">
            {filteredAccounts.map((account) => (
              <article
                className="accounts-item"
                key={account.id}
              >
                <div className="accounts-item-icon">▣</div>

                <div className="accounts-item-info">
                  <strong>{account.name}</strong>
                  <span>
                    {account.institution} · {account.type}
                  </span>
                  <small>
                    Cadastrada em {formatDate(account.createdAt)}
                  </small>
                </div>

                <div className="accounts-item-balance">
                  <span>Saldo inicial</span>
                  <strong>
                    {money(account.initialBalance)}
                  </strong>
                </div>

                <div className="accounts-item-actions">
                  <span
                    className={
                      account.active
                        ? "accounts-status active"
                        : "accounts-status inactive"
                    }
                  >
                    {account.active ? "Ativa" : "Inativa"}
                  </span>

                  <button
                    type="button"
                    onClick={() => toggleAccount(account.id)}
                    title={
                      account.active
                        ? "Desativar conta"
                        : "Ativar conta"
                    }
                  >
                    {account.active ? "Desativar" : "Ativar"}
                  </button>

                  <button
                    type="button"
                    className="accounts-delete-button"
                    onClick={() => removeAccount(account.id)}
                    title="Excluir conta"
                    aria-label={`Excluir conta ${account.name}`}
                  >
                    ×
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="accounts-information">
        <div className="accounts-information-icon">i</div>
        <div>
          <strong>Importante</strong>
          <p>
            Nesta etapa, o sistema registra os saldos iniciais. O
            saldo disponível será calculado posteriormente,
            considerando receitas, despesas, transferências,
            aplicações e resgates efetivados. Os lançamentos
            existentes não serão alterados.
          </p>
        </div>
      </section>

      <footer className="accounts-footer">
        NEXO · Planeje. Organize. Conquiste.
      </footer>

      <style jsx global>{`
        .accounts-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .accounts-intro {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
        }

        .accounts-eyebrow {
          display: block;
          color: #888891;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .accounts-intro h2 {
          margin: 6px 0 0;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .accounts-intro p {
          margin: 6px 0 0;
          color: #89898f;
          font-size: 12px;
          line-height: 1.5;
        }

        .accounts-back-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 37px;
          padding: 0 13px;
          flex-shrink: 0;
          border: 1px solid #303034;
          border-radius: 8px;
          color: #e5e5e7;
          background: #151517;
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
          transition: 0.2s;
        }

        .accounts-back-link:hover {
          border-color: #777d87;
          background: #202024;
        }

        .accounts-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .accounts-summary-card {
          min-width: 0;
          padding: 19px;
          border: 1px solid #29292d;
          border-radius: 12px;
          background: #151517;
        }

        .accounts-summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #99999f;
          font-size: 11px;
        }

        .accounts-summary-icon {
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

        .accounts-summary-card > strong {
          display: block;
          margin-top: 16px;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 23px;
          font-weight: 700;
          letter-spacing: -0.7px;
          overflow-wrap: anywhere;
        }

        .accounts-summary-card > small {
          display: block;
          margin-top: 7px;
          color: #77777e;
          font-size: 10px;
          line-height: 1.5;
        }

        .accounts-summary-card.featured {
          border-color: #494950;
          background: #202024;
        }

        .accounts-panel {
          min-width: 0;
          padding: 22px;
          border: 1px solid #29292d;
          border-radius: 12px;
          background: #111113;
        }

        .accounts-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 19px;
        }

        .accounts-section-heading h2 {
          margin: 5px 0 0;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 15px;
          font-weight: 700;
        }

        .accounts-section-heading p {
          margin: 6px 0 0;
          color: #85858b;
          font-size: 11px;
          line-height: 1.5;
        }

        .accounts-form-grid {
          display: grid;
          grid-template-columns: 2fr 1.4fr 1.3fr 1fr;
          gap: 12px;
        }

        .accounts-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        .accounts-field label {
          color: #bdbdc5;
          font-size: 10px;
          font-weight: 600;
        }

        .accounts-field input,
        .accounts-field select,
        .accounts-filter select {
          width: 100%;
          height: 39px;
          padding: 0 11px;
          border: 1px solid #303034;
          border-radius: 8px;
          outline: none;
          color: #e5e5e7;
          background: #151517;
          font: inherit;
          font-size: 11px;
          box-sizing: border-box;
        }

        .accounts-field input:focus,
        .accounts-field select:focus,
        .accounts-filter select:focus {
          border-color: #777d87;
        }

        .accounts-field input::placeholder {
          color: #707077;
        }

        .accounts-form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 17px;
        }

        .accounts-form-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 39px;
          padding: 0 16px;
          border: 1px solid #77777f;
          border-radius: 8px;
          color: #fff;
          background: #303035;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
        }

        .accounts-form-actions button:hover {
          background: #414147;
        }

        .accounts-form-actions button span {
          font-size: 16px;
        }

        .accounts-history-heading {
          align-items: flex-end;
        }

        .accounts-filter {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .accounts-filter label {
          color: #85858b;
          font-size: 10px;
        }

        .accounts-filter select {
          width: 140px;
        }

        .accounts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .accounts-item {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
          padding: 14px;
          border: 1px solid #29292d;
          border-radius: 9px;
          background: #151517;
          transition: 0.2s;
        }

        .accounts-item:hover {
          background: #19191c;
        }

        .accounts-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border: 1px solid #303034;
          border-radius: 8px;
          color: #c3c7ce;
          background: #1b1b1e;
          font-size: 18px;
        }

        .accounts-item-info {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .accounts-item-info strong {
          color: #ededee;
          font-size: 11px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .accounts-item-info span,
        .accounts-item-info small {
          color: #85858b;
          font-size: 10px;
        }

        .accounts-item-balance {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 130px;
        }

        .accounts-item-balance span {
          color: #85858b;
          font-size: 9px;
        }

        .accounts-item-balance strong {
          color: #f0f0f1;
          font-size: 13px;
          font-weight: 700;
        }

        .accounts-item-actions {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
        }

        .accounts-status {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border: 1px solid #343438;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 600;
        }

        .accounts-status.active {
          border-color: #35443b;
          color: #a8c7b3;
          background: #18201b;
        }

        .accounts-status.inactive {
          border-color: #39393d;
          color: #85858b;
          background: #1b1b1e;
        }

        .accounts-item-actions button {
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

        .accounts-item-actions button:hover {
          border-color: #777d87;
          background: #29292d;
        }

        .accounts-item-actions .accounts-delete-button {
          width: 29px;
          height: 29px;
          padding: 0;
          color: #d18c8c;
          font-size: 17px;
        }

        .accounts-empty-state {
          min-height: 160px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 25px 15px;
          text-align: center;
        }

        .accounts-empty-state > span {
          margin-bottom: 10px;
          color: #777d87;
          font-size: 25px;
        }

        .accounts-empty-state strong {
          color: #dedee0;
          font-size: 12px;
        }

        .accounts-empty-state p {
          max-width: 440px;
          margin: 7px 0 0;
          color: #85858b;
          font-size: 10px;
          line-height: 1.6;
        }

        .accounts-information {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 17px;
          border: 1px solid #29292d;
          border-radius: 9px;
          background: #151517;
        }

        .accounts-information-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          flex-shrink: 0;
          border: 1px solid #414148;
          border-radius: 50%;
          color: #c3c7ce;
          font-size: 11px;
          font-weight: 700;
        }

        .accounts-information strong {
          color: #ededee;
          font-size: 11px;
        }

        .accounts-information p {
          margin: 5px 0 0;
          color: #85858b;
          font-size: 10px;
          line-height: 1.6;
        }

        .accounts-footer {
          padding: 8px;
          color: #77777f;
          text-align: center;
          font-size: 9px;
        }

        @media (max-width: 1100px) {
          .accounts-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .accounts-form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .accounts-item {
            flex-wrap: wrap;
          }

          .accounts-item-info {
            min-width: calc(100% - 55px);
          }

          .accounts-item-balance {
            margin-left: 51px;
          }

          .accounts-item-actions {
            margin-left: auto;
          }
        }

        @media (max-width: 700px) {
          .accounts-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          .accounts-summary-grid {
            gap: 10px;
          }

          .accounts-summary-card {
            padding: 15px;
          }

          .accounts-summary-card > strong {
            font-size: 19px;
          }

          .accounts-panel {
            padding: 17px;
          }

          .accounts-form-grid {
            grid-template-columns: 1fr;
          }

          .accounts-form-actions button {
            width: 100%;
          }

          .accounts-history-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .accounts-filter {
            width: 100%;
            justify-content: space-between;
          }

          .accounts-filter select {
            flex: 1;
          }

          .accounts-item {
            align-items: flex-start;
          }

          .accounts-item-balance {
            margin-left: 0;
          }

          .accounts-item-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }

        @media (max-width: 420px) {
          .accounts-summary-grid {
            grid-template-columns: 1fr;
          }

          .accounts-item-actions {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}
