"use client";

import { useNexoConfirm } from "@/contexts/NexoConfirmProvider";
import { PreferencesControls, AppearanceControls } from "@/components/settings/SettingsControls";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import { fetchRemoteCollections, saveRemoteCollection, updatePassword, NEXO_SYNC_KEYS, type NexoSyncKey } from "@/lib/supabase/client";
import { isValidBackupCollection } from "@/lib/supabase/backup";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  INVESTMENT_CATEGORIES,
  RESERVE_CATEGORIES,
} from "@/lib/finance/categories";

type SettingsTab = "preferencias" | "categorias" | "dados" | "personalizacao" | "seguranca";
export default function ConfiguracoesPage() {
  const confirm = useNexoConfirm();
  const { session } = useNexoAuth();
  const [tab, setTab] = useState<SettingsTab>("preferencias");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [backupDate, setBackupDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const revisions = useRef(new Map<NexoSyncKey, number>());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab") as SettingsTab | null;
    if (requested && ["preferencias", "categorias", "dados", "personalizacao", "seguranca"].includes(requested)) setTab(requested);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      if (!session) {
        setLoading(false);
        setError("Entre na sua conta para acessar suas configurações.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const collections = await fetchRemoteCollections();
        if (!active) return;
        for (const key of NEXO_SYNC_KEYS) {
          const row = collections.find((item) => item.data_key === key);
          revisions.current.set(key, Number(row?.revision) || 0);
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar as configurações da nuvem.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadSettings();
    return () => { active = false; };
  }, [session]);

  const categoryGroups = useMemo(
    () => [
      { title: "Receitas", groups: INCOME_CATEGORIES },
      { title: "Despesas", groups: EXPENSE_CATEGORIES },
      { title: "Investimentos", groups: INVESTMENT_CATEGORIES },
    ],
    []
  );

  async function saveNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(""); setError("");
    if (newPassword.length < 8) { setError("A nova senha precisa ter pelo menos 8 caracteres."); return; }
    if (newPassword !== confirmPassword) { setError("A confirmação não corresponde à nova senha."); return; }
    setSaving(true);
    try { await updatePassword(newPassword); setNewPassword(""); setConfirmPassword(""); setMessage("Senha alterada com sucesso."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível alterar a senha."); }
    finally { setSaving(false); }
  }

  async function downloadBackup() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const collections = await fetchRemoteCollections();
      const entries = collections.map((item) => [item.data_key, item.payload]);
      const backup = { application: "NEXO", version: 2, createdAt: new Date().toISOString(), entries };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "nexo-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupDate(backup.createdAt);
      setMessage("Backup exportado diretamente do Supabase.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar o backup da nuvem.");
    } finally {
      setSaving(false);
    }
  }

  function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setSaving(true);
      setMessage("");
      setError("");
      try {
        const parsed = JSON.parse(String(reader.result)) as { application?: unknown; version?: unknown; entries?: unknown };
        if (parsed.application !== "NEXO" || ![1, 2].includes(Number(parsed.version)) || !Array.isArray(parsed.entries)) throw new Error("Arquivo de backup incompatível.");
        const allowed = new Set<string>(NEXO_SYNC_KEYS);
        const seenKeys = new Set<NexoSyncKey>();
        const normalized = (parsed.entries as unknown[]).map((entry) => {
          if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || !allowed.has(entry[0])) throw new Error("O backup contém uma coleção não reconhecida.");
          const key = entry[0] as NexoSyncKey;
          if (seenKeys.has(key)) throw new Error(`O backup contém a coleção ${key} mais de uma vez.`);
          seenKeys.add(key);
          const payload = parsed.version === 1 ? (typeof entry[1] === "string" ? JSON.parse(entry[1]) : entry[1]) : entry[1];
          if (!isValidBackupCollection(key, payload)) throw new Error(`A coleção ${key} possui formato inválido. Nenhum dado foi importado.`);
          return [key, payload] as const;
        });
        if (!(await confirm({ title: "Prévia e confirmação da restauração", message: "O arquivo contém " + normalized.length + " coleções válidas. As coleções correspondentes poderão substituir os dados atuais. Antes de restaurar, o NEXO baixará uma cópia de segurança do estado atual. Deseja continuar?", confirmLabel: "Criar cópia e restaurar", destructive: true }))) return;
        const latest = await fetchRemoteCollections();
        const safetyBackup = { application: "NEXO", version: 2, createdAt: new Date().toISOString(), entries: latest.map((row) => [row.data_key, row.payload]) };
        const safetyBlob = new Blob([JSON.stringify(safetyBackup, null, 2)], { type: "application/json" });
        const safetyUrl = URL.createObjectURL(safetyBlob);
        const safetyAnchor = document.createElement("a");
        safetyAnchor.href = safetyUrl;
        safetyAnchor.download = "nexo-backup-antes-restauracao-" + new Date().toISOString().slice(0, 10) + ".json";
        safetyAnchor.click();
        window.setTimeout(() => URL.revokeObjectURL(safetyUrl), 1000);
        const revisionsByKey = new Map(latest.map((row) => [row.data_key, Number(row.revision) || 0]));
        for (const [key, payload] of normalized) {
          const result = await saveRemoteCollection(key, payload, revisionsByKey.get(key) ?? 0);
          if (!result.saved) throw new Error("Não foi possível importar " + key + ": houve uma alteração concorrente.");
          revisions.current.set(key, result.current_revision ?? (revisionsByKey.get(key) ?? 0) + 1);
        }
        const verified = await fetchRemoteCollections();
        for (const [key] of normalized) {
          if (!verified.some((row) => row.data_key === key)) throw new Error("A verificação da coleção " + key + " falhou.");
        }
        setMessage("Backup importado e verificado no Supabase.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível importar o backup.");
      } finally {
        setSaving(false);
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setError("Não foi possível ler o arquivo selecionado.");
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <AppLayout>
      <div className="content nexo-settings">
        {loading && <div className="settings-feedback" role="status">Carregando configurações do Supabase...</div>}
        <header className="page-heading">
          <div>
            <div className="eyebrow">SISTEMA / PREFERÊNCIAS</div>
            <h1>Configurações</h1>
            <p>Gerencie suas preferências, categorias, dados e identificação.</p>
          </div>
        </header>

        <nav className="settings-tabs" aria-label="Seções de configurações">
          {([
            ["preferencias", "Preferências"],
            ["categorias", "Categorias"],
            ["dados", "Dados e backups"],
            ["personalizacao", "Personalização"],
            ["seguranca", "Segurança"],
          ] as [SettingsTab, string][]).map(([value, label]) => (
            <button key={value} type="button" className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </nav>

        {message && <div className="settings-feedback success" role="status">{message}</div>}
        {error && <div className="settings-feedback error" role="alert">{error}</div>}

        {tab === "preferencias" && (
          <section className="settings-panel">
            <h2>Preferências</h2>
            <p>Configurações com efeito imediato no comportamento do NEXO.</p>
            <PreferencesControls />
            <p className="settings-note">Primeiro dia da semana, formatos de data/hora e parâmetros avançados da agenda estão identificados para integração. Não são apresentados como controles ativos enquanto não forem consumidos pelos calendários e formulários correspondentes.</p>
          </section>
        )}

        {tab === "categorias" && (
          <section className="settings-panel">
            <h2>Categorias disponíveis</h2>
            <p>Consulta do catálogo de referência. CRUD, arquivamento, reordenação, mesclagem e migração de lançamentos: Em breve, após a unificação das listas independentes usadas pelos formulários financeiros, de rotina e metas.</p>
            <div className="category-groups">
              {categoryGroups.map((group) => (
                <div className="category-group" key={group.title}>
                  <h3>{group.title}</h3>
                  {group.groups.map((category) => (
                    <details key={category.name}>
                      <summary>{category.name}</summary>
                      <p>{category.subcategories.join(" · ")}</p>
                    </details>
                  ))}
                </div>
              ))}
              <div className="category-group">
                <h3>Reservas</h3>
                <p>{RESERVE_CATEGORIES.join(" · ")}</p>
              </div>
            </div>
          </section>
        )}

        {tab === "dados" && (
          <section className="settings-panel">
            <h2>Dados e backups</h2>
            <p>Exporte os dados NEXO armazenados no Supabase ou importe um arquivo de backup.</p>
            <div className="backup-actions">
              <button type="button" className="primary-button" onClick={() => void downloadBackup()} disabled={saving || loading}>Exportar backup completo</button>
              <label className="secondary-button file-button">
                Importar backup para o Supabase
                <input type="file" accept="application/json,.json" onChange={importBackup} />
              </label>
            </div>
            <div className="backup-note">
              <strong>Último backup exportado nesta sessão</strong>
              <span>{backupDate ? new Date(backupDate).toLocaleString("pt-BR") : "Nenhum backup exportado por esta tela nesta sessão."}</span>
            </div>
            <p className="settings-warning">A restauração valida as coleções e baixa uma cópia JSON do estado atual antes de sobrescrever. Histórico persistente, agendamento automático e prévia detalhada por registro: Em breve.</p>
          </section>
        )}

        {tab === "personalizacao" && (
          <section className="settings-panel">
            <h2>Personalização</h2>
            <p>Altere o tema, o destaque visual, a densidade e a acessibilidade. A prévia acompanha suas escolhas.</p>
            <AppearanceControls />
            <div className="settings-profile-link"><strong>Dados do perfil</strong><span>Foto, nome, informações pessoais e resumo dos seus dados.</span><a href="/configuracoes/perfil">Abrir Perfil e Dados →</a></div>
          </section>
        )}


        {tab === "seguranca" && (
          <section className="settings-panel">
            <h2>Segurança e acesso</h2>
            <p>Atualize a senha utilizada para entrar na sua conta NEXO.</p>
            <div className="backup-note"><strong>Conta autenticada</strong><span>{session?.user.email || "Conta não identificada"}</span></div>
            <form onSubmit={saveNewPassword}>
              <label className="settings-field"><span>Nova senha</span><div className="password-field"><input type={showPassword ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Ocultar" : "Mostrar"}</button></div></label>
              <label className="settings-field"><span>Confirmar nova senha</span><input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="Digite novamente a senha" required /></label>
              <button className="primary-button" type="submit" disabled={saving || loading || !session}>{saving ? "Atualizando..." : "Alterar senha"}</button>
            </form>
            <p className="settings-note">A alteração é processada pela autenticação do Supabase. Sua senha não é armazenada nas configurações do NEXO.</p>
            <p className="settings-note">2FA, sessões ativas, histórico de acessos e bloqueio por PIN: Em breve. O fluxo de autenticação atual usa cookies HttpOnly e ainda não expõe operações de MFA ou gerenciamento de sessões nesta interface.</p>
          </section>
        )}

        <style jsx>{`
          .nexo-settings { max-width: 1200px; margin: 0 auto; padding-bottom: 40px; }
          .settings-tabs { display:flex; flex-wrap:wrap; gap:7px; margin:22px 0; padding:7px; border:1px solid #303036; border-radius:10px; background:linear-gradient(120deg,#19191c,#141416); }
          .settings-tabs button,.secondary-button { border:1px solid transparent; border-radius:7px; padding:10px 13px; background:transparent; color:#aeb0b8; font-size:10px; cursor:pointer; transition:all .18s ease; }
          .settings-tabs button:hover { background:#25262a; color:#eee; }
          .settings-tabs button.active { background:linear-gradient(135deg,#e1e3e7,#aeb3bc); color:#151619; border-color:#c4c8cf; box-shadow:0 3px 12px #0005; font-weight:700; }
          .settings-panel { padding:25px; border:1px solid #34353b; border-radius:12px; background:linear-gradient(145deg,#1b1b1f,#141416); color:#eee; box-shadow:0 12px 35px #0002; }
          .settings-panel h2 { margin:0 0 8px; font-size:17px; }
          .settings-panel>p { color:#999; font-size:12px; line-height:1.6; margin:0 0 20px; }
          .settings-field { display:flex; flex-direction:column; gap:7px; max-width:440px; margin:18px 0; }
          .settings-field span,.settings-check { color:#c8c8c8; font-size:12px; }
          .settings-field input,.settings-field select { width:100%; padding:11px; border:1px solid #393939; border-radius:7px; background:#222; color:#eee; color-scheme:dark; }
          .settings-toggle { display:flex; align-items:center; justify-content:space-between; gap:16px; max-width:440px; padding:14px 0; margin:12px 0; border-top:1px solid #303036; border-bottom:1px solid #303036; color:#ccc; }
          .settings-toggle span { display:flex; flex-direction:column; gap:5px; }
          .settings-toggle strong { font-size:12px; }
          .settings-toggle small { color:#888; font-size:10px; }
          .settings-toggle input { accent-color:#c4c8cf; width:17px; height:17px; }
          .password-field { display:flex; gap:8px; }
          .password-field button { padding:0 12px; border:1px solid #393939; border-radius:7px; background:#222; color:#ccc; font-size:10px; }
          .settings-check { display:flex; align-items:center; gap:9px; margin:20px 0; }
          .settings-panel small,.settings-note { color:#888; font-size:11px; line-height:1.6; }
          .settings-feedback { padding:12px 14px; margin:0 0 14px; border:1px solid #444; border-radius:7px; font-size:12px; }
          .settings-feedback.success { color:#d1d1d1; background:#202020; }
          .settings-feedback.error { color:#f0aaaa; border-color:#704444; background:#281c1c; }
          .category-groups { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:15px; }
          .category-group { padding:15px; border:1px solid #303030; border-radius:8px; background:#1d1d1d; }
          .category-group h3 { margin:0 0 12px; font-size:13px; }
          .category-group details { padding:9px 0; border-top:1px solid #303030; }
          .category-group summary { color:#ccc; font-size:12px; cursor:pointer; }
          .category-group details p,.category-group>p { color:#888; font-size:11px; line-height:1.6; }
          .backup-actions { display:flex; flex-wrap:wrap; gap:10px; margin:20px 0; }
          .file-button { display:inline-flex; align-items:center; }
          .file-button input { display:none; }
          .backup-note,.settings-preview { display:flex; flex-direction:column; gap:6px; padding:14px; border:1px solid #333; border-radius:8px; background:#202020; color:#aaa; font-size:11px; }
          .backup-note span,.settings-preview strong { color:#eee; font-size:13px; }
          .settings-warning { margin-top:18px !important; color:#c2a98b !important; }
          .settings-preview { max-width:440px; margin:15px 0; }
          @media(max-width:650px) { .category-groups { grid-template-columns:1fr; } .settings-panel { padding:16px; } .settings-tabs { flex-wrap:nowrap; overflow-x:auto; overscroll-behavior-x:contain; } .settings-tabs button { flex:0 0 auto; white-space:nowrap; } }
        `}</style>
      </div>
    </AppLayout>
  );
}
