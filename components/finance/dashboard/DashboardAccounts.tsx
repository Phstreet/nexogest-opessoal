
"use client";

import Link from "next/link";
import type { Account } from "@/lib/finance/types";
import { getAccountBalance } from "@/lib/finance/accounts";

type DashboardAccountsProps = {
  accounts: Account[];
  accountBalance: number;
  reserveBalance: number;
  money: (value: number) => string;
};

export default function DashboardAccounts({
  accounts,
  accountBalance,
  reserveBalance,
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
          <p>Saldos atualizados pelas movimentações efetivadas.</p>
        </div>

        <Link href="/financeiro/contas" className="panel-link">
          Ver contas →
        </Link>
      </div>

      <div className="account-total">
        <span>Saldo total das contas ativas</span>
        <strong>{money(accountBalance)}</strong>
      </div>

      <div className="account-total">
        <span>Saldo total das reservas ativas</span>
        <strong>{money(reserveBalance)}</strong>
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
                {money(getAccountBalance(account))}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state compact">
          <strong>Nenhuma conta cadastrada</strong>
          <p>
            Cadastre suas contas para acompanhar os saldos atualizados.
          </p>
        </div>
      )}
    </article>
  );
}
