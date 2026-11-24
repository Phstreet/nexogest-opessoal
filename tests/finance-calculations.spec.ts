import { test, expect } from "@playwright/test";
import { getAccountBalanceFrom, getSettledTransactionAmount } from "../lib/finance/accounts";
import { getFinancialSummary, getMonthlySummary } from "../lib/finance/calculations";
import { addMoney, subtractMoney, sumMoney } from "../lib/finance/money";
import { getSaoPauloDateKey } from "../lib/date/sao-paulo";
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
  test("usa a mesma regra normalizada para investimentos aplicados e cancelados", () => {
    const applied = transaction({ type: "Investimento", status: "APLICADO" });
    expect(isInvestmentApplied(applied)).toBe(true);
    expect(calculateFinanceTotals([applied]).investimentosAplicados).toBe(100);

    const cancelled = transaction({ type: "Investimento", status: "CANCELADO" });
    expect(isInvestmentApplied(cancelled)).toBe(false);
    expect(calculateFinanceTotals([cancelled]).investimentosAplicados).toBe(0);
  });

  test("soma valores monetários em centavos sem erro de ponto flutuante", () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
    expect(subtractMoney(0.3, 0.1)).toBe(0.2);
  });

  test("mantém totais, saldos e pendências em centavos", () => {
    const entries = [
      transaction({ id: 1, amount: 0.1, status: "Pago", date: "2026-11-24" }),
      transaction({ id: 2, amount: 0.2, status: "Pago", date: "2026-11-24" }),
      transaction({ id: 3, type: "Despesa", amount: 0.1, status: "Pago", date: "2026-11-24" }),
      transaction({ id: 4, type: "Despesa", amount: 0.2, status: "Pendente", date: "2026-11-24" }),
    ];
    const summary = getFinancialSummary(entries, [account], [], []);
    expect(summary.totalIncome).toBe(0.3);
    expect(summary.totalExpenses).toBe(0.1);
    expect(summary.realizedBalance).toBe(0.2);
    expect(summary.payable).toBe(0.2);
    expect(summary.accountsBalance).toBe(0.2);

    const monthly = getMonthlySummary(entries, 2026, 10);
    expect(monthly.income).toBe(0.3);
    expect(monthly.expenses).toBe(0.3);
    expect(monthly.balance).toBe(0);
  });

  test("calcula o dia civil no fuso de São Paulo", () => {
    expect(getSaoPauloDateKey(new Date("2026-11-24T02:00:00.000Z"))).toBe("2026-11-23");
  });

});
