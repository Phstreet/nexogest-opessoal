"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import {
  fetchRemoteCollections,
  saveRemoteCollection,
  type RemoteCollection,
} from "@/lib/supabase/client";

type Profile = {
  fullName: string;
  sex: string;
  monthlyIncome: string;
  birthDate: string;
  profession: string;
  displayName: string;
};

const PROFILE_KEY = "nexo_profile";

const EMPTY_PROFILE: Profile = {
  fullName: "",
  sex: "",
  monthlyIncome: "",
  birthDate: "",
  profession: "",
  displayName: "",
};

function normalizeProfile(value: unknown): Profile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_PROFILE;
  const data = value as Record<string, unknown>;
  const fullName = typeof data.fullName === "string" ? data.fullName : "";
  return {
    fullName,
    sex: typeof data.sex === "string" ? data.sex : "",
    monthlyIncome: typeof data.monthlyIncome === "string" || typeof data.monthlyIncome === "number"
      ? String(data.monthlyIncome) : "",
    birthDate: typeof data.birthDate === "string" ? data.birthDate : "",
    profession: typeof data.profession === "string" ? data.profession : "",
    displayName: typeof data.displayName === "string" ? data.displayName : fullName,
  };
}

function readLocalProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? normalizeProfile(JSON.parse(raw)) : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

