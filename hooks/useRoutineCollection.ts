"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import type { NexoSyncKey } from "@/lib/supabase/sync-keys";
import {
  fetchRemoteCollections,
  saveRemoteCollection,
} from "@/lib/supabase/client";
import {
  getPendingRoutineChange,
  removePendingRoutineChange,
  savePendingRoutineChange,
  type PendingRoutineChange,
} from "@/lib/routine/offline-outbox";

type RoutineCollectionOptions = {
  persist?: boolean;
};

function samePayload(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function getPendingId(userId: string, key: NexoSyncKey) {
  return `${userId}:${key}`;
}

export function useRoutineCollection<T>(
  key: NexoSyncKey,
  isValidItem: (value: unknown) => value is T,
  options: RoutineCollectionOptions = {}
) {
  const persist = options.persist !== false;
  const { session, loading: authLoading } = useNexoAuth();
  const [items, setItemsState] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [safeToSave, setSafeToSave] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const revisionRef = useRef(0);
  const itemsRef = useRef<T[]>([]);
  const pendingRef = useRef<PendingRoutineChange | null>(null);
  const mountedRef = useRef(true);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const applyItems = useCallback((next: T[]) => {
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  const loadData = useCallback(async () => {
    if (authLoading) return;
    if (!session) {
      applyItems([]);
      revisionRef.current = 0;
      pendingRef.current = null;
      setSafeToSave(false);
      setSyncPending(false);
      setStorageError("Entre na sua conta para carregar seus dados da rotina.");
      setLoaded(true);
      return;
    }

    setLoaded(false);
    setStorageError(null);
    setSafeToSave(false);

    try {
      const pending = persist
        ? await getPendingRoutineChange(session.user.id, key)
        : null;

      if (!mountedRef.current) return;

      if (pending) {
        if (!Array.isArray(pending.payload) || !pending.payload.every(isValidItem)) {
          throw new Error("A alteração pendente contém dados inválidos. O arquivo local foi preservado para recuperação.");
        }
        pendingRef.current = pending;
        revisionRef.current = pending.baseRevision;
        applyItems(pending.payload as T[]);
        setSyncPending(true);
        setSafeToSave(true);
      } else {
        pendingRef.current = null;
        setSyncPending(false);
      }

      try {
        const collections = await fetchRemoteCollections([key]);
        if (!mountedRef.current) return;

        const remote = collections.find((item) => item.data_key === key);
        const remotePayload = remote?.payload ?? [];
        const remoteRevision = Number(remote?.revision) || 0;

        if (!Array.isArray(remotePayload) || !remotePayload.every(isValidItem)) {
          throw new Error("A coleção recebida do Supabase possui dados inválidos. Nenhuma informação foi alterada.");
        }

        revisionRef.current = remoteRevision;

        if (pendingRef.current) {
          const localPending = pendingRef.current;
          if (samePayload(remotePayload, localPending.payload)) {
            await removePendingRoutineChange(localPending.id);
            pendingRef.current = null;
            applyItems(remotePayload);
            setSyncPending(false);
            setStorageError(null);
          } else if (remoteRevision !== localPending.baseRevision) {
            setStorageError("Conflito de sincronização: sua alteração continua guardada neste dispositivo. O Supabase recebeu outra versão desta coleção; baixe seu backup antes de resolver o conflito.");
          } else {
            setStorageError("Há alterações guardadas neste dispositivo que ainda precisam ser sincronizadas.");
          }
        } else {
          applyItems(remotePayload);
          setStorageError(null);
        }

        setSafeToSave(true);
      } catch (remoteError) {
        if (!mountedRef.current) return;
        if (pendingRef.current) {
          setSafeToSave(true);
          setStorageError("Sem conexão com o Supabase. Sua alteração continua guardada neste dispositivo e poderá ser reenviada quando a conexão voltar.");
        } else {
          setSafeToSave(false);
          setStorageError(remoteError instanceof Error ? remoteError.message : "Não foi possível carregar os dados da nuvem.");
        }
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setSafeToSave(false);
      setStorageError(error instanceof Error ? error.message : "Não foi possível acessar a fila local de segurança.");
    } finally {
      if (mountedRef.current) setLoaded(true);
    }
  }, [authLoading, session, key, isValidItem, applyItems, persist]);

  useEffect(() => {
    mountedRef.current = true;
    void loadData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  const persistItems = useCallback(async (next: T[]) => {
    if (!persist) {
      applyItems(next);
      return;
    }
    if (!session || !loaded || !safeToSave) {
      throw new Error("Os dados ainda não foram carregados ou a sessão expirou. A alteração não foi salva.");
    }
    if (!Array.isArray(next) || !next.every(isValidItem)) {
      throw new Error("A alteração contém registros inválidos e não foi enviada ao Supabase.");
    }

    const pending: PendingRoutineChange = {
      id: getPendingId(session.user.id, key),
      userId: session.user.id,
      dataKey: key,
      payload: next,
      baseRevision: pendingRef.current?.baseRevision ?? revisionRef.current,
      updatedAt: new Date().toISOString(),
    };

    // A cópia local é confirmada antes da atualização visual ou da tentativa remota.
    await savePendingRoutineChange(pending);
    pendingRef.current = pending;
    applyItems(next);
    setSyncPending(true);

    try {
      const result = await saveRemoteCollection(key, next, pending.baseRevision);
      if (!result.saved) {
        throw new Error("Conflito de sincronização: outra sessão alterou esta coleção. Sua versão permanece guardada neste dispositivo.");
      }

      revisionRef.current = result.current_revision ?? pending.baseRevision + 1;
      await removePendingRoutineChange(pending.id);
      pendingRef.current = null;
      if (mountedRef.current) {
        setSyncPending(false);
        setStorageError(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada ao sincronizar.";
      if (mountedRef.current) {
        setStorageError(`${message} A alteração está guardada neste dispositivo; tente sincronizar novamente.`);
      }
      throw error;
    }
  }, [persist, session, loaded, safeToSave, key, isValidItem, applyItems]);

  const saveNow = useCallback(async (next: T[]) => {
    const pending = queueRef.current.then(() => persistItems(next));
    queueRef.current = pending.then(() => undefined, () => undefined);
    await pending;
  }, [persistItems]);

  const setItems: Dispatch<SetStateAction<T[]>> = useCallback((action) => {
    if (!persist) {
      const next = typeof action === "function"
        ? (action as (previous: T[]) => T[])(itemsRef.current)
        : action;
      applyItems(next);
      return;
    }
    const pending = queueRef.current.then(async () => {
      const next = typeof action === "function"
        ? (action as (previous: T[]) => T[])(itemsRef.current)
        : action;
      await persistItems(next);
    });
    queueRef.current = pending.then(() => undefined, (error) => {
      if (mountedRef.current) {
        const message = error instanceof Error ? error.message : "Falha inesperada ao salvar os dados.";
        setStorageError(pendingRef.current
          ? `${message} A alteração está guardada neste dispositivo; tente sincronizar novamente.`
          : message);
      }
    });
  }, [persist, applyItems, persistItems]);

  const retrySync = useCallback(async () => {
    if (!session || !persist || !pendingRef.current) return;
    const pending = pendingRef.current;
    try {
      const collections = await fetchRemoteCollections([key]);
      const remote = collections.find((item) => item.data_key === key);
      const remotePayload = remote?.payload ?? [];
      const remoteRevision = Number(remote?.revision) || 0;

      if (!Array.isArray(remotePayload) || !remotePayload.every(isValidItem)) {
        throw new Error("A versão remota contém dados inválidos. Sua cópia local foi preservada.");
      }

      if (samePayload(remotePayload, pending.payload)) {
        await removePendingRoutineChange(pending.id);
        pendingRef.current = null;
        revisionRef.current = remoteRevision;
        applyItems(remotePayload);
        setSyncPending(false);
        setStorageError(null);
        return;
      }

      if (remoteRevision !== pending.baseRevision) {
        throw new Error("Conflito de sincronização: outro dispositivo alterou esta coleção. Sua versão continua guardada; baixe o backup antes de resolver.");
      }

      const result = await saveRemoteCollection(key, pending.payload, pending.baseRevision);
      if (!result.saved) {
        throw new Error("O Supabase identificou uma alteração concorrente. Sua versão continua guardada neste dispositivo.");
      }

      revisionRef.current = result.current_revision ?? pending.baseRevision + 1;
      await removePendingRoutineChange(pending.id);
      pendingRef.current = null;
      setSyncPending(false);
      setStorageError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível sincronizar a alteração pendente.";
      setStorageError(pendingRef.current
        ? `${message} Sua alteração continua guardada neste dispositivo.`
        : message);
    }
  }, [session, persist, key, isValidItem, applyItems]);

  useEffect(() => {
    if (!loaded || !syncPending || typeof window === "undefined") return;

    const handleOnline = () => {
      void retrySync();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loaded, syncPending, retrySync]);

  const downloadPendingBackup = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending || typeof document === "undefined") return;

    const blob = new Blob([JSON.stringify({
      product: "NEXO",
      type: "routine-pending-change",
      exportedAt: new Date().toISOString(),
      ...pending,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nexo-backup-${key}-pendente.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [key]);

  return {
    items,
    setItems,
    loaded,
    safeToSave,
    storageError,
    syncPending,
    reload: loadData,
    saveNow,
    retrySync,
    downloadPendingBackup,
  };
}
