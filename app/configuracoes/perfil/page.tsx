"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import { useNexoConfirm } from "@/contexts/NexoConfirmProvider";
import { fetchRemoteCollections, saveRemoteCollection, type RemoteCollection } from "@/lib/supabase/client";
import { userProfileSchema, type UserProfile } from "@/lib/settings/profile-schema";
import { getNexoAvatarUrl } from "@/lib/settings/avatar-url";

const emptyProfile: UserProfile = { displayName: "", fullName: "", phone: "", birthDate: "", motto: "", avatarUrl: "", avatarPath: "" };

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatAccountDate(value?: string) {
  if (!value) return "Não disponibilizado pela autenticação.";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não disponibilizado pela autenticação.";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function countRecords(collections: RemoteCollection[], key: string) {
  const payload = collections.find((item) => item.data_key === key)?.payload;
  return Array.isArray(payload) ? payload.length : 0;
}

function countTransactionsByType(collections: RemoteCollection[], type: "Receita" | "Despesa") {
  const payload = collections.find((item) => item.data_key === "nexo_transactions")?.payload;
  if (!Array.isArray(payload)) return 0;
  return payload.filter((item) =>
    item !== null &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    (item as Record<string, unknown>).type === type
  ).length;
}

export default function PerfilDadosPage() {
  const { session } = useNexoAuth();
  const confirm = useNexoConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const savedAvatarPath = useRef("");
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [collections, setCollections] = useState<RemoteCollection[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!session) {
        setLoading(false);
        setError("Entre na sua conta para acessar seu perfil e seus dados.");
        return;
      }
      try {
        const rows = await fetchRemoteCollections();
        if (!active) return;
        setCollections(rows);
        const row = rows.find((item) => item.data_key === "nexo_profile");
        setRevision(Number(row?.revision) || 0);
        const parsed = userProfileSchema.safeParse(row?.payload ?? emptyProfile);
        const loadedProfile = parsed.success ? { ...emptyProfile, ...parsed.data } : emptyProfile;
        setProfile(loadedProfile);
        savedAvatarPath.current = loadedProfile.avatarPath || "";
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar seus dados.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [session]);

  const counts = useMemo(() => ({
    transactions: countRecords(collections, "nexo_transactions"),
    payables: countTransactionsByType(collections, "Despesa"),
    receivables: countTransactionsByType(collections, "Receita"),
    commitments: countRecords(collections, "nexo_tasks"),
    habits: countRecords(collections, "nexo_habits"),
    goals: countRecords(collections, "nexo_personal_goals") + countRecords(collections, "nexo_planning_goals"),
  }), [collections]);
  const estimatedBytes = useMemo(() => new Blob([JSON.stringify(collections)]).size, [collections]);
  const avatarPreviewUrl = getNexoAvatarUrl(profile.avatarPath) || profile.avatarUrl || "";

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const parsed = userProfileSchema.safeParse(profile);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Revise os dados do perfil.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveRemoteCollection("nexo_profile", parsed.data, revision);
      if (!result.saved) throw new Error("O perfil foi alterado em outro dispositivo. Atualize a página antes de salvar novamente.");
      setRevision(result.current_revision ?? revision + 1);
      const previousAvatarPath = savedAvatarPath.current;
      const nextAvatarPath = parsed.data.avatarPath || "";
      setProfile({ ...emptyProfile, ...parsed.data });
      savedAvatarPath.current = nextAvatarPath;
      if (previousAvatarPath && previousAvatarPath !== nextAvatarPath) {
        const removal = await fetch("/api/profile/avatar", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: previousAvatarPath }),
        });
        if (!removal.ok) setMessage("Perfil salvo. Não foi possível remover o arquivo antigo do avatar.");
      }
      window.dispatchEvent(new Event("nexo:profile-updated"));
      setMessage("Perfil salvo na sua conta.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    setError("");
    let imageUrl = "";
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP.");
      if (file.size > 2 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 2 MB.");
      imageUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
      });
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Seu navegador não permite processar esta imagem.");
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      const webpBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível converter a imagem para WebP.")), "image/webp", 0.82);
      });
      if (webpBlob.size > 2 * 1024 * 1024) throw new Error("A imagem processada deve ter no máximo 2 MB.");
      const formData = new FormData();
      formData.append("file", webpBlob, "avatar.webp");
      const upload = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const result = await upload.json() as { path?: string; error?: string };
      if (!upload.ok || !result.path) throw new Error(result.error || "Não foi possível enviar o avatar.");
      setProfile((current) => ({ ...current, avatarPath: result.path, avatarUrl: "" }));
      setMessage("Avatar enviado ao Supabase Storage. Salve o perfil para vinculá-lo à sua conta.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível processar a imagem.");
    } finally {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setAvatarBusy(false);
      event.target.value = "";
    }
  }

  async function exportAll() {
    setError("");
    try {
      const rows = await fetchRemoteCollections();
      const backup = { application: "NEXO", schemaVersion: 2, createdAt: new Date().toISOString(), entries: rows.map((row) => [row.data_key, row.payload]) };
      downloadJson("nexo-dados-completos-" + new Date().toISOString().slice(0, 10) + ".json", backup);
      setMessage("Exportação completa iniciada.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível exportar seus dados.");
    }
  }

  async function createBackup() {
    const accepted = await confirm({
      title: "Criar backup manual",
      message: "Será gerado um arquivo JSON com as coleções disponíveis na sua conta. Guarde-o em local seguro.",
      confirmLabel: "Gerar backup",
    });
    if (accepted) await exportAll();
  }

  return (
    <AppLayout>
      <div className="content nexo-settings nexo-profile-data">
        <header className="page-heading">
          <div><div className="eyebrow">CONTA / PERFIL E DADOS</div><h1>Perfil e Dados</h1><p>Gerencie sua identificação e tenha controle sobre seus dados.</p></div>
          <Link className="secondary-button" href="/configuracoes">Voltar às configurações</Link>
        </header>
        {loading && <div className="settings-feedback" role="status">Carregando perfil e dados…</div>}
        {message && <div className="settings-feedback success" role="status">{message}</div>}
        {error && <div className="settings-feedback error" role="alert">{error}</div>}

        <section className="settings-panel">
          <h2>Perfil</h2>
          <p>Seu nome e sua imagem são usados na identificação da conta e na saudação do NEXO.</p>
          <form onSubmit={saveProfile}>
            <div className="profile-editor">
              <div className="profile-avatar-preview">
                {avatarPreviewUrl ? <img src={avatarPreviewUrl} alt="Prévia do avatar" /> : <span>{(profile.displayName || profile.fullName || "N").trim().charAt(0).toLocaleUpperCase("pt-BR")}</span>}
              </div>
              <div><button type="button" className="secondary-button" onClick={() => fileRef.current?.click()} disabled={avatarBusy}>{avatarBusy ? "Processando imagem…" : "Enviar foto"}</button><input ref={fileRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleAvatar(event)} /><button type="button" className="settings-reset-button" disabled={!avatarPreviewUrl || avatarBusy} onClick={() => setProfile((current) => ({ ...current, avatarPath: "", avatarUrl: "" }))}>Remover foto</button><small>JPG, PNG ou WebP · até 2 MB. Recorte central quadrado, conversão para WebP e envio ao Supabase Storage.</small></div>
            </div>
            <div className="profile-form-grid">
              <label className="settings-field"><span>Nome completo</span><input value={profile.fullName || ""} maxLength={120} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} /></label>
              <label className="settings-field"><span>Nome de exibição</span><input value={profile.displayName} maxLength={60} required onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} /></label>
              <label className="settings-field"><span>Telefone (opcional)</span><input type="tel" value={profile.phone || ""} maxLength={30} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label className="settings-field"><span>Data de nascimento (opcional)</span><input type="date" value={profile.birthDate || ""} onChange={(event) => setProfile((current) => ({ ...current, birthDate: event.target.value }))} /></label>
              <label className="settings-field profile-wide"><span>Meta de vida / lema (opcional)</span><textarea value={profile.motto || ""} maxLength={160} rows={3} onChange={(event) => setProfile((current) => ({ ...current, motto: event.target.value }))} /></label>
            </div>
            <button className="primary-button" type="submit" disabled={saving || loading}>{saving ? "Salvando…" : "Salvar perfil"}</button>
          </form>
        </section>

        <section className="settings-panel">
          <h2>Conta</h2>
          <div className="profile-data-grid">
            <div className="backup-note"><strong>E-mail de acesso</strong><span>{session?.user.email || "Não identificado"}</span></div>
            <div className="backup-note"><strong>Provedor</strong><span>{String(session?.user.app_metadata?.provider || "email")}</span></div>
            <div className="backup-note"><strong>Conta criada</strong><span>{formatAccountDate(session?.user.created_at)}</span></div>
            <div className="backup-note"><strong>Último acesso</strong><span>{formatAccountDate(session?.user.last_sign_in_at)}</span></div>
          </div>
          <p className="settings-note">Alteração de e-mail com verificação, listagem/encerramento de sessões e histórico de acessos: Em breve. A API de autenticação integrada ao NEXO ainda não oferece essas operações na interface.</p>
          <Link className="secondary-button" href="/configuracoes?tab=seguranca">Ir para Segurança e senha</Link>
        </section>

        <section className="settings-panel">
          <h2>Resumo dos seus dados</h2>
          <div className="profile-data-grid">
            <div className="backup-note"><strong>Lançamentos</strong><span>{counts.transactions}</span></div>
            <div className="backup-note"><strong>Contas a pagar</strong><span>{counts.payables}</span></div>
            <div className="backup-note"><strong>Contas a receber</strong><span>{counts.receivables}</span></div>
            <div className="backup-note"><strong>Compromissos</strong><span>{counts.commitments}</span></div>
            <div className="backup-note"><strong>Hábitos</strong><span>{counts.habits}</span></div>
            <div className="backup-note"><strong>Metas</strong><span>{counts.goals}</span></div>
            <div className="backup-note"><strong>Tamanho estimado</strong><span>{(estimatedBytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB</span></div>
          </div>
        </section>

        <section className="settings-panel">
          <h2>Importar planilhas</h2>
          <p>Importação CSV/XLSX com mapeamento de colunas, prévia e detecção de duplicados: Em breve. A importação de planilhas ainda não possui um parser e um fluxo de validação/mapeamento integrado ao modelo de lançamentos.</p>
        </section>

        <section className="settings-panel">
          <h2>Exportar e backup</h2>
          <p>Baixe uma cópia JSON das coleções sincronizadas na sua conta. Exportação individual por módulo e CSV: Em breve.</p>
          <div className="backup-actions"><button type="button" className="primary-button" onClick={() => void exportAll()}>Exportar todos os dados (JSON)</button><button type="button" className="secondary-button" onClick={() => void createBackup()}>Criar backup manual</button></div>
          <p className="settings-note">Backup automático agendado, histórico remoto, restauração com prévia e cópia automática antes de sobrescrever: Em breve. O NEXO ainda não possui serviço de armazenamento de arquivos/backups separado das coleções sincronizadas.</p>
        </section>

        <section className="settings-panel">
          <h2>Privacidade e LGPD</h2>
          <p>Você pode baixar os dados sincronizados pelo NEXO usando a exportação JSON acima.</p>
          <p className="settings-note">Política de privacidade e gestão de consentimentos serão disponibilizadas após publicação dos documentos legais do produto.</p>
        </section>

        <section className="settings-panel danger-zone">
          <h2>Zona de perigo</h2>
          <p>Operações irreversíveis exigem reautenticação e confirmação reforçada no servidor.</p>
          <button type="button" className="secondary-button" disabled>Apagar dados do módulo — Em breve</button>
          <button type="button" className="secondary-button" disabled>Excluir conta — Em breve</button>
        </section>
      </div>
    </AppLayout>
  );
}
