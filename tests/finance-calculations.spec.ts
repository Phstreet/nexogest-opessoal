import { test, expect } from "@playwright/test";
import { getAccountBalanceFrom, getSettledTransactionAmount } from "../lib/finance/accounts";
import { getFinancialSummary } from "../lib/finance/calculations";
import { calculateFinanceTotals, getSettledAmount, isInvestmentApplied } from "../lib/finance/finance-utils";
import type { Account, Transaction } from "../lib/finance/types";

const account: Account = {
  id: 1,
  name: "Conta principal",
  institution: "Banco de teste",
  type: "Conta corrente",
  initialBalance: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  active: true,
};

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    description: "Lançamento de teste",
    type: "Receita",
    amount: 100,
    account: account.name,
    status: "Pendente",
    ...overrides,
  };
}

test.describe("NEXO - Regra central de liquidação financeira", () => {
  test("trata receita com status Pago como liquidada também no saldo da conta", () => {
    const item = transaction({ status: "Pago" });
    expect(getSettledTransactionAmount(item)).toBe(100);
    expect(getAccountBalanceFrom(account, [item])).toBe(100);
    const summary = getFinancialSummary([item], [account], [], []);
    expect(summary.totalIncome).toBe(100);
    expect(summary.accountsBalance).toBe(100);
  });

  test("usa o valor efetivamente pago em uma despesa parcial", () => {
    const item = transaction({
      type: "Despesa",
      amount: 100,
      status: "Paga parcialmente",
      settledAmount: 35,
    });
    expect(getSettledTransactionAmount(item)).toBe(35);
    expect(getSettledAmount(item)).toBe(35);
    expect(calculateFinanceTotals([item]).despesasRealizadas).toBe(35);
    expect(getAccountBalanceFrom(account, [item])).toBe(-35);
    const summary = getFinancialSummary([item], [account], [], []);
    expect(summary.totalExpenses).toBe(35);
    expect(summary.accountsBalance).toBe(-35);
    expect(summary.payable).toBe(65);
  });

  test("não transforma settledAmount nulo em liquidação de valor integral", () => {
    const item = transaction({
      type: "Despesa",
      amount: 100,
      status: "Paga parcialmente",
      settledAmount: null as unknown as number,
    });
    expect(getSettledTransactionAmount(item)).toBe(0);
  });

  test("reconhece status de cancelamento sem depender de caixa ou acento", () => {
    const item = transaction({ status: "CANCELÁDA" });
    expect(getSettledTransactionAmount(item)).toBe(0);
    expect(getSettledAmount(item)).toBe(0);
    expect(calculateFinanceTotals([item]).receitasRealizadas).toBe(0);
    expect(getAccountBalanceFrom(account, [item])).toBe(0);
  });
});
