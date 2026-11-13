
/**
 * NEXO — Armazenamento central do módulo financeiro
 * Arquivo: lib/finance/storage.ts
 *
 * Centraliza o acesso ao LocalStorage.
 * Mantém compatibilidade com as chaves atuais do projeto.
 *
 * Proteções:
 * - Validação individual dos registros.
 * - Preservação de registros inválidos durante gravações.
 * - Proteção contra sobrescrita de estruturas corrompidas.
 * - Notificação de atualização entre páginas e abas.
 */

import type {
  Account,
  Reserve,
  ReserveMovement,
  Transaction,
} from "./types";

// =====================================================
// CHAVES DE ARMAZENAMENTO
// =====================================================

export const FINANCE_STORAGE_KEYS = {
  transactions: "nexo_transactions",
  accounts: "nexo_accounts",
  reserves: "nexo_reserves",
  reserveMovements: "nexo_reserve_movements",
} as const;

export const FINANCE_STORAGE_VERSION = 1;

export const FINANCE_STORAGE_EVENT = "nexo:finance-updated";

// =====================================================
// VERIFICAÇÃO DE AMBIENTE
// =====================================================

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof localStorage !== "undefined"
  );
}

// =====================================================
// LEITURA E GRAVAÇÃO GENÉRICA
// =====================================================

export function readStorage<T>(
  key: string,
  fallback: T
): T {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const storedValue = localStorage.getItem(key);

    if (storedValue === null) {
      return fallback;
    }

    return JSON.parse(storedValue) as T;
  } catch (error) {
    console.error(
      `[NEXO] Erro ao ler LocalStorage (${key}):`,
      error
    );

    return fallback;
  }
}

export function writeStorage<T>(
  key: string,
  value: T
): boolean {
  if (!isBrowser()) {
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));

    notifyFinanceUpdate(key);

    return true;
  } catch (error) {
    console.error(
      `[NEXO] Erro ao salvar LocalStorage (${key}):`,
      error
    );

    return false;
  }
}

export function removeStorage(key: string): boolean {
  if (!isBrowser()) {
    return false;
  }

  try {
    localStorage.removeItem(key);

    notifyFinanceUpdate(key);

    return true;
  } catch (error) {
    console.error(
      `[NEXO] Erro ao remover LocalStorage (${key}):`,
      error
    );

    return false;
  }
}

// =====================================================
// EVENTO DE ATUALIZAÇÃO
// =====================================================

