import { test, expect } from "@playwright/test";
import { isValidBackupCollection } from "../lib/supabase/backup";
import { isNexoSyncKey, NEXO_SYNC_KEYS } from "../lib/supabase/sync-keys";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test.describe("NEXO - Persistência e integridade de backup", () => {
  test("mantém a lista de coleções permitidas explícita e única", () => {
    expect(new Set(NEXO_SYNC_KEYS).size).toBe(NEXO_SYNC_KEYS.length);
    for (const key of NEXO_SYNC_KEYS) expect(isNexoSyncKey(key)).toBe(true);
    expect(isNexoSyncKey("nexo_admin_data")).toBe(false);
  });

  test("rejeita formato incompatível antes de importar coleções", () => {
    expect(isValidBackupCollection("nexo_transactions", [])).toBe(true);
    expect(isValidBackupCollection("nexo_transactions", { id: 1 })).toBe(false);
    expect(isValidBackupCollection("nexo_habits", [{ id: 1, name: "Leitura", category: "Pessoal", completedDates: [], active: true }])).toBe(true);
    expect(isValidBackupCollection("nexo_habits", [{ id: "inválido", name: "Leitura", category: "Pessoal", completedDates: [], active: true }])).toBe(false);
    expect(isValidBackupCollection("nexo_profile", { displayName: "Usuário" })).toBe(true);
    expect(isValidBackupCollection("nexo_profile", [])).toBe(false);
  });

  test("mantém RLS e isolamento por auth.uid() nas migrations versionadas", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261117173354_nexo_user_data.sql"), "utf8");
    expect(migration.toLowerCase()).toContain("enable row level security");
    expect(migration).toContain("auth.uid()");
    expect(migration.toLowerCase()).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
  });

  test("revoga privilégios de tabela não protegidos por RLS", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261123153950_revoke_unneeded_authenticated_nexo_user_data_privileges.sql"), "utf8");
    expect(migration.toUpperCase()).toContain("REVOKE TRUNCATE, REFERENCES, TRIGGER");
    expect(migration).toContain("FROM authenticated");
  });
});
