"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import {
  fetchRemoteCollections, saveRemoteCollection, NEXO_SYNC_KEYS,
  type NexoSyncKey, type RemoteCollection,
} from "@/lib/supabase/client";

type SyncIssue = { key: NexoSyncKey; local: unknown; remote: RemoteCollection };
type SyncState = "loading" | "local" | "ready" | "pending" | "conflict" | "error";

function readLocal(key: string): { exists: boolean; value: unknown; raw: string | null } {
  const raw = localStorage.getItem(key);
  if (raw === null) return { exists: false, value: null, raw: null };
  const value: unknown = JSON.parse(raw);
  const arrayKeys = new Set(["nexo_transactions", "nexo_accounts", "nexo_reserves", "nexo_reserve_movements", "nexo_tasks", "nexo_habits"]);
  if (arrayKeys.has(key) && !Array.isArray(value)) {
    throw new Error(`A coleção local ${key} não possui o formato esperado. O conteúdo foi preservado e a migração foi bloqueada.`);
  }
  if (!arrayKeys.has(key) && (!value || typeof value !== "object" || Array.isArray(value))) {
    throw new Error(`A configuração local ${key} não possui o formato esperado. O conteúdo foi preservado e a migração foi bloqueada.`);
  }
  return { exists: true, value, raw };
}

function switchLocalOwner(nextUserId: string): boolean {
  const ownerKey = "nexo_sync_owner_user_id";
  const currentOwner = localStorage.getItem(ownerKey);
  if (!currentOwner) {
    localStorage.setItem(ownerKey, nextUserId);
    return false;
  }
  if (currentOwner === nextUserId) return false;

  // Antes de trocar o usuário ativo, guarda uma cópia isolada por conta.
  const entries = NEXO_SYNC_KEYS.map((key) => [key, localStorage.getItem(key)] as const);
  const previousBackupKey = `nexo_account_local_backup_${currentOwner}`;
  const previousBackup = JSON.stringify({
    application: "NEXO", ownerId: currentOwner, createdAt: new Date().toISOString(), entries,
  });
  localStorage.setItem(previousBackupKey, previousBackup);
  if (localStorage.getItem(previousBackupKey) !== previousBackup) {
    throw new Error("Não foi possível preservar os dados da conta anterior. A troca de conta foi bloqueada.");
  }

  for (const key of NEXO_SYNC_KEYS) localStorage.removeItem(key);

  // Se esta conta já foi usada neste navegador, recupera seu conjunto local.
  const nextBackupRaw = localStorage.getItem(`nexo_account_local_backup_${nextUserId}`);
  if (nextBackupRaw) {
    const parsed = JSON.parse(nextBackupRaw) as { ownerId?: string; entries?: unknown };
    if (parsed.ownerId !== nextUserId || !Array.isArray(parsed.entries)) {
      throw new Error("O backup local desta conta está inválido. Os dados anteriores foram preservados.");
    }
    for (const entry of parsed.entries) {
      if (!Array.isArray(entry) || entry.length !== 2 ||
          typeof entry[0] !== "string" ||
          !(NEXO_SYNC_KEYS as readonly string[]).includes(entry[0]) ||
          !(typeof entry[1] === "string" || entry[1] === null)) {
        throw new Error("O backup local desta conta contém uma estrutura inválida. Nenhum dado remoto foi aplicado.");
      }
      if (entry[1] !== null) localStorage.setItem(entry[0], entry[1]);
    }
  }
  localStorage.setItem(ownerKey, nextUserId);
  return true;
}

function preserveConflictVersion(userId: string, key: NexoSyncKey, version: "local" | "cloud", payload: unknown) {
  const backupKey = `nexo_sync_conflict_backup_${userId}_${key}_${Date.now()}`;
  const serialized = JSON.stringify({
    application: "NEXO", userId, dataKey: key, version,
    preservedAt: new Date().toISOString(), payload,
  });
  localStorage.setItem(backupKey, serialized);
  if (localStorage.getItem(backupKey) !== serialized) {
    throw new Error("Não foi possível preservar a versão que será substituída. O conflito permanece sem alterações.");
  }
}