export function notifyFinanceUpdate(key?: string): void {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(FINANCE_STORAGE_EVENT, {
      detail: {
        key: key ?? null,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export function subscribeFinanceUpdates(
  callback: (key: string | null) => void
): () => void {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handleFinanceUpdate = (event: Event) => {
    const customEvent = event as CustomEvent<{
      key?: string | null;
    }>;

    callback(customEvent.detail?.key ?? null);
  };

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      Object.values(FINANCE_STORAGE_KEYS).includes(
        event.key as
          (typeof FINANCE_STORAGE_KEYS)[keyof typeof FINANCE_STORAGE_KEYS]
      )
    ) {
      callback(event.key);
    }
  };

  window.addEventListener(
    FINANCE_STORAGE_EVENT,
    handleFinanceUpdate
  );

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(
      FINANCE_STORAGE_EVENT,
      handleFinanceUpdate
    );

    window.removeEventListener("storage", handleStorage);
  };
}

// =====================================================
// FUNÇÕES AUXILIARES DE VALIDAÇÃO
// =====================================================

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function isTransaction(value: unknown): value is Transaction {
  if (!isObject(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.id) &&
    typeof value.description === "string" &&
    typeof value.type === "string" &&
    isFiniteNumber(value.amount)
  );
}

function isAccount(value: unknown): value is Account {
  if (!isObject(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.id) &&
    typeof value.name === "string" &&
    typeof value.institution === "string" &&
    typeof value.type === "string" &&
    isFiniteNumber(value.initialBalance) &&
    typeof value.createdAt === "string" &&
    typeof value.active === "boolean"
  );
}

function isReserve(value: unknown): value is Reserve {
  if (!isObject(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.id) &&
    typeof value.name === "string" &&
    typeof value.category === "string" &&
    typeof value.description === "string" &&
    isFiniteNumber(value.targetAmount) &&
    isFiniteNumber(value.initialBalance) &&
    isFiniteNumber(value.monthlyContribution) &&
    typeof value.startDate === "string" &&
    typeof value.targetDate === "string" &&
    (
      value.accountId === null ||
      isFiniteNumber(value.accountId)
    ) &&
    typeof value.institution === "string" &&
    typeof value.status === "string" &&
    typeof value.createdAt === "string"
  );
}

function isReserveMovement(
  value: unknown
): value is ReserveMovement {
  if (!isObject(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.id) &&
    isFiniteNumber(value.reserveId) &&
    typeof value.type === "string" &&
    isFiniteNumber(value.amount) &&
    typeof value.date === "string" &&
    typeof value.description === "string" &&
    typeof value.createdAt === "string"
  );
}

// =====================================================
// LEITURA SEGURA DOS DADOS FINANCEIROS
// =====================================================

function readValidatedArray<T>(
  key: string,
  validator: (item: unknown) => item is T
): T[] {
  const value = readStorage<unknown>(key, []);

  if (!Array.isArray(value)) {
    console.error(
      `[NEXO] A estrutura de ${key} não é uma lista válida. Os dados originais foram preservados.`
    );

    return [];
  }

  const validItems: T[] = [];
  let invalidCount = 0;

  value.forEach((item: unknown) => {
    if (validator(item)) {
      validItems.push(item);
    } else {
      invalidCount += 1;
    }
  });

  if (invalidCount > 0) {
    console.warn(
      `[NEXO] ${invalidCount} registro(s) inválido(s) encontrado(s) em ${key}. Os registros válidos continuam disponíveis e os inválidos permanecem preservados no armazenamento.`
    );
  }

  return validItems;
}

export function getTransactions(): Transaction[] {
  return readValidatedArray(
    FINANCE_STORAGE_KEYS.transactions,
    isTransaction
  );
}

export function getAccounts(): Account[] {
  return readValidatedArray(
    FINANCE_STORAGE_KEYS.accounts,
    isAccount
  );
}

export function getReserves(): Reserve[] {
  return readValidatedArray(
    FINANCE_STORAGE_KEYS.reserves,
    isReserve
  );
}

export function getReserveMovements(): ReserveMovement[] {
  return readValidatedArray(
    FINANCE_STORAGE_KEYS.reserveMovements,
    isReserveMovement
  );
}

// =====================================================
// GRAVAÇÃO SEGURA DOS DADOS FINANCEIROS
// =====================================================

/**
 * Grava uma lista validada preservando registros antigos
 * que não passaram na validação.
 *
 * Isso impede que uma operação comum de cadastro,
 * edição ou exclusão apague registros inválidos
 * que ainda estejam armazenados no LocalStorage.
 */
function saveValidatedArray<T>(
  key: string,
  items: T[],
  validator: (item: unknown) => item is T
): boolean {
  if (!Array.isArray(items)) {
    console.error(
      `[NEXO] Não foi possível salvar ${key}: o conteúdo informado não é uma lista.`
    );

    return false;
  }

  const invalidNewItems = items.filter(
    (item) => !validator(item)
  );

  if (invalidNewItems.length > 0) {
    console.error(
      `[NEXO] Não foi possível salvar ${key}: existem ${invalidNewItems.length} registro(s) inválido(s) na lista enviada.`
    );

    return false;
  }

  // Lê o conteúdo original antes de gravar.
  const existingValue = readStorage<unknown>(key, null);

  // Se já existe uma estrutura que não é uma lista,
  // impede a sobrescrita para proteger os dados.
  if (
    existingValue !== null &&
    !Array.isArray(existingValue)
  ) {
    console.error(
      `[NEXO] Gravação bloqueada em ${key}: a estrutura existente não é uma lista. Os dados originais foram preservados.`
    );

    return false;
  }

  // Mantém os registros antigos que não passaram
  // na validação, sem misturá-los aos registros válidos.
  const preservedInvalidItems = Array.isArray(existingValue)
    ? existingValue.filter(
        (item: unknown) => !validator(item)
      )
    : [];

  const finalItems: unknown[] = [
    ...items,
    ...preservedInvalidItems,
  ];

  const saved = writeStorage(key, finalItems);

  if (saved && preservedInvalidItems.length > 0) {
    console.warn(
      `[NEXO] ${preservedInvalidItems.length} registro(s) antigo(s) foram preservados em ${key}.`
    );
  }

  return saved;
}

export function saveTransactions(
  transactions: Transaction[]
): boolean {
  return saveValidatedArray(
    FINANCE_STORAGE_KEYS.transactions,
    transactions,
    isTransaction
  );
}

export function saveAccounts(
  accounts: Account[]
): boolean {
  return saveValidatedArray(
    FINANCE_STORAGE_KEYS.accounts,
    accounts,
    isAccount
  );
}

export function saveReserves(
  reserves: Reserve[]
): boolean {
  return saveValidatedArray(
    FINANCE_STORAGE_KEYS.reserves,
    reserves,
    isReserve
  );
}

export function saveReserveMovements(
  movements: ReserveMovement[]
): boolean {
  return saveValidatedArray(
    FINANCE_STORAGE_KEYS.reserveMovements,
    movements,
    isReserveMovement
  );
}

// =====================================================
// VERSÃO DO ARMAZENAMENTO
// =====================================================

export function getFinanceStorageVersion(): number {
  const version = readStorage<unknown>(
    "nexo_finance_storage_version",
    0
  );

  return isFiniteNumber(version) ? version : 0;
}

export function setFinanceStorageVersion(
  version: number = FINANCE_STORAGE_VERSION
): boolean {
  if (!isFiniteNumber(version) || version < 0) {
    console.error(
      "[NEXO] Versão de armazenamento inválida."
    );

    return false;
  }

  return writeStorage(
    "nexo_finance_storage_version",
    version
  );
}
