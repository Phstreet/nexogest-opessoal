"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import {
  fetchRemoteCollections,
  saveRemoteCollection,
} from "@/lib/supabase/client";

type RoutineCollectionOptions = {
  persist?: boolean;
};

export function useRoutineCollection<T>(
  key: string,
  isValidItem: (value: unknown) => value is T,
  options: RoutineCollectionOptions = {}
) {
  const persist = options.persist !== false;
  const { session, loading: authLoading } = useNexoAuth();
  const [items, setItemsState] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [safeToSave, setSafeToSave] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const revisionRef = useRef(0);
  const itemsRef = useRef<T[]>([]);
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
      setSafeToSave(false);
      setStorageError("Entre na sua conta para carregar seus dados da rotina.");
      setLoaded(true);
      return;
    }

    setLoaded(false);
    setStorageError(null);
    try {
      const collections = await fetchRemoteCollections();
      const remote = collections.find((item) => item.data_key === key);
      const payload = remote?.payload ?? [];
      if (!Array.isArray(payload) || !payload.every(isValidItem)) {
        throw new Error("A coleção recebida do Supabase possui dados inválidos. Nenhuma informação foi alterada.");
      }

      if (!mountedRef.current) return;
      revisionRef.current = Number(remote?.revision) || 0;
      applyItems(payload);
      setSafeToSave(true);
      setStorageError(null);
    } catch (error) {
      if (!mountedRef.current) return;
      setSafeToSave(false);
      setStorageError(error instanceof Error ? error.message : "Não foi possível carregar os dados da nuvem.");
    } finally {
      if (mountedRef.current) setLoaded(true);
    }
  }, [authLoading, session, key, isValidItem, applyItems]);

  useEffect(() => {
    mountedRef.current = true;
    void loadData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  const setItems: Dispatch<SetStateAction<T[]>> = useCallback((action) => {
    if (!persist) {
      const next = typeof action === "function"
        ? (action as (previous: T[]) => T[])(itemsRef.current)
        : action;
      applyItems(next);
      return;
    }

    queueRef.current = queueRef.current.then(async () => {
      if (!session || !loaded || !safeToSave) {
        if (mountedRef.current) {
          setStorageError("Os dados ainda não foram carregados ou a sessão expirou. A alteração não foi salva.");
        }
        return;
      }

      const next = typeof action === "function"
        ? (action as (previous: T[]) => T[])(itemsRef.current)
        : action;

      if (!Array.isArray(next) || !next.every(isValidItem)) {
        setStorageError("A alteração contém registros inválidos e não foi enviada ao Supabase.");
        return;
      }

      try {
        const result = await saveRemoteCollection(key, next, revisionRef.current);
        if (!result.saved) {
          const latest = await fetchRemoteCollections();
          const remote = latest.find((item) => item.data_key === key);
          if (remote && Array.isArray(remote.payload) && remote.payload.every(isValidItem)) {
            revisionRef.current = Number(remote.revision) || 0;
            applyItems(remote.payload);
          }
          throw new Error("Esta coleção foi alterada em outro dispositivo. Carregamos a versão mais recente; revise e tente novamente.");
        }

        revisionRef.current = result.current_revision ?? revisionRef.current + 1;
        applyItems(next);
        if (mountedRef.current) setStorageError(null);
      } catch (error) {
        if (mountedRef.current) {
          setStorageError(error instanceof Error ? error.message : "Falha ao salvar no Supabase. A alteração não foi aplicada.");
        }
      }
    }).catch((error) => {
      if (mountedRef.current) {
        setStorageError(error instanceof Error ? error.message : "Falha inesperada ao salvar os dados.");
      }
    });
  }, [persist, session, loaded, safeToSave, key, isValidItem, applyItems]);

  return {
    items,
    setItems,
    loaded,
    safeToSave,
    storageError,
    reload: loadData,
  };
}
