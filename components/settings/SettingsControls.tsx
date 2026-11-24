"use client";

import { useNexoConfirm } from "@/contexts/NexoConfirmProvider";
import { useSettings } from "@/contexts/SettingsProvider";
import type { SettingsSection, UserSettings } from "@/lib/settings/schema";

const pageOptions: Array<{ value: UserSettings["general"]["homePage"]; label: string }> = [
  { value: "/", label: "Central do Dia" },
  { value: "/financeiro", label: "Financeiro" },
  { value: "/rotina/agenda", label: "Agenda" },
  { value: "/rotina/habitos", label: "Hábitos" },
  { value: "/metas", label: "Metas" },
];

function SaveStatus() {
  const { saveState, error, retrySave } = useSettings();
  if (saveState === "saved") return <p className="settings-save-status" role="status">✓ Salvo na sua conta</p>;
  if (saveState === "saving" || saveState === "loading") return <p className="settings-save-status" role="status">Sincronizando configurações…</p>;
  if (saveState === "error") return <div className="settings-save-error" role="alert"><span>{error || "Erro ao salvar."}</span><button type="button" onClick={retrySave}>Tentar novamente</button></div>;
  return <p className="settings-save-status" role="status">Offline — alterações mantidas no cache deste dispositivo</p>;
}

