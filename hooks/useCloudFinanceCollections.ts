"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Account, Reserve, ReserveMovement, Transaction } from "@/lib/finance/types";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import { fetchRemoteCollections, saveRemoteCollection } from "@/lib/supabase/client";

type CollectionKey = "nexo_transactions" | "nexo_accounts" | "nexo_reserves" | "nexo_reserve_movements" | "nexo_planning_budgets" | "nexo_planning_goals";
type FinanceState = {
  transactions: Transaction[];
  accounts: Account[];
  reserves: Reserve[];
  reserveMovements: ReserveMovement[];
  planningBudgets: unknown[];
  financialGoals: unknown[];
};

const EMPTY: FinanceState = {
  transactions: [], accounts: [], reserves: [], reserveMovements: [],
  planningBudgets: [], financialGoals: [],
};
const KEYS: CollectionKey[] = [
  "nexo_transactions", "nexo_accounts", "nexo_reserves",
  "nexo_reserve_movements", "nexo_planning_budgets", "nexo_planning_goals",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isValidTransaction(value: unknown): value is Transaction {
  if (!isRecord(value)) return false;
  const types = ["Receita", "Despesa", "Transferência", "Investimento", "Aplicação", "Reserva"];
  if (!isFiniteNumber(value.id) || typeof value.description !== "string" ||
      !value.description.trim() || typeof value.type !== "string" ||
      !types.includes(value.type) || !isFiniteNumber(value.amount) || value.amount <= 0) return false;
  if (value.settledAmount !== undefined && value.settledAmount !== null &&
      (!isFiniteNumber(value.settledAmount) || value.settledAmount < 0 || value.settledAmount > value.amount)) return false;
  return (value.date === undefined || typeof value.date === "string") &&
    (value.status === undefined || typeof value.status === "string");
}
function isValidAccount(value: unknown): value is Account {
  return isRecord(value) && isFiniteNumber(value.id) &&
    typeof value.name === "string" && Boolean(value.name.trim()) &&
    typeof value.institution === "string" && typeof value.type === "string" &&
    isFiniteNumber(value.initialBalance) && typeof value.active === "boolean" &&
    typeof value.createdAt === "string";
}
function isValidReserve(value: unknown): value is Reserve {
  return isRecord(value) && isFiniteNumber(value.id) &&
    typeof value.name === "string" && typeof value.description === "string" &&
    isFiniteNumber(value.targetAmount) && isFiniteNumber(value.initialBalance) &&
    isFiniteNumber(value.monthlyContribution) && typeof value.startDate === "string" &&
    typeof value.targetDate === "string" &&
    (value.accountId === null || isFiniteNumber(value.accountId)) &&
    typeof value.institution === "string" && typeof value.status === "string" &&
    typeof value.createdAt === "string";
}
function isValidReserveMovement(value: unknown): value is ReserveMovement {
  return isRecord(value) && isFiniteNumber(value.id) && isFiniteNumber(value.reserveId) &&
    ["Aporte", "Resgate", "Rendimento", "Ajuste"].includes(String(value.type)) &&
    isFiniteNumber(value.amount) && value.amount > 0 &&
    typeof value.date === "string" && typeof value.description === "string" &&
    typeof value.createdAt === "string";
}
function normalizeTransactions(items: unknown[]): Transaction[] {
  return items.map((item) => isRecord(item) && item.settledAmount === null
    ? { ...item, settledAmount: undefined } as unknown as Transaction
    : item as Transaction);
}

export function useCloudFinanceCollections() {
  const { session, loading: authLoading } = useNexoAuth();
  const [state, setState] = useState<FinanceState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revisions = useRef(new Map<CollectionKey, number>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const sessionIdentity = useMemo(
    () => ({ userId: session?.user.id ?? null }),
    [session?.user.id]
  );
  const sessionIdentityRef = useRef(sessionIdentity);

  useLayoutEffect(() => {
    sessionIdentityRef.current = sessionIdentity;
  }, [sessionIdentity]);

  const reload = useCallback(async () => {
    if (authLoading) return;
    const loadIdentity = sessionIdentity;

    setLoaded(false);
    setError(null);
    if (!session) {
      setState(EMPTY);
      revisions.current.clear();
      setError("Entre na sua conta para acessar os dados financeiros.");
      setLoaded(true);
      return;
    }
    try {
      const rows = await fetchRemoteCollections(KEYS);

      if (
        sessionIdentityRef.current !== loadIdentity
      ) {
        return;
      }

      const next: FinanceState = { ...EMPTY };
      for (const key of KEYS) {
        const row = rows.find((item) => item.data_key === key);
        revisions.current.set(key, Number(row?.revision) || 0);
        if (!row) continue;
        if (!Array.isArray(row.payload)) {
          throw new Error(`A coleção ${key} não contém uma lista válida. Nenhuma gravação foi realizada.`);
        }
        if (key === "nexo_transactions") {
          if (!row.payload.every(isValidTransaction)) throw new Error("A coleção de lançamentos contém registros inválidos. Nenhuma gravação foi realizada.");
          next.transactions = normalizeTransactions(row.payload);
        }
        if (key === "nexo_accounts") {
          if (!row.payload.every(isValidAccount)) throw new Error("A coleção de contas contém registros inválidos. Nenhuma gravação foi realizada.");
          next.accounts = row.payload as Account[];
        }
        if (key === "nexo_reserves") {
          if (!row.payload.every(isValidReserve)) throw new Error("A coleção de reservas contém registros inválidos. Nenhuma gravação foi realizada.");
          next.reserves = row.payload as Reserve[];
        }
        if (key === "nexo_reserve_movements") {
          if (!row.payload.every(isValidReserveMovement)) throw new Error("A coleção de movimentações de reservas contém registros inválidos. Nenhuma gravação foi realizada.");
          next.reserveMovements = row.payload as ReserveMovement[];
        }
        if (key === "nexo_planning_budgets") next.planningBudgets = row.payload;
        if (key === "nexo_planning_goals") next.financialGoals = row.payload;
      }
      setState(next);
    } catch (cause) {
      const sessionIsCurrent =
        sessionIdentityRef.current === loadIdentity;

      if (sessionIsCurrent) {
        setState(EMPTY);
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados financeiros da nuvem.");
      }
    } finally {
      if (
        sessionIdentityRef.current === loadIdentity
      ) {
        setLoaded(true);
      }
    }
  }, [authLoading, session, sessionIdentity]);

  useEffect(() => { void reload(); }, [reload]);

  const saveCollection = useCallback(async <K extends CollectionKey>(
    key: K,
    payload: K extends "nexo_transactions" ? Transaction[] :
      K extends "nexo_accounts" ? Account[] :
      K extends "nexo_reserves" ? Reserve[] :
      K extends "nexo_reserve_movements" ? ReserveMovement[] : unknown[]
  ) => {
    if (!session) throw new Error("Entre na sua conta antes de salvar.");
    if (!loaded) throw new Error("Aguarde o carregamento dos dados antes de salvar.");
    if (error) throw new Error(error);

    const expectedIdentity = sessionIdentity;

    const operation = async () => {
      const sessionIsCurrent = () =>
        sessionIdentityRef.current === expectedIdentity;

      if (!sessionIsCurrent()) {
        throw new Error("A sessão foi alterada antes da gravação. Recarregue os dados da conta atual.");
      }

      setSaving(true);
      try {
        setState((current) => ({
          ...current,
          ...(key === "nexo_transactions" ? { transactions: payload as Transaction[] } : {}),
          ...(key === "nexo_accounts" ? { accounts: payload as Account[] } : {}),
          ...(key === "nexo_reserves" ? { reserves: payload as Reserve[] } : {}),
          ...(key === "nexo_reserve_movements" ? { reserveMovements: payload as ReserveMovement[] } : {}),
          ...(key === "nexo_planning_budgets" ? { planningBudgets: payload as unknown[] } : {}),
          ...(key === "nexo_planning_goals" ? { financialGoals: payload as unknown[] } : {}),
        }));
        if (!sessionIsCurrent()) {
          throw new Error("A sessão foi alterada antes da gravação. Recarregue os dados da conta atual.");
        }

        const result = await saveRemoteCollection(key, payload, revisions.current.get(key) ?? 0);

        if (!sessionIsCurrent()) return;

        if (!result.saved) {
          setError("Conflito de sincronização: a edição permanece nesta tela, mas ainda não foi enviada. Copie ou resolva a alteração antes de recarregar a coleção.");
          throw new Error("Outro dispositivo alterou esta coleção. A edição atual foi mantida na tela.");
        }
        revisions.current.set(key, result.current_revision ?? (revisions.current.get(key) ?? 0) + 1);
      } finally {
        setSaving(false);
      }
    };
    const pending = queue.current.then(operation, operation);
    queue.current = pending.then(() => undefined, () => undefined);
    await pending;
  }, [session, loaded, error, sessionIdentity]);

  const saveTransactions = useCallback((value: Transaction[]) => saveCollection("nexo_transactions", value), [saveCollection]);
  const saveAccounts = useCallback((value: Account[]) => saveCollection("nexo_accounts", value), [saveCollection]);
  const saveReserves = useCallback((value: Reserve[]) => saveCollection("nexo_reserves", value), [saveCollection]);
  const saveReserveMovements = useCallback((value: ReserveMovement[]) => saveCollection("nexo_reserve_movements", value), [saveCollection]);
  const savePlanningBudgets = useCallback((value: unknown[]) => saveCollection("nexo_planning_budgets", value), [saveCollection]);
  const saveFinancialGoals = useCallback((value: unknown[]) => saveCollection("nexo_planning_goals", value), [saveCollection]);

  return {
    ...state, loaded, saving, error, reload,
    saveTransactions, saveAccounts, saveReserves, saveReserveMovements,
    savePlanningBudgets, saveFinancialGoals,
  };
}
