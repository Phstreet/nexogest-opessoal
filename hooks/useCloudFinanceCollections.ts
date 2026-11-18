"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Account, Reserve, ReserveMovement, Transaction } from "@/lib/finance/types";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import { fetchRemoteCollections, saveRemoteCollection } from "@/lib/supabase/client";

type CollectionKey = "nexo_transactions" | "nexo_accounts" | "nexo_reserves" | "nexo_reserve_movements";

type FinanceState = {
  transactions: Transaction[];
  accounts: Account[];
  reserves: Reserve[];
  reserveMovements: ReserveMovement[];
};

const EMPTY: FinanceState = {
  transactions: [],
  accounts: [],
  reserves: [],
  reserveMovements: [],
};

const KEYS: CollectionKey[] = [
  "nexo_transactions",
  "nexo_accounts",
  "nexo_reserves",
  "nexo_reserve_movements",
];

function isArrayPayload(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function useCloudFinanceCollections() {
  const { session, loading: authLoading } = useNexoAuth();
  const [state, setState] = useState<FinanceState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revisions = useRef(new Map<CollectionKey, number>());
  const queue = useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(async () => {
    if (authLoading) return;
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
      const rows = await fetchRemoteCollections();
      const next: FinanceState = { ...EMPTY };
      for (const key of KEYS) {
        const row = rows.find((item) => item.data_key === key);
        revisions.current.set(key, Number(row?.revision) || 0);
        if (!row) continue;
        if (!isArrayPayload(row.payload)) {
          throw new Error(`A coleção ${key} está em formato inválido no Supabase. Nenhuma gravação foi realizada.`);
        }
        if (key === "nexo_transactions") next.transactions = row.payload as Transaction[];
        if (key === "nexo_accounts") next.accounts = row.payload as Account[];
        if (key === "nexo_reserves") next.reserves = row.payload as Reserve[];
        if (key === "nexo_reserve_movements") next.reserveMovements = row.payload as ReserveMovement[];
      }
      setState(next);
    } catch (cause) {
      setState(EMPTY);
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados financeiros da nuvem.");
    } finally {
      setLoaded(true);
    }
  }, [authLoading, session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveCollection = useCallback(async <K extends CollectionKey>(
    key: K,
    payload: K extends "nexo_transactions" ? Transaction[] :
      K extends "nexo_accounts" ? Account[] :
      K extends "nexo_reserves" ? Reserve[] : ReserveMovement[]
  ) => {
    if (!session) throw new Error("Entre na sua conta antes de salvar.");
    if (!loaded) throw new Error("Aguarde o carregamento dos dados antes de salvar.");
    if (error) throw new Error(error);

    const operation = async () => {
      setSaving(true);
      try {
        const result = await saveRemoteCollection(key, payload, revisions.current.get(key) ?? 0);
        if (!result.saved) {
          await reload();
          throw new Error("Os dados foram alterados em outro dispositivo. A versão mais recente foi carregada; confira antes de tentar novamente.");
        }
        revisions.current.set(key, result.current_revision ?? (revisions.current.get(key) ?? 0) + 1);
        setState((current) => ({
          ...current,
          ...(key === "nexo_transactions" ? { transactions: payload } : {}),
          ...(key === "nexo_accounts" ? { accounts: payload } : {}),
          ...(key === "nexo_reserves" ? { reserves: payload } : {}),
          ...(key === "nexo_reserve_movements" ? { reserveMovements: payload } : {}),
        }));
      } finally {
        setSaving(false);
      }
    };

    const pending = queue.current.then(operation, operation);
    queue.current = pending.then(() => undefined, () => undefined);
    await pending;
  }, [session, loaded, error, reload]);

  const saveTransactions = useCallback((value: Transaction[]) => saveCollection("nexo_transactions", value), [saveCollection]);
  const saveAccounts = useCallback((value: Account[]) => saveCollection("nexo_accounts", value), [saveCollection]);
  const saveReserves = useCallback((value: Reserve[]) => saveCollection("nexo_reserves", value), [saveCollection]);
  const saveReserveMovements = useCallback((value: ReserveMovement[]) => saveCollection("nexo_reserve_movements", value), [saveCollection]);

  return {
    ...state,
    loaded,
    saving,
    error,
    reload,
    saveTransactions,
    saveAccounts,
    saveReserves,
    saveReserveMovements,
  };
}
