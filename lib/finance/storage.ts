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
 * - Bloqueio de gravação em estruturas corrompidas.
 * - Backup automático antes de sobrescrever dados.
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

const BACKUP_PREFIX = "nexo_finance_backup_";

// =====================================================
// TIPOS INTERNOS
// =====================================================

type RawStorageResult = {
  exists: boolean;
  raw: string | null;
  error: string | null;
};

export type SafeTransactionsLoadResult = {
  transactions: Transaction[];
  invalidRecords: unknown[];
  safeToSave: boolean;
  error: string | null;
};

// =====================================================
// VERIFICAÇÃO DE AMBIENTE
// =====================================================

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// =====================================================
// LEITURA BRUTA DO LOCALSTORAGE
// =====================================================

function readRawStorage(key: string): RawStorageResult {
  if (!isBrowser()) {
    return {
      exists: false,
      raw: null,
      error: "O armazenamento não está disponível no servidor.",
    };
  }

  try {
    const raw = window.localStorage.getItem(key);

    return {
      exists: raw !== null,
      raw,
      error: null,
    };
  } catch (error) {
    console.error(
      `[NEXO] Erro ao acessar LocalStorage (${key}):`,
      error
    );

    return {
      exists: false,
      raw: null,
      error: "Não foi possível acessar o armazenamento.",
    };
  }
}

// =====================================================
// VALIDAÇÃO DE DATAS
// =====================================================

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

// =====================================================
// BACKUP AUTOMÁTICO
// =====================================================

function createStorageBackup(
  key: string,
  rawData: string
): boolean {
  if (!isBrowser()) {
    return false;
  }

  try {
    const backup = {
      version: FINANCE_STORAGE_VERSION,
      storageKey: key,
      createdAt: new Date().toISOString(),
      rawData,
    };

    const backupKey = `${BACKUP_PREFIX}${key}`;

    const serializedBackup = JSON.stringify(backup);

    window.localStorage.setItem(
      backupKey,
      serializedBackup
    );

    // Mantém compatibilidade com a chave de backup utilizada
    // anteriormente pela página de lançamentos.
    if (key === FINANCE_STORAGE_KEYS.transactions) {
      window.localStorage.setItem(
        "nexo_transactions_backup",
        serializedBackup
      );
    }

    return true;
  } catch (error) {
    console.error(
      `[NEXO] Não foi possível criar o backup de ${key}:`,
      error
    );

    return false;
  }
}

// =====================================================
// CONSULTA DE BACKUP
// =====================================================

export function getFinanceStorageBackup(
  key: string
): {
  version: number;
  storageKey: string;
  createdAt: string;
  rawData: string;
} | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const backupKey = `${BACKUP_PREFIX}${key}`;

    const raw = window.localStorage.getItem(backupKey);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const backup = parsed as Record<string, unknown>;

    if (
      backup.storageKey !== key ||
      typeof backup.rawData !== "string" ||
      typeof backup.createdAt !== "string" ||
      typeof backup.version !== "number"
    ) {
      return null;
    }

    return {
      version: backup.version,
      storageKey: key,
      createdAt: backup.createdAt,
      rawData: backup.rawData,
    };
  } catch (error) {
    console.error(
      `[NEXO] Erro ao consultar backup de ${key}:`,
      error
    );

    return null;
  }
}

// =====================================================
// RESTAURAÇÃO DE BACKUP
// =====================================================

export function restoreFinanceStorageBackup(
  key: string
): boolean {
  if (!isBrowser()) {
    return false;
  }

  const backup = getFinanceStorageBackup(key);

  if (!backup) {
    console.error(
      `[NEXO] Nenhum backup válido foi encontrado para ${key}.`
    );

    return false;
  }

  try {
    // Verifica se o conteúdo do backup é um JSON válido.
    const restoredData: unknown = JSON.parse(
      backup.rawData
    );

    // Não permite restaurar estruturas que não sejam listas.
    if (!Array.isArray(restoredData)) {
      console.error(
        `[NEXO] O backup de ${key} não contém uma lista válida.`
      );

      return false;
    }

    const current = readRawStorage(key);

    if (current.error) {
      return false;
    }

    // Preserva o conteúdo atual antes da restauração.
    if (current.exists && current.raw !== null) {
      if (!createStorageBackup(
        `${key}_before_restore`,
        current.raw
      )) {
        return false;
      }
    }

    window.localStorage.setItem(
      key,
      backup.rawData
    );

    notifyFinanceUpdate(key);

    return true;
  } catch (error) {
    console.error(
      `[NEXO] Erro ao restaurar backup de ${key}:`,
      error
    );

    return false;
  }
}

