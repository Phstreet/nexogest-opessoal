"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  INVESTMENT_CATEGORIES,
  RESERVE_CATEGORIES,
} from "@/lib/finance/categories";

type SettingsTab = "preferencias" | "categorias" | "dados" | "personalizacao";
type Preferences = {
  weekStartsOn: "monday" | "sunday";
};
type Profile = { displayName: string };

const PREFERENCES_KEY = "nexo_preferences";
const PROFILE_KEY = "nexo_profile";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<SettingsTab>("preferencias");
  const [preferences, setPreferences] = useState<Preferences>({
    weekStartsOn: "monday",
  });
  const [profile, setProfile] = useState<Profile>({ displayName: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [backupDate, setBackupDate] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab") as SettingsTab | null;
    if (requested && ["preferencias", "categorias", "dados", "personalizacao"].includes(requested)) {
      setTab(requested);
    }
    setPreferences(readJson(PREFERENCES_KEY, {
      weekStartsOn: "monday",
    }));
    setProfile(readJson(PROFILE_KEY, { displayName: "" }));
    setBackupDate(localStorage.getItem("nexo_full_backup_created_at") || "");
  }, []);

  const categoryGroups = useMemo(
    () => [
      { title: "Receitas", groups: INCOME_CATEGORIES },
      { title: "Despesas", groups: EXPENSE_CATEGORIES },
      { title: "Investimentos", groups: INVESTMENT_CATEGORIES },
    ],
    []
  );

  function savePreferences(next: Preferences) {
    setPreferences(next);
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("nexo:local-data-updated", { detail: { key: PREFERENCES_KEY } }));
      setMessage("Preferências salvas.");
      setError("");
    } catch {
      setError("Não foi possível salvar as preferências neste navegador.");
      setMessage("");
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent("nexo:local-data-updated", { detail: { key: PROFILE_KEY } }));
      window.dispatchEvent(new Event("nexo:profile-updated"));
      setMessage("Personalização salva.");
      setError("");
    } catch {
      setError("Não foi possível salvar a personalização.");
      setMessage("");
    }
  }

  function downloadBackup() {
    try {
      const entries = Object.keys(localStorage)
        .filter((key) => key.startsWith("nexo_") && !key.startsWith("nexo_account_local_backup_"))
        .sort()
        .map((key) => [key, localStorage.getItem(key)] as const);
      const backup = {
        application: "NEXO",
        version: 1,
        createdAt: new Date().toISOString(),
        entries,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nexo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      localStorage.setItem("nexo_full_backup_created_at", backup.createdAt);
      setBackupDate(backup.createdAt);
      setMessage("Backup exportado. Guarde o arquivo em um local seguro.");
      setError("");
    } catch {
      setError("Não foi possível gerar o backup. Verifique o espaço disponível no navegador.");
      setMessage("");
    }
  }

  function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          application?: unknown;
          version?: unknown;
          entries?: unknown;
        };
        if (
          parsed.application !== "NEXO" ||
          parsed.version !== 1 ||
          !Array.isArray(parsed.entries)
        ) {
          throw new Error("Arquivo de backup incompatível.");
        }
        const entries = parsed.entries as unknown[];
        const validEntries = entries.every(
          (entry) =>
            Array.isArray(entry) &&
            entry.length === 2 &&
            typeof entry[0] === "string" &&
            entry[0].startsWith("nexo_") &&
            (typeof entry[1] === "string" || entry[1] === null)
        );
        if (!validEntries) throw new Error("O arquivo contém dados inválidos.");
        if (!window.confirm("A importação substituirá os registros com as mesmas chaves. Recomendamos exportar um backup atual antes de continuar. Deseja prosseguir?")) {
          event.target.value = "";
          return;
        }
        for (const [key, value] of entries as [string, string | null][]) {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        }
        setMessage("Backup importado. Recarregue a página para atualizar todas as áreas.");
        setError("");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível importar o backup.");
        setMessage("");
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setError("Não foi possível ler o arquivo selecionado.");
      setMessage("");
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <AppLayout>
      <div className="content nexo-settings">
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
            <h2>Preferências gerais</h2>
            <p>Defina como deseja organizar sua experiência no NEXO.</p>
            <label className="settings-field">
              <span>Primeiro dia da semana</span>
              <select value={preferences.weekStartsOn} onChange={(event) => savePreferences({ ...preferences, weekStartsOn: event.target.value as Preferences["weekStartsOn"] })}>
                <option value="monday">Segunda-feira</option>
                <option value="sunday">Domingo</option>
              </select>
            </label>
                    <small>Esta preferência já é aplicada ao Planejamento Semanal. Ela fica salva neste navegador e não altera os registros cadastrados.</small>
          </section>
        )}

        {tab === "categorias" && (
          <section className="settings-panel">
            <h2>Categorias disponíveis</h2>
            <p>Consulta do catálogo de categorias de referência disponível no projeto. Os formulários financeiros ainda mantêm listas próprias; a edição centralizada será habilitada após a unificação dessas fontes.</p>
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
            <p>Exporte os dados NEXO armazenados neste navegador ou importe um arquivo de backup anterior.</p>
            <div className="backup-actions">
              <button type="button" className="primary-button" onClick={downloadBackup}>Exportar backup completo</button>
              <label className="secondary-button file-button">
                Importar arquivo de backup
                <input type="file" accept="application/json,.json" onChange={importBackup} />
              </label>
            </div>
            <div className="backup-note">
              <strong>Último backup exportado</strong>
              <span>{backupDate ? new Date(backupDate).toLocaleString("pt-BR") : "Nenhum backup exportado por esta tela."}</span>
            </div>
            <p className="settings-warning">A importação substitui os dados das chaves presentes no arquivo. Ela não sincroniza informações entre dispositivos nem substitui um backup externo seguro.</p>
          </section>
        )}

        {tab === "personalizacao" && (
          <section className="settings-panel">
            <h2>Personalização</h2>
            <p>Defina como seu perfil será identificado dentro do NEXO.</p>
            <form onSubmit={saveProfile}>
              <label className="settings-field">
                <span>Nome de exibição</span>
                <input value={profile.displayName} maxLength={60} placeholder="Como deseja ser identificado?" onChange={(event) => setProfile({ displayName: event.target.value })} />
              </label>
              <div className="settings-preview">
                <span>Prévia do perfil</span>
                <strong>{profile.displayName.trim() || "NEXO"}</strong>
              </div>
              <button className="primary-button" type="submit">Salvar personalização</button>
            </form>
            <p className="settings-note">O padrão visual monocromático atual foi preservado. Novos temas só serão adicionados quando todas as telas compartilharem o mesmo sistema de estilos.</p>
          </section>
        )}

        <style jsx>{`
          .nexo-settings { max-width: 1200px; margin: 0 auto; padding-bottom: 40px; }
          .settings-tabs { display:flex; flex-wrap:wrap; gap:8px; margin:22px 0; border-bottom:1px solid #303030; padding-bottom:12px; }
          .settings-tabs button,.secondary-button { border:1px solid #393939; border-radius:7px; padding:10px 13px; background:#202020; color:#bdbdbd; font-size:11px; cursor:pointer; }
          .settings-tabs button.active { background:#ededed; color:#111; border-color:#ededed; }
          .settings-panel { padding:22px; border:1px solid #303030; border-radius:11px; background:#171717; color:#eee; }
          .settings-panel h2 { margin:0 0 8px; font-size:17px; }
          .settings-panel>p { color:#999; font-size:12px; line-height:1.6; margin:0 0 20px; }
          .settings-field { display:flex; flex-direction:column; gap:7px; max-width:440px; margin:18px 0; }
          .settings-field span,.settings-check { color:#c8c8c8; font-size:12px; }
          .settings-field input,.settings-field select { width:100%; padding:11px; border:1px solid #393939; border-radius:7px; background:#222; color:#eee; color-scheme:dark; }
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
          @media(max-width:650px) { .category-groups { grid-template-columns:1fr; } .settings-panel { padding:16px; } }
        `}</style>
      </div>
    </AppLayout>
  );
}
