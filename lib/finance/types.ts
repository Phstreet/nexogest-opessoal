
/**
 * NEXO — Tipos centrais do módulo financeiro
 * Arquivo: lib/finance/types.ts
 *
 * Estrutura preparada para centralizar movimentações,
 * contas, reservas e investimentos.
 */

export type MovementType =
  | "Receita"
  | "Despesa"
  | "Transferência"
  | "Investimento"
  | "Aplicação"
  | "Reserva";

export type TransactionStatus =
  | "Pendente"
  | "Pago"
  | "Recebida"
  | "Parcial"
  | "Cancelada"
  | "Aplicado"
  | "Prevista";

export type AccountType =
  | "Conta corrente"
  | "Conta poupança"
  | "Carteira"
  | "Dinheiro"
  | "Conta digital"
  | "Investimento"
  | "Outro";

export type Transaction = {
  id: number;
  description: string;
  type: MovementType;
  amount: number;

  date?: string;
  category?: string;
  subcategory?: string;

  account?: string;
  destinationAccount?: string;

  paymentMethod?: string;
  status?: string;
  recurrence?: string;

  reserveType?: string;
  investment?: string;
  institution?: string;

  createdAt?: string;
  updatedAt?: string;
};

export type Account = {
  id: number;
  name: string;
  institution: string;
  type: string;
  initialBalance: number;
  createdAt: string;
  active: boolean;

  initialBalanceDate?: string;
  updatedAt?: string;
};

export type ReserveCategory =
  | "Emergência"
  | "Objetivo pessoal"
  | "Moradia"
  | "Viagem"
  | "Investimentos"
  | "Outros";

export type ReserveStatus =
  | "Ativa"
  | "Concluída"
  | "Pausada";

export type ReserveMovementType =
  | "Aporte"
  | "Resgate"
  | "Rendimento"
  | "Ajuste";

export type Reserve = {
  id: number;
  name: string;
  category: ReserveCategory;
  description: string;

  targetAmount: number;
  initialBalance: number;
  monthlyContribution: number;

  startDate: string;
  targetDate: string;

  accountId: number | null;
  institution: string;

  status: ReserveStatus;
  createdAt: string;
};

export type ReserveMovement = {
  id: number;
  reserveId: number;
  type: ReserveMovementType;
  amount: number;
  date: string;
  description: string;
  createdAt: string;
};

export type InvestmentStatus =
  | "Pendente"
  | "Aplicado"
  | "Resgatado"
  | "Cancelado";

export type Investment = {
  id: number;
  name: string;
  type: string;
  institution: string;

  initialAmount: number;
  currentAmount?: number;

  applicationDate: string;
  maturityDate?: string;

  account?: string;
  status: InvestmentStatus;

  createdAt: string;
  updatedAt?: string;
};

export type FinancialSummary = {
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
  totalReserves: number;

  realizedBalance: number;
  projectedBalance: number;

  accountsBalance: number;
  payable: number;
  receivable: number;
};