function backupLocalData() {
  const entries = NEXO_SYNC_KEYS.map((key) => [key, localStorage.getItem(key)] as const);
  const backup = { application: "NEXO", type: "pre-cloud-sync", createdAt: new Date().toISOString(), entries };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nexo-backup-antes-da-sincronizacao-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function NexoSyncManager() {
  const { session } = useNexoAuth();
  const [state, setState] = useState<SyncState>("local");
  const [pending, setPending] = useState<NexoSyncKey[]>([]);
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [message, setMessage] = useState("");
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const revisions = useRef(new Map<NexoSyncKey, number>());
  const snapshots = useRef(new Map<NexoSyncKey, string>());
  const busy = useRef(false);
  const initialized = useRef(false);

  const inspect = useCallback(async () => {
    if (!session || busy.current) return;
    busy.current = true;
    setState("loading");
    try {
      if (switchLocalOwner(session.user.id)) {
        // Reinicia os estados React para que nenhuma tela mantenha dados da conta anterior em memória.
        window.location.reload();
        return;
      }
      const remote = await fetchRemoteCollections();
      const remoteMap = new Map(remote.map((row) => [row.data_key as NexoSyncKey, row]));
      const nextPending: NexoSyncKey[] = [];
      const nextIssues: SyncIssue[] = [];
      for (const key of NEXO_SYNC_KEYS) {
        const local = readLocal(key);
        const row = remoteMap.get(key);
        if (!row) {
          revisions.current.set(key, 0);
          if (local.exists) nextPending.push(key);
          continue;
        }
        revisions.current.set(key, Number(row.revision));
        const remoteRaw = JSON.stringify(row.payload);
        const arrayKeys = new Set(["nexo_transactions", "nexo_accounts", "nexo_reserves", "nexo_reserve_movements", "nexo_tasks", "nexo_habits"]);
        if ((arrayKeys.has(key) && !Array.isArray(row.payload)) || (!arrayKeys.has(key) && (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)))) {
          throw new Error(`A coleção remota ${key} está em formato incompatível. Nenhum dado local foi alterado.`);
        }
        if (!local.exists) {
          localStorage.setItem(key, remoteRaw);
          snapshots.current.set(key, remoteRaw);
          window.dispatchEvent(new CustomEvent("nexo:local-data-updated", { detail: { key } }));
        } else if (JSON.stringify(local.value) !== remoteRaw) {
          nextIssues.push({ key, local: local.value, remote: row });
        } else {
          snapshots.current.set(key, remoteRaw);
        }
      }
      setPending(nextPending);
      setIssues(nextIssues);
      setState(nextIssues.length ? "conflict" : nextPending.length ? "pending" : "ready");
      setMessage(nextIssues.length
        ? "Há coleções diferentes entre este dispositivo e a nuvem. Escolha qual versão deseja manter."
        : nextPending.length
          ? "Encontramos dados locais que ainda não foram enviados. Faça um backup antes de migrá-los."
          : "Dados deste dispositivo sincronizados com a nuvem.");
      initialized.current = true;
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível consultar a nuvem.");
    } finally {
      busy.current = false;
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setState("local");
      setPending([]);
      setIssues([]);
      initialized.current = false;
      return;
    }
    void inspect();
  }, [session, inspect]);

  const saveChanged = useCallback(async (key: NexoSyncKey) => {
    if (!session || !initialized.current || busy.current || issues.some((item) => item.key === key)) return;
    const local = readLocal(key);
    if (!local.exists) return;
    const snapshot = snapshots.current.get(key);
    if (snapshot === local.raw) return;
    const revision = revisions.current.get(key);
    if (revision === undefined || revision === 0) {
      setPending((current) => current.includes(key) ? current : [...current, key]);
      setState("pending");
      return;
    }
    try {
      const result = await saveRemoteCollection(key, local.value, revision);
      if (!result.saved) {
        setState("conflict");
        setMessage(`A coleção ${key} foi alterada em outro dispositivo. Atualize a comparação antes de continuar.`);
        await inspect();
        return;
      }
      revisions.current.set(key, result.current_revision || revision + 1);
      snapshots.current.set(key, local.raw || "null");
      setMessage("Alterações salvas na nuvem.");
      setState("ready");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao sincronizar os dados.");
    }
  }, [session, issues, inspect]);

  useEffect(() => {
    if (!session) return;
    const handleLocalChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key && (NEXO_SYNC_KEYS as readonly string[]).includes(key)) void saveChanged(key as NexoSyncKey);
      else for (const item of NEXO_SYNC_KEYS) void saveChanged(item);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key && (NEXO_SYNC_KEYS as readonly string[]).includes(event.key)) {
        // Alterações recebidas por storage podem ser espelhos de gravações
        // já confirmadas na nuvem. Reconsulta a revisão antes de comparar,
        // em vez de tentar reenviar com uma revisão possivelmente antiga.
        window.setTimeout(() => { void inspect(); }, 1200);
      }
    };
    window.addEventListener("nexo:local-data-updated", handleLocalChange);
    window.addEventListener("storage", handleStorage);
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void inspect(); }, 30_000);
    return () => {
      window.removeEventListener("nexo:local-data-updated", handleLocalChange);
      window.removeEventListener("storage", handleStorage);
      window.clearInterval(poll);
    };
  }, [session, saveChanged, inspect]);

  async function migrateLocal() {
    if (!session || !backupConfirmed || busy.current) return;
    busy.current = true;
    setState("loading");
    try {
      // Exporta um backup completo antes de qualquer gravação remota.
      backupLocalData();
      for (const key of pending) {
        const local = readLocal(key);
        if (!local.exists) continue;
        const result = await saveRemoteCollection(key, local.value, 0);
        if (!result.saved) throw new Error(`A coleção ${key} já existe na nuvem. Nenhum dado foi sobrescrito.`);
        revisions.current.set(key, result.current_revision || 1);
        snapshots.current.set(key, local.raw || "null");
      }
      setPending([]);
      setState("ready");
      setMessage("Migração concluída. Os dados locais foram enviados sem substituir coleções existentes na nuvem.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a migração.");
      await inspect();
    } finally {
      busy.current = false;
    }
  }

  async function resolveIssue(issue: SyncIssue, choice: "cloud" | "local") {
    if (!session || busy.current) return;
    busy.current = true;
    try {
      if (choice === "cloud") {
        preserveConflictVersion(session.user.id, issue.key, "local", issue.local);
        const raw = JSON.stringify(issue.remote.payload);
        localStorage.setItem(issue.key, raw);
        snapshots.current.set(issue.key, raw);
        revisions.current.set(issue.key, issue.remote.revision);
        window.dispatchEvent(new CustomEvent("nexo:local-data-updated", { detail: { key: issue.key } }));
      } else {
        preserveConflictVersion(session.user.id, issue.key, "cloud", issue.remote.payload);
        const result = await saveRemoteCollection(issue.key, issue.local, issue.remote.revision);
        if (!result.saved) throw new Error("A nuvem mudou novamente. Atualize a comparação e tente outra vez.");
        revisions.current.set(issue.key, result.current_revision || issue.remote.revision + 1);
        snapshots.current.set(issue.key, JSON.stringify(issue.local));
      }
      setIssues((current) => current.filter((item) => item.key !== issue.key));
      setMessage(`Conflito de ${issue.key} resolvido.`);
      setState(issues.length > 1 ? "conflict" : pending.length ? "pending" : "ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível resolver o conflito.");
      setState("error");
    } finally {
      busy.current = false;
    }
  }

  if (!session) return null;

  // Conflitos continuam sendo detectados e bloqueiam gravações automáticas,
  // mas não exibem mais o painel flutuante que interrompia a navegação.
  if (state === "conflict") return null;

  const label = state === "ready" ? "Sincronizado" : state === "pending" ? "Migração pendente" : state === "error" ? "Atenção necessária" : "Verificando nuvem";

  return (
    <aside className="nexo-sync-widget" aria-live="polite">
      <button type="button" className="nexo-sync-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className={`nexo-sync-dot ${state}`} />
        <span>{label}</span>
        <span className="nexo-sync-chevron">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="nexo-sync-body">
          <p>{message}</p>
          {state === "pending" && (
            <>
              <button type="button" className="nexo-sync-secondary" onClick={() => { backupLocalData(); setBackupConfirmed(true); }}>Baixar backup antes de migrar</button>
              <label className="nexo-sync-confirm"><input type="checkbox" checked={backupConfirmed} onChange={(event) => setBackupConfirmed(event.target.checked)} /> Confirmo que guardei o backup dos dados locais.</label>
              <button type="button" className="nexo-sync-primary" disabled={!backupConfirmed} onClick={() => void migrateLocal()}>Enviar dados locais para a nuvem</button>
            </>
          )}
          {issues.map((issue) => (
            <div className="nexo-sync-conflict" key={issue.key}>
              <strong>{issue.key}</strong>
              <span>Este dispositivo e a nuvem possuem versões diferentes. A versão substituída será preservada no backup local.</span>
              <button type="button" onClick={() => void resolveIssue(issue, "cloud")}>Usar versão da nuvem neste dispositivo</button>
              <button type="button" onClick={() => void resolveIssue(issue, "local")}>Manter versão deste dispositivo na nuvem</button>
            </div>
          ))}
          <button type="button" className="nexo-sync-secondary" onClick={() => void inspect()}>Verificar sincronização novamente</button>
        </div>
      )}
    </aside>
  );
}
