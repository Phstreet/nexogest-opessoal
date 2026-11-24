"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Account, Transaction } from "@/lib/finance/types";
import { isValidTransaction, localDate } from "@/lib/finance/finance-utils";
import { FINANCE_TRANSACTIONS_KEY } from "@/lib/finance/constants";
import { expandRecurringTransactions } from "@/lib/finance/recurrence-utils";
import type { NexoSession } from "@/lib/supabase/client";
import {
  fetchRemoteCollections,
  saveRemoteCollection,
} from "@/lib/supabase/client";


type UseFinanceCloudSyncParams = {
  session: NexoSession | null;
  authLoading: boolean;
  transactions: Transaction[];
  setTransactions: Dispatch<SetStateAction<Transaction[]>>;
  setDate: Dispatch<SetStateAction<string>>;
};

export function useFinanceCloudSync({
  session,
  authLoading,
  transactions,
  setTransactions,
  setDate,
}: UseFinanceCloudSyncParams) {
  const [registeredAccounts, setRegisteredAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [safeToSave, setSafeToSave] = useState(false);
  const [invalidCount, setInvalidCount] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState("Conectando ao banco de dados...");
  const revisionRef = useRef(0);
  const remoteReadyRef = useRef(false);
  const lastSavedPayloadRef = useRef("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sessionUserId = session?.user.id ?? null;
  const sessionUserIdRef = useRef<string | null>(sessionUserId);

  useLayoutEffect(() => {
    if (sessionUserIdRef.current !== sessionUserId) {
      setTransactions([]);
      setRegisteredAccounts([]);
      setSafeToSave(false);
      setLoaded(false);
      revisionRef.current = 0;
      lastSavedPayloadRef.current = "";
    }
    sessionUserIdRef.current = sessionUserId;
    remoteReadyRef.current = false;
  }, [sessionUserId, setTransactions]);

  useEffect(() => {
    let active = true;

    async function initializeFinanceData() {
      if (authLoading) return;
      setLoaded(false);
      remoteReadyRef.current = false;
      setSafeToSave(false);
      setStorageError(null);

      if (!sessionUserId) {
        setTransactions([]);
        setRegisteredAccounts([]);
        setInvalidCount(0);
        revisionRef.current = 0;
        lastSavedPayloadRef.current = "";
        setSyncStatus("Aguardando autenticação");
        setLoaded(true);
        return;
      }

      const requestedUserId = sessionUserId;
      setDate(localDate());

      try {
        const collections = await fetchRemoteCollections();
        if (!active || sessionUserIdRef.current !== requestedUserId) return;

        const transactionRow = collections.find((item) => item.data_key === FINANCE_TRANSACTIONS_KEY);
        const accountRow = collections.find((item) => item.data_key === "nexo_accounts");
        const cloudTransactions = transactionRow?.payload ?? [];
        const cloudAccounts = accountRow?.payload ?? [];

        if (!Array.isArray(cloudTransactions)) {
          throw new Error("Os lançamentos do Supabase estão em formato inválido. Nenhuma alteração foi feita.");
        }
        if (!Array.isArray(cloudAccounts) || !cloudAccounts.every((item) =>
          item && typeof item === "object" &&
          typeof (item as Record<string, unknown>).id === "number" &&
          typeof (item as Record<string, unknown>).name === "string"
        )) {
          throw new Error("As contas do Supabase estão em formato inválido. Nenhuma alteração foi feita.");
        }

        const invalidRecords = cloudTransactions.filter((item) => !isValidTransaction(item));
        setInvalidCount(invalidRecords.length);
        if (invalidRecords.length > 0) {
          throw new Error(`Foram encontrados ${invalidRecords.length} lançamento(s) inválido(s) no Supabase. A gravação foi bloqueada para proteger os dados existentes.`);
        }

        const validTransactions = cloudTransactions as Transaction[];
        const synchronized = expandRecurringTransactions(validTransactions);
        revisionRef.current = Number(transactionRow?.revision) || 0;
        lastSavedPayloadRef.current = JSON.stringify(validTransactions);
        setTransactions(synchronized);
        setRegisteredAccounts(cloudAccounts as Account[]);
        setInvalidCount(0);
        setSafeToSave(true);
        setStorageError(null);
        setSyncStatus("Dados carregados diretamente do Supabase");
        remoteReadyRef.current = true;
        setLoaded(true);
      } catch (error) {
        if (!active || sessionUserIdRef.current !== requestedUserId) return;
        console.error("Falha ao carregar os dados financeiros do Supabase:", error);
        setTransactions([]);
        setRegisteredAccounts([]);
        setSafeToSave(false);
        setStorageError(error instanceof Error ? error.message : "Não foi possível carregar os dados financeiros da nuvem.");
        setSyncStatus("Falha ao acessar o Supabase");
        setLoaded(true);
      }
    }

    void initializeFinanceData();
    return () => {
      active = false;
    };
  }, [authLoading, sessionUserId, setDate, setTransactions]);

  useEffect(() => {
    if (!loaded || !safeToSave || !remoteReadyRef.current || !sessionUserId) return;

    const requestedUserId = sessionUserId;
    const serializedPayload = JSON.stringify(transactions);
    if (serializedPayload === lastSavedPayloadRef.current) return;

    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
      if (
        !remoteReadyRef.current ||
        sessionUserIdRef.current !== requestedUserId
      ) return;

      try {
        const result = await saveRemoteCollection(
          FINANCE_TRANSACTIONS_KEY,
          transactions,
          revisionRef.current
        );

        if (sessionUserIdRef.current !== requestedUserId) return;

        if (!result.saved) {
          setSafeToSave(false);
          remoteReadyRef.current = false;
          setStorageError("Os lançamentos foram alterados em outro dispositivo. A gravação foi pausada para evitar sobrescrever dados. Atualize a tela para carregar a versão mais recente.");
          setSyncStatus("Conflito de sincronização");
          return;
        }

        revisionRef.current = result.current_revision ?? revisionRef.current + 1;
        lastSavedPayloadRef.current = serializedPayload;
        setStorageError(null);
        setSyncStatus("Sincronizado com o Supabase");
      } catch (error) {
        if (sessionUserIdRef.current !== requestedUserId) return;
        console.error("Não foi possível salvar os lançamentos no Supabase:", error);
        setSafeToSave(false);
        remoteReadyRef.current = false;
        setStorageError(error instanceof Error ? error.message + " A gravação foi pausada para proteger os dados." : "Falha ao salvar no banco de dados. A gravação foi pausada.");
        setSyncStatus("Erro ao salvar na nuvem");
      }
    });
  }, [transactions, loaded, safeToSave, sessionUserId]);

  return {
    registeredAccounts,
    safeToSave,
    invalidCount,
    storageError,
    syncStatus,
    setStorageError,
    setSyncStatus,
    remoteReadyRef,
    sessionUserIdRef,
  };
}
