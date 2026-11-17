"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadRoutineCollection,
  saveRoutineCollection,
} from "@/lib/routine/storage";

type RoutineCollectionOptions = {
  persist?: boolean;
};

export function useRoutineCollection<T>(
  key: string,
  isValidItem: (value: unknown) => value is T,
  options: RoutineCollectionOptions = {}
) {
  const persist = options.persist !== false;
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [safeToSave, setSafeToSave] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const rawSnapshotRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(true);

  const loadData = useCallback(() => {
    const result = loadRoutineCollection(key, isValidItem);
    rawSnapshotRef.current = result.rawSnapshot;
    skipNextSaveRef.current = true;
    setItems(result.items);
    setSafeToSave(result.safeToSave);
    setStorageError(result.error);
    setLoaded(true);
  }, [key, isValidItem]);

  useEffect(() => {
    loadData();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        loadData();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [key, loadData]);

  useEffect(() => {
    if (!persist || !loaded || !safeToSave) return;

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const result = saveRoutineCollection(
      key,
      items,
      rawSnapshotRef.current
    );

    if (result.saved) {
      rawSnapshotRef.current = result.rawSnapshot;
      setStorageError(null);
      return;
    }

    setSafeToSave(false);
    setStorageError(result.error);

    if (result.conflict) {
      console.error("[NEXO] Alteração concorrente detectada:", result.error);
    }
  }, [items, key, loaded, persist, safeToSave]);

  return {
    items,
    setItems,
    loaded,
    safeToSave,
    storageError,
    reload: loadData,
  };
}
