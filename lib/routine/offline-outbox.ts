import type { NexoSyncKey } from "@/lib/supabase/sync-keys";

export type PendingRoutineChange = {
  id: string;
  userId: string;
  dataKey: NexoSyncKey;
  payload: unknown[];
  baseRevision: number;
  updatedAt: string;
};

const DATABASE_NAME = "nexo-routine-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "pending-changes";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("O armazenamento local seguro não está disponível neste navegador."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir a fila local."));
    request.onblocked = () => reject(new Error("A fila local está bloqueada por outra aba do NEXO."));
  });
}

export function getPendingRoutineChange(
  userId: string,
  dataKey: NexoSyncKey
): Promise<PendingRoutineChange | null> {
  return new Promise(async (resolve, reject) => {
    let database: IDBDatabase;
    try {
      database = await openDatabase();
    } catch (error) {
      reject(error);
      return;
    }

    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(`${userId}:${dataKey}`);
    request.onsuccess = () => resolve((request.result as PendingRoutineChange | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível recuperar a alteração pendente."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Falha ao consultar a fila local."));
    };
  });
}

export async function savePendingRoutineChange(change: PendingRoutineChange): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(change);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Não foi possível proteger a alteração neste dispositivo."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("A gravação local foi interrompida."));
    };
  });
}

export async function removePendingRoutineChange(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Não foi possível limpar a fila após sincronizar."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("A limpeza da fila local foi interrompida."));
    };
  });
}