// =====================================================
// LEITURA E GRAVAÇÃO GENÉRICA
// =====================================================

export function readStorage<T>(
  key: string,
  fallback: T
): T {
  const result = readRawStorage(key);

  if (result.error || !result.exists || result.raw === null) {
    return fallback;
  }

  try {
    return JSON.parse(result.raw) as T;
  } catch (error) {
    console.error(
      `[NEXO] JSON inválido em ${key}:`,
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
    const serialized = JSON.stringify(value);

    if (typeof serialized !== "string") {
      return false;
    }

    window.localStorage.setItem(
      key,
      serialized
    );

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

  const current = readRawStorage(key);

  if (current.error) {
    return false;
  }

  // Antes de remover uma chave financeira,
  // preserva seu conteúdo original.
  const isFinanceKey = Object.values(
    FINANCE_STORAGE_KEYS
  ).includes(
    key as
      (typeof FINANCE_STORAGE_KEYS)[keyof typeof FINANCE_STORAGE_KEYS]
  );

  if (
    isFinanceKey &&
    current.exists &&
    current.raw !== null
  ) {
    if (!createStorageBackup(key, current.raw)) {
      console.error(
        `[NEXO] Remoção bloqueada: não foi possível criar backup de ${key}.`
      );

      return false;
    }
  }

  try {
    window.localStorage.removeItem(key);

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

export function notifyFinanceUpdate(
  key?: string
): void {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new CustomEvent("nexo:local-data-updated", { detail: { key: key ?? null } }));
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

  window.addEventListener(
    "storage",
    handleStorage
  );

  return () => {
    window.removeEventListener(
      FINANCE_STORAGE_EVENT,
      handleFinanceUpdate
    );

    window.removeEventListener(
      "storage",
      handleStorage
    );
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

function isFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

// =====================================================
// VALIDAÇÃO DE MOVIMENTAÇÕES
// =====================================================

function isTransaction(
  value: unknown
): value is Transaction {
  if (!isObject(value)) {
    return false;
  }

  const validTypes = [
    "Receita",
    "Despesa",
    "Transferência",
    "Investimento",
    "Aplicação",
    "Reserva",
  ];

  if (
    !isFiniteNumber(value.id) ||
    typeof value.description !== "string" ||
    !value.description.trim() ||
    typeof value.type !== "string" ||
    !validTypes.includes(value.type) ||
    !isFiniteNumber(value.amount) ||
    value.amount <= 0
  ) {
    return false;
  }

  if (
    value.settledAmount !== undefined &&
    (
      !isFiniteNumber(value.settledAmount) ||
      value.settledAmount < 0 ||
      value.settledAmount > value.amount
    )
  ) {
    return false;
  }

  if (
    value.date !== undefined &&
    (
      typeof value.date !== "string" ||
      !isValidDate(value.date)
    )
  ) {
    return false;
  }

  const optionalStringFields = [
    "category",
    "subcategory",
    "account",
    "destinationAccount",
    "paymentMethod",
    "status",
    "recurrence",
    "recurrenceGroupId",
    "reserveType",
    "investment",
    "institution",
    "createdAt",
    "updatedAt",
  ];

  for (const field of optionalStringFields) {
    if (
      value[field] !== undefined &&
      typeof value[field] !== "string"
    ) {
      return false;
    }
  }

  return true;
}

// =====================================================
// VALIDAÇÃO DE CONTAS
// =====================================================

function isAccount(
  value: unknown
): value is Account {
  if (!isObject(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.id) &&
    typeof value.name === "string" &&
    Boolean(value.name.trim()) &&
    typeof value.institution === "string" &&
    typeof value.type === "string" &&
    isFiniteNumber(value.initialBalance) &&
    typeof value.createdAt === "string" &&
    typeof value.active === "boolean" &&
    (
      value.initialBalanceDate === undefined ||
      typeof value.initialBalanceDate === "string"
    )
  );
}

// =====================================================
// VALIDAÇÃO DE RESERVAS
// =====================================================

function isReserve(
  value: unknown
): value is Reserve {
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

// =====================================================
// VALIDAÇÃO DE MOVIMENTAÇÕES DE RESERVAS
// =====================================================

function isReserveMovement(
  value: unknown
): value is ReserveMovement {
  if (!isObject(value)) {
    return false;
  }

  const validTypes = [
    "Aporte",
    "Resgate",
    "Rendimento",
    "Ajuste",
  ];

  return (
    isFiniteNumber(value.id) &&
    isFiniteNumber(value.reserveId) &&
    typeof value.type === "string" &&
    validTypes.includes(value.type) &&
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
  const result = readRawStorage(key);

  // Se o acesso falhou, não considera os dados vazios.
  if (result.error) {
    console.error(
      `[NEXO] Leitura bloqueada em ${key}.`
    );

    return [];
  }

  // Chave inexistente representa uma lista vazia.
  if (!result.exists || result.raw === null) {
    return [];
  }

  let value: unknown;

  try {
    value = JSON.parse(result.raw);
  } catch (error) {
    console.error(
      `[NEXO] JSON corrompido em ${key}. O conteúdo original foi preservado.`,
      error
    );

    return [];
  }

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
      `[NEXO] ${invalidCount} registro(s) inválido(s) encontrado(s) em ${key}. Os registros originais permanecem preservados no armazenamento.`
    );
  }

  return validItems;
}

// =====================================================
// CONSULTA DOS DADOS FINANCEIROS
// =====================================================

export function getTransactions(): Transaction[] {
  return readValidatedArray(
    FINANCE_STORAGE_KEYS.transactions,
    isTransaction
  );
}

/**
 * Atualiza o espelho local com a coleção já confirmada no Supabase.
 * Não dispara o evento de alteração local usado pelo sincronizador,
 * evitando reenviar a mesma gravação para a nuvem com uma revisão antiga.
 */
export function mirrorRemoteTransactions(
  transactions: Transaction[]
): boolean {
  if (!isBrowser() || !Array.isArray(transactions) || !transactions.every(isTransaction)) {
    return false;
  }

  try {
    window.localStorage.setItem(
      FINANCE_STORAGE_KEYS.transactions,
      JSON.stringify(transactions)
    );
    window.dispatchEvent(
      new CustomEvent(FINANCE_STORAGE_EVENT, {
        detail: {
          key: FINANCE_STORAGE_KEYS.transactions,
          updatedAt: new Date().toISOString(),
        },
      })
    );
    return true;
  } catch (error) {
    console.error("[NEXO] Não foi possível atualizar o espelho local dos lançamentos:", error);
    return false;
  }
}

/**
 * Carrega os lançamentos financeiros sem ocultar erros de leitura,
 * JSON corrompido ou estruturas incompatíveis.
 *
 * Registros inválidos são preservados no backup original e separados
 * em uma chave auxiliar antes de liberar novas gravações.
 */
export function loadTransactionsSafely(): SafeTransactionsLoadResult {
  const key = FINANCE_STORAGE_KEYS.transactions;
  const result = readRawStorage(key);

  if (result.error) {
    return {
      transactions: [],
      invalidRecords: [],
      safeToSave: false,
      error:
        "Não foi possível acessar os lançamentos financeiros. Os dados originais foram preservados.",
    };
  }

  if (!result.exists || result.raw === null) {
    return {
      transactions: [],
      invalidRecords: [],
      safeToSave: true,
      error: null,
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(result.raw);
  } catch (error) {
    console.error(
      "[NEXO] Não foi possível interpretar os lançamentos financeiros.",
      error
    );

    return {
      transactions: [],
      invalidRecords: [],
      safeToSave: false,
      error:
        "Os dados financeiros estão em formato inválido. O conteúdo original foi preservado e nenhuma gravação automática será realizada.",
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      transactions: [],
      invalidRecords: [],
      safeToSave: false,
      error:
        "A estrutura dos lançamentos financeiros não é uma lista válida. Os dados originais foram preservados.",
    };
  }

  const transactions = parsed.filter(isTransaction);
  const invalidRecords = parsed.filter(
    (item) => !isTransaction(item)
  );

  if (invalidRecords.length === 0) {
    return {
      transactions,
      invalidRecords: [],
      safeToSave: true,
      error: null,
    };
  }

  // O backup original precisa existir antes de separar os inválidos.
  const backupCreated = createStorageBackup(
    key,
    result.raw
  );

  if (!backupCreated) {
    return {
      transactions,
      invalidRecords,
      safeToSave: false,
      error:
        "Existem registros inválidos e não foi possível criar o backup de segurança. As gravações foram bloqueadas.",
    };
  }

  try {
    window.localStorage.setItem(
      "nexo_transactions_invalid",
      JSON.stringify({
        createdAt: new Date().toISOString(),
        records: invalidRecords,
      })
    );
  } catch (error) {
    console.error(
      "[NEXO] Não foi possível preservar os registros inválidos.",
      error
    );

    return {
      transactions,
      invalidRecords,
      safeToSave: false,
      error:
        "O backup original foi preservado, mas não foi possível separar os registros inválidos. As gravações foram bloqueadas.",
    };
  }

  return {
    transactions,
    invalidRecords,
    safeToSave: true,
    error: null,
  };
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

function saveValidatedArray<T>(
  key: string,
  items: T[],
  validator: (item: unknown) => item is T
): boolean {
  if (!isBrowser()) {
    return false;
  }

  if (!Array.isArray(items)) {
    console.error(
      `[NEXO] Não foi possível salvar ${key}: o conteúdo informado não é uma lista.`
    );

    return false;
  }

  // Valida todos os registros recebidos.
  const invalidNewItems = items.filter(
    (item) => !validator(item)
  );

  if (invalidNewItems.length > 0) {
    console.error(
      `[NEXO] Não foi possível salvar ${key}: existem ${invalidNewItems.length} registro(s) inválido(s) na lista enviada.`
    );

    return false;
  }

  // Lê diretamente o conteúdo original.
  // Não utiliza readStorage com fallback,
  // pois isso esconderia erros de JSON.
  const existing = readRawStorage(key);

  if (existing.error) {
    console.error(
      `[NEXO] Gravação bloqueada em ${key}: não foi possível ler o conteúdo existente.`
    );

    return false;
  }

  let existingValue: unknown = [];

  if (existing.exists && existing.raw !== null) {
    try {
      existingValue = JSON.parse(existing.raw);
    } catch (error) {
      console.error(
        `[NEXO] Gravação bloqueada em ${key}: o JSON existente está corrompido. O conteúdo original foi preservado.`,
        error
      );

      return false;
    }

    if (!Array.isArray(existingValue)) {
      console.error(
        `[NEXO] Gravação bloqueada em ${key}: a estrutura existente não é uma lista.`
      );

      return false;
    }
  }

  // Preserva os registros antigos que não passaram
  // na validação, sem misturá-los aos registros válidos.
  const preservedInvalidItems = (
    existingValue as unknown[]
  ).filter(
    (item) => !validator(item)
  );

  const finalItems: unknown[] = [
    ...items,
    ...preservedInvalidItems,
  ];

  let serialized: string;

  try {
    serialized = JSON.stringify(finalItems);
  } catch (error) {
    console.error(
      `[NEXO] Não foi possível preparar os dados de ${key}:`,
      error
    );

    return false;
  }

  // Antes de substituir os dados existentes,
  // cria um backup do conteúdo original.
  if (
    existing.exists &&
    existing.raw !== null
  ) {
    const backupCreated = createStorageBackup(
      key,
      existing.raw
    );

    if (!backupCreated) {
      console.error(
        `[NEXO] Gravação bloqueada em ${key}: não foi possível criar o backup de segurança.`
      );

      return false;
    }
  }

  // Só grava depois de validar os dados
  // e preservar o conteúdo anterior.
  try {
    window.localStorage.setItem(
      key,
      serialized
    );

    notifyFinanceUpdate(key);

    if (preservedInvalidItems.length > 0) {
      console.warn(
        `[NEXO] ${preservedInvalidItems.length} registro(s) antigo(s) foram preservados em ${key}.`
      );
    }

    return true;
  } catch (error) {
    console.error(
      `[NEXO] Erro ao gravar ${key}:`,
      error
    );

    return false;
  }
}

// =====================================================
// GRAVAÇÃO DAS MOVIMENTAÇÕES
// =====================================================

export function saveTransactions(
  transactions: Transaction[]
): boolean {
  return saveValidatedArray(
    FINANCE_STORAGE_KEYS.transactions,
    transactions,
    isTransaction
  );
}

// =====================================================
// GRAVAÇÃO DAS CONTAS
// =====================================================

export function saveAccounts(
  accounts: Account[]
): boolean {
  return saveValidatedArray(
    FINANCE_STORAGE_KEYS.accounts,
    accounts,
    isAccount
  );
}

// =====================================================
// GRAVAÇÃO DAS RESERVAS
// =====================================================

export function saveReserves(
  reserves: Reserve[]
): boolean {
  return saveValidatedArray(
    FINANCE_STORAGE_KEYS.reserves,
    reserves,
    isReserve
  );
}

// =====================================================
// GRAVAÇÃO DAS MOVIMENTAÇÕES DE RESERVAS
// =====================================================

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

  return isFiniteNumber(version) && version >= 0
    ? version
    : 0;
}

export function setFinanceStorageVersion(
  version: number = FINANCE_STORAGE_VERSION
): boolean {
  if (
    !isFiniteNumber(version) ||
    version < 0
  ) {
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