export default function PerfilPage() {
  const { session, loading: authLoading } = useNexoAuth();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const revision = useRef(0);
  const loaded = useRef(false);

  const loadProfile = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const collections = await fetchRemoteCollections();
      const remote = collections.find((item) => item.data_key === PROFILE_KEY);
      if (remote) {
        const next = normalizeProfile(remote.payload);
        revision.current = Number(remote.revision) || 0;
        setProfile(next);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("nexo:local-data-updated", { detail: { key: PROFILE_KEY } }));
        window.dispatchEvent(new Event("nexo:profile-updated"));
      } else {
        revision.current = 0;
        setProfile(readLocalProfile());
      }
      loaded.current = true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar seu perfil.");
      setProfile(readLocalProfile());
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!authLoading) void loadProfile();
  }, [authLoading, loadProfile]);

  function updateField<K extends keyof Profile>(field: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      setError("Entre na sua conta para salvar seu perfil.");
      return;
    }
    if (!profile.fullName.trim()) {
      setError("Informe seu nome completo.");
      return;
    }
    if (profile.birthDate && profile.birthDate > new Date().toISOString().slice(0, 10)) {
      setError("A data de nascimento não pode estar no futuro.");
      return;
    }
    if (profile.monthlyIncome && (!Number.isFinite(Number(profile.monthlyIncome)) || Number(profile.monthlyIncome) < 0)) {
      setError("Informe uma renda mensal válida.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const normalized: Profile = {
        ...profile,
        fullName: profile.fullName.trim(),
        profession: profile.profession.trim(),
        displayName: profile.fullName.trim(),
        monthlyIncome: profile.monthlyIncome.trim(),
      };
      const result = await saveRemoteCollection(PROFILE_KEY, normalized, revision.current);
      if (!result.saved) {
        await loadProfile();
        throw new Error("Seu perfil foi atualizado em outro dispositivo. Carregamos a versão mais recente; confira os dados antes de salvar novamente.");
      }
      revision.current = result.current_revision || revision.current + 1;
      setProfile(normalized);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent("nexo:local-data-updated", { detail: { key: PROFILE_KEY } }));
      window.dispatchEvent(new Event("nexo:profile-updated"));
      setMessage("Perfil atualizado e salvo com segurança na sua conta.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar seu perfil.");
    } finally {
      setSaving(false);
    }
  }

  const initials = profile.fullName.trim().split(/\\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "N";

  return (
    <AppLayout>
      <div className="content profile-page">
        <header className="profile-heading">
          <div>
            <div className="eyebrow">MINHA CONTA / PERFIL</div>
            <h1>Meu perfil</h1>
            <p>Complete suas informações para personalizar sua experiência e dar contexto aos seus indicadores pessoais e financeiros.</p>
          </div>
          <Link href="/configuracoes" className="profile-back">Configurações</Link>
        </header>

        {authLoading || loading ? (
          <section className="profile-panel profile-loading">Carregando informações do perfil...</section>
        ) : !session ? (
          <section className="profile-panel profile-login">
            <h2>Entre na sua conta para continuar</h2>
            <p>Seu perfil é individual e fica sincronizado com sua conta NEXO.</p>
            <Link href="/entrar" className="profile-submit">Entrar</Link>
          </section>
        ) : (
          <>
            <section className="profile-summary">
              <div className="profile-avatar">{initials}</div>
              <div className="profile-summary-copy">
                <span>SEU CADASTRO NEXO</span>
                <strong>{profile.fullName || "Complete seu nome"}</strong>
                <small>{session.user.email || "E-mail da conta"}</small>
              </div>
              <div className="profile-status"><span /> Conta conectada</div>
            </section>

            {message && <div className="profile-feedback success" role="status">{message}</div>}
            {error && <div className="profile-feedback error" role="alert">{error}</div>}

            <form className="profile-panel" onSubmit={saveProfile}>
              <div className="profile-section-title">
                <div><span>01 / INFORMAÇÕES PESSOAIS</span><h2>Seus dados</h2></div>
                <p>Essas informações podem ser atualizadas sempre que necessário.</p>
              </div>

              <div className="profile-grid">
                <label className="profile-field profile-field-wide">
                  <span>Nome completo <b>*</b></span>
                  <input value={profile.fullName} onChange={(event) => updateField("fullName", event.target.value)} placeholder="Digite seu nome completo" autoComplete="name" maxLength={120} required />
                </label>

                <label className="profile-field">
                  <span>Sexo</span>
                  <select value={profile.sex} onChange={(event) => updateField("sex", event.target.value)}>
                    <option value="">Selecione uma opção</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Não binário">Não binário</option>
                    <option value="Outro">Outro</option>
                    <option value="Prefiro não informar">Prefiro não informar</option>
                  </select>
                </label>

                <label className="profile-field">
                  <span>Data de nascimento</span>
                  <input type="date" value={profile.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => updateField("birthDate", event.target.value)} autoComplete="bday" />
                </label>

                <label className="profile-field">
                  <span>Renda mensal (R$)</span>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={profile.monthlyIncome} onChange={(event) => updateField("monthlyIncome", event.target.value)} placeholder="Ex.: 3500,00" />
                  <small>Informe sua renda mensal aproximada. Esse dado é privado da sua conta.</small>
                </label>

                <label className="profile-field">
                  <span>Profissão</span>
                  <input value={profile.profession} onChange={(event) => updateField("profession", event.target.value)} placeholder="Qual é sua profissão?" autoComplete="organization-title" maxLength={100} />
                </label>

                <label className="profile-field profile-field-wide">
                  <span>E-mail da conta</span>
                  <input value={session.user.email || ""} readOnly />
                  <small>O e-mail é gerenciado pela autenticação e não pode ser alterado nesta tela.</small>
                </label>
              </div>

              <div className="profile-form-footer">
                <span><b>*</b> Campo obrigatório</span>
                <button className="profile-submit" type="submit" disabled={saving || !loaded.current}>{saving ? "Salvando..." : "Salvar meu perfil"}</button>
              </div>
            </form>
            <div className="profile-privacy">Seus dados pessoais são armazenados na sua área individual do NEXO e sincronizados com sua conta. A renda é opcional e pode ser alterada ou removida quando quiser.</div>
          </>
        )}
      </div>

      <style jsx>{`
        .profile-page { max-width:1120px; margin:0 auto; padding-bottom:42px; }
        .profile-heading { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin:5px 0 22px; }
        .profile-heading h1 { margin:0; font:800 27px var(--font-heading); letter-spacing:-.8px; }
        .profile-heading p { max-width:650px; margin:8px 0 0; color:#92939a; font-size:12px; line-height:1.7; }
        .profile-back { padding:9px 12px; border:1px solid #38383e; border-radius:6px; color:#c7c9ce; font-size:10px; }
        .profile-summary { display:flex; align-items:center; gap:14px; padding:18px 20px; margin-bottom:14px; background:linear-gradient(110deg,#202024,#151517); border:1px solid #35353b; border-radius:10px; }
        .profile-avatar { display:grid; place-items:center; width:52px; height:52px; flex-shrink:0; border-radius:10px; background:linear-gradient(135deg,#e0e2e6,#7d838d); color:#111; font:800 17px var(--font-heading); }
        .profile-summary-copy { display:flex; flex:1; flex-direction:column; gap:4px; min-width:0; }
        .profile-summary-copy>span,.profile-section-title>div>span { color:#898d96; font-size:8px; font-weight:700; letter-spacing:1.5px; }
        .profile-summary-copy strong { color:#f1f1f3; font-size:15px; }
        .profile-summary-copy small { color:#888b93; font-size:10px; }
        .profile-status { display:flex; align-items:center; gap:7px; color:#aeb8b1; font-size:10px; }
        .profile-status span { width:7px; height:7px; border-radius:50%; background:#a8c7b3; }
        .profile-panel { padding:23px; background:linear-gradient(145deg,#19191c,#131315); border:1px solid #303036; border-radius:10px; }
        .profile-section-title { display:flex; justify-content:space-between; align-items:flex-end; gap:15px; padding-bottom:17px; margin-bottom:20px; border-bottom:1px solid #303036; }
        .profile-section-title h2,.profile-login h2 { margin:6px 0 0; color:#f1f1f3; font:700 17px var(--font-heading); }
        .profile-section-title p,.profile-login p { margin:0; color:#858890; font-size:10px; }
        .profile-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:19px 16px; }
        .profile-field { display:flex; flex-direction:column; gap:7px; min-width:0; }
        .profile-field-wide { grid-column:1/-1; }
        .profile-field>span { color:#c7c8ce; font-size:11px; }
        .profile-field b,.profile-form-footer>span b { color:#c5c9d0; }
        .profile-field input,.profile-field select { width:100%; min-height:42px; padding:10px 12px; color:#f0f0f2; background:#101012; border:1px solid #393940; border-radius:6px; outline:none; font-size:11px; }
        .profile-field input:focus,.profile-field select:focus { border-color:#aeb4be; box-shadow:0 0 0 2px #aeb4be18; }
        .profile-field input[readonly] { color:#898c94; background:#171719; }
        .profile-field small { color:#777b84; font-size:9px; line-height:1.5; }
        .profile-form-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-top:20px; margin-top:23px; border-top:1px solid #303036; }
        .profile-form-footer>span { color:#777b84; font-size:9px; }
        .profile-submit { display:inline-flex; align-items:center; justify-content:center; min-height:39px; padding:0 17px; color:#111214; background:linear-gradient(135deg,#e1e3e7,#9ba1ab); border:1px solid #c4c8cf; border-radius:6px; font-size:10px; font-weight:700; }
        .profile-submit:disabled { cursor:not-allowed; opacity:.55; }
        .profile-feedback { padding:12px 14px; margin-bottom:13px; border:1px solid #414149; border-radius:7px; font-size:11px; }
        .profile-feedback.success { color:#c8d8ce; background:#1b241e; border-color:#3d5144; }
        .profile-feedback.error { color:#e2b6b6; background:#281c1c; border-color:#704444; }
        .profile-privacy { margin:12px 2px 0; color:#777b84; font-size:9px; line-height:1.6; }
        .profile-loading,.profile-login { color:#aaa; }
        .profile-login p { margin:8px 0 18px; }
        @media(max-width:700px) { .profile-heading,.profile-section-title { align-items:flex-start; flex-direction:column; } .profile-summary { align-items:flex-start; flex-wrap:wrap; } .profile-status { width:100%; margin-left:66px; } .profile-grid { grid-template-columns:1fr; } .profile-field-wide { grid-column:auto; } .profile-panel { padding:16px; } .profile-form-footer { align-items:stretch; flex-direction:column; } .profile-submit { width:100%; } }
      `}</style>
    </AppLayout>
  );
}
