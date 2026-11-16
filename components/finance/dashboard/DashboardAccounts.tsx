
"use client";

import Link from "next/link";
import type { Account } from "@/lib/finance/types";

type DashboardAccountsProps = {
  accounts: Account[];
  accountBalance: number;
  money: (value: number) => string;
};

function parseAmount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function DashboardAccounts({
  accounts,
  accountBalance,
  money,
}: DashboardAccountsProps) {
  const activeAccounts = accounts
    .filter((account) => account.active)
    .slice(0, 5);

  return (
    <article className="panel account-panel">
      <div className="panel-header">
        <div>
          <span className="section-eyebrow">CONTAS FINANCEIRAS</span>
          <h3>Contas cadastradas</h3>
          <p>Resumo dos saldos iniciais informados.</p>
        </div>

        <Link href="/financeiro/contas" className="panel-link">
          Ver contas →
        </Link>
      </div>

      <div className="account-total">
        <span>Total de saldos iniciais</span>
        <strong>{money(accountBalance)}</strong>
      </div>

      {activeAccounts.length > 0 ? (
        <div className="account-list">
          {activeAccounts.map((account) => (
            <div className="account-item" key={account.id}>
              <div className="account-symbol">▣</div>

              <div className="account-info">
                <strong>{account.name}</strong>
                <span>{account.institution || account.type}</span>
              </div>

              <strong className="account-value">
                {money(parseAmount(account.initialBalance))}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state compact">
          <strong>Nenhuma conta cadastrada</strong>
          <p>
            Cadastre suas contas para visualizar os saldos iniciais.
          </p>
        </div>
      )}
    </article>
  );
}
