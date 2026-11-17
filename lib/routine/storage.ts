/**
 * NEXO — Armazenamento central da rotina
 *
 * Mantém as chaves legadas para preservar os dados já existentes.
 * Uma coleção inválida nunca é substituída automaticamente por uma lista vazia.
 */

export const ROUTINE_STORAGE_KEYS = {
  tasks: "nexo_tasks",
  habits: "nexo_habits",
} as const;

export type RoutineLoadResult<T> = {
  items: T[];
  safeToSave: boolean;
  rawSnapshot: string | null;
  error: string | null;
};

export type RoutineSaveResult = {
  saved: boolean;
  conflict: boolean;
  rawSnapshot: string | null;
  error: string | null;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function preserveInvalidData(key: string, raw: string): boolean {
  if (!isBrowser()) return false;

  try {
    const versionedBackupKey = `nexo_routine_backup_${key}`;
    if (window.localStorage.getItem(versionedBackupKey) === null) {
      window.localStorage.setItem(
        versionedBackupKey,
        JSON.stringify({
          storageKey: key,
          createdAt: new Date().toISOString(),
          rawData: raw,
        })
      );
    }

    // Compatibilidade com os backups antigos utilizados pelas telas.
    const legacyBackupKey =
      key === ROUTINE_STORAGE_KEYS.tasks
        ? "nexo_tasks_backup"
        : key === ROUTINE_STORAGE_KEYS.habits
          ? "nexo_habits_backup"
          : null;

    if (
      legacyBackupKey &&
      window.localStorage.getItem(legacyBackupKey) === null
    ) {
      window.localStorage.setItem(legacyBackupKey, raw);
    }

    return true;
  } catch (error) {
    console.error("[NEXO] Não foi possível preservar os dados da rotina:", error);
    return false;
  }
}

export function loadRoutineCollection<T>(
  key: string,
  isValidItem: (value: unknown) => value is T
): RoutineLoadResult<T> {
  if (!isBrowser()) {
    return {
      items: [],
      safeToSave: false,
      rawSnapshot: null,
      error: "O armazenamento da rotina não está disponível neste ambiente.",
    };
  }

  let rawSnapshot: string | null = null;

  try {
    rawSnapshot = window.localStorage.getItem(key);

    if (rawSnapshot === null) {
      return {
        items: [],
        safeToSave: true,
        rawSnapshot: null,
        error: null,
      };
    }

    const parsed: unknown = JSON.parse(rawSnapshot);

    if (
      !Array.isArray(parsed) ||
      !parsed.every((item: unknown) => isValidItem(item))
    ) {
      const backupCreated = preserveInvalidData(key, rawSnapshot);

      return {
        items: [],
        safeToSave: false,
        rawSnapshot,
        error: backupCreated
          ? "Os dados desta área estão em formato inválido. O conteúdo original foi preservado em backup e a gravação automática foi bloqueada."
          : "Os dados desta área estão em formato inválido. O conteúdo original permanece intacto, mas não foi possível criar o backup. A gravação automática foi bloqueada.",
      };
    }

    return {
      items: parsed as T[],
      safeToSave: true,
      rawSnapshot,
      error: null,
    };
  } catch (error) {
    const backupCreated =
      rawSnapshot !== null && preserveInvalidData(key, rawSnapshot);

    console.error("[NEXO] Falha ao carregar a coleção da rotina:", error);

    return {
      items: [],
      safeToSave: false,
      rawSnapshot,
      error: backupCreated
        ? "Não foi possível interpretar os dados. O conteúdo original foi preservado em backup e nenhuma gravação automática será realizada."
        : "Não foi possível acessar ou preservar os dados. A gravação automática foi bloqueada para evitar perda de informações.",
    };
  }
}

export function saveRoutineCollection<T>(
  key: string,
  items: T[],
  expectedRawSnapshot: string | null
): RoutineSaveResult {
  if (!isBrowser()) {
    return {
      saved: false,
      conflict: false,
      rawSnapshot: expectedRawSnapshot,
      error: "O armazenamento da rotina não está disponível.",
    };
  }

  try {
    const currentRaw = window.localStorage.getItem(key);

    // Evita que uma aba sobrescreva silenciosamente alterações feitas em outra.
    if (currentRaw !== expectedRawSnapshot) {
      return {
        saved: false,
        conflict: true,
        rawSnapshot: currentRaw,
        error: "Os dados foram alterados em outra aba. Recarregue esta página antes de continuar para evitar sobrescrever alterações.",
      };
    }

    const serialized = JSON.stringify(items);

    if (typeof serialized !== "string") {
      return {
        saved: false,
        conflict: false,
        rawSnapshot: currentRaw,
        error: "Não foi possível preparar os dados para gravação.",
      };
    }

    if (serialized !== currentRaw) {
      window.localStorage.setItem(key, serialized);
    }

    return {
      saved: true,
      conflict: false,
      rawSnapshot: serialized,
      error: null,
    };
  } catch (error) {
    console.error("[NEXO] Falha ao salvar a coleção da rotina:", error);

    return {
      saved: false,
      conflict: false,
      rawSnapshot: expectedRawSnapshot,
      error: "Não foi possível salvar os dados. Verifique o espaço disponível no navegador e tente novamente.",
    };
  }
}