function RestoreButton({ section }: { section: SettingsSection }) {
  const confirm = useNexoConfirm();
  const { resetSection } = useSettings();
  const labels: Record<SettingsSection, string> = {
    general: "preferências gerais",
    navigation: "navegação",
    routine: "rotina",
    finance: "finanças",
    appearance: "personalização",
    security: "segurança",
  };
  return <button className="settings-reset-button" type="button" onClick={async () => {
    const accepted = await confirm({
      title: "Restaurar padrões",
      message: \`As configurações de \${labels[section]} voltarão aos valores padrão. Deseja continuar?\`,
      confirmLabel: "Restaurar",
      destructive: true,
    });
    if (accepted) resetSection(section);
  }}>Restaurar padrões</button>;
}

export function PreferencesControls() {
  const { settings, updateSettings } = useSettings();
  return (
    <div className="settings-controls-stack">
      <section className="settings-subsection">
        <div className="settings-subsection-heading"><div><h3>Geral</h3><p>Escolha como o NEXO deve abrir e organizar sua navegação.</p></div><RestoreButton section="general" /></div>
        <label className="settings-field"><span>Página inicial ao abrir o NEXO</span>
          <select value={settings.general.homePage} onChange={(event) => updateSettings({ general: { homePage: event.target.value as UserSettings["general"]["homePage"] } })}>
            {pageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div className="settings-toggle"><span><strong>Menu lateral compacto</strong><small>Recolhe a navegação e libera espaço de trabalho.</small></span>
          <input aria-label="Menu lateral compacto" type="checkbox" checked={settings.navigation.sidebarCompact} onChange={(event) => updateSettings({ navigation: { sidebarCompact: event.target.checked } })} />
        </div>
        <div className="settings-note">Idioma e moeda permanecem em pt-BR e R$. O fuso padrão do NEXO é America/Sao_Paulo.</div>
      </section>

      <section className="settings-subsection">
        <div className="settings-subsection-heading"><div><h3>Privacidade financeira</h3><p>Oculte valores nas telas que exibem indicadores e movimentações.</p></div><RestoreButton section="finance" /></div>
        <div className="settings-toggle"><span><strong>Ocultar valores</strong><small>Aplica o modo de privacidade globalmente às áreas financeiras compatíveis.</small></span>
          <input aria-label="Ocultar valores financeiros" type="checkbox" checked={settings.finance.hideValues} onChange={(event) => updateSettings({ finance: { hideValues: event.target.checked } })} />
        </div>
        <label className="settings-field"><span>Início do mês financeiro</span>
          <select value={settings.finance.monthStartDay} onChange={(event) => updateSettings({ finance: { monthStartDay: Number(event.target.value) } })}>
            {[1, 5, 10, 15, 20, 25].map((day) => <option key={day} value={day}>Dia {day}</option>)}
          </select>
        </label>
        <label className="settings-field"><span>Alertar sobre contas a vencer</span>
          <select value={settings.finance.dueAlertDays} onChange={(event) => updateSettings({ finance: { dueAlertDays: Number(event.target.value) } })}>
            {[0, 1, 3, 5, 7, 10, 15, 30].map((day) => <option key={day} value={day}>{day === 0 ? "Somente no vencimento" : \`\${day} dias antes\`}</option>)}
          </select>
        </label>
        <p className="settings-note">O ciclo financeiro e o alerta são armazenados como preferências. A aplicação desses parâmetros aos relatórios e às notificações será liberada quando os módulos de relatórios e alertas compartilharem a mesma regra de período.</p>
      </section>

      <section className="settings-subsection">
        <div className="settings-subsection-heading"><div><h3>Segurança da sessão</h3><p>Encerre a sessão após um período sem atividade.</p></div><RestoreButton section="security" /></div>
        <label className="settings-field"><span>Logout automático por inatividade</span>
          <select value={settings.security.inactivityMinutes} onChange={(event) => updateSettings({ security: { inactivityMinutes: Number(event.target.value) as UserSettings["security"]["inactivityMinutes"] } })}>
            <option value={0}>Desativado</option><option value={5}>5 minutos</option><option value={10}>10 minutos</option><option value={15}>15 minutos</option><option value={30}>30 minutos</option>
          </select>
        </label>
      </section>
      <SaveStatus />
    </div>
  );
}

const accents: Array<{ value: UserSettings["appearance"]["accent"]; label: string }> = [
  { value: "silver", label: "Prata" },
  { value: "blue", label: "Azul" },
  { value: "violet", label: "Violeta" },
  { value: "emerald", label: "Esmeralda" },
  { value: "amber", label: "Âmbar" },
  { value: "rose", label: "Rosa" },
];

export function AppearanceControls() {
  const { settings, updateSettings } = useSettings();
  return (
    <div className="settings-controls-stack">
      <section className="settings-subsection">
        <div className="settings-subsection-heading"><div><h3>Identidade visual</h3><p>As alterações são aplicadas imediatamente nesta sessão.</p></div><RestoreButton section="appearance" /></div>
        <label className="settings-field"><span>Tema</span><select value={settings.appearance.theme} onChange={(event) => updateSettings({ appearance: { theme: event.target.value as UserSettings["appearance"]["theme"] } })}><option value="dark">Escuro</option><option value="light">Claro</option><option value="system">Automático (sistema)</option></select></label>
        <div className="settings-field"><span>Cor de destaque</span><div className="settings-accent-grid">{accents.map((accent) => <button key={accent.value} type="button" className={\`settings-accent \${settings.appearance.accent === accent.value ? "active" : ""}\`} data-accent={accent.value} aria-pressed={settings.appearance.accent === accent.value} onClick={() => updateSettings({ appearance: { accent: accent.value } })}><i aria-hidden="true" />{accent.label}</button>)}</div></div>
        <label className="settings-field"><span>Densidade</span><select value={settings.appearance.density} onChange={(event) => updateSettings({ appearance: { density: event.target.value as UserSettings["appearance"]["density"] } })}><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label>
        <label className="settings-field"><span>Tamanho da fonte</span><select value={settings.appearance.fontScale} onChange={(event) => updateSettings({ appearance: { fontScale: event.target.value as UserSettings["appearance"]["fontScale"] } })}><option value="small">Pequena</option><option value="normal">Padrão</option><option value="large">Grande</option></select></label>
        <div className="settings-toggle"><span><strong>Reduzir animações</strong><small>Respeita também a preferência de movimento reduzido do sistema.</small></span><input aria-label="Reduzir animações" type="checkbox" checked={settings.appearance.reduceMotion} onChange={(event) => updateSettings({ appearance: { reduceMotion: event.target.checked } })} /></div>
        <div className="settings-toggle"><span><strong>Alto contraste</strong><small>Reforça bordas e contraste de textos.</small></span><input aria-label="Alto contraste" type="checkbox" checked={settings.appearance.highContrast} onChange={(event) => updateSettings({ appearance: { highContrast: event.target.checked } })} /></div>
      </section>
      <section className="settings-preview-live" aria-live="polite">
        <span className="eyebrow">PRÉ-VISUALIZAÇÃO AO VIVO</span><strong>NEXO — Gestão Pessoal</strong><p>Seu espaço de organização, com a aparência selecionada.</p><button type="button">Ação de destaque</button>
      </section>
      <SaveStatus />
    </div>
  );
}
