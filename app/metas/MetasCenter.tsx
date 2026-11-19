"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRoutineCollection } from "@/hooks/useRoutineCollection";

/* ---------- Tipos ---------- */
type Goal = {
  id: string;
  title: string;
  category: string;
  unit: string;
  target: number;
  current: number;
  deadline: string;
  createdAt: string;
};

type Filter = "todas" | "andamento" | "concluidas";

const categories = ["Financeira", "Saúde", "Estudos", "Carreira", "Pessoal"];
const units = ["R$", "unidades", "km", "kg", "%", "dias"];

function isValidGoal(value: unknown): value is Goal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.length > 0 &&
    typeof item.title === "string" && item.title.trim().length > 0 &&
    typeof item.category === "string" && typeof item.unit === "string" &&
    typeof item.target === "number" && Number.isFinite(item.target) && item.target > 0 &&
    typeof item.current === "number" && Number.isFinite(item.current) && item.current >= 0 &&
    typeof item.deadline === "string" && typeof item.createdAt === "string";
}

/* ---------- Ícones ---------- */
const icons: Record<string, ReactNode> = {
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></>,
  bars: <path d="M6 20V11M12 20V5M18 20v-7" />,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  cloud: <><path d="M20 16.2A4.5 4.5 0 0 0 18 7.5a6 6 0 0 0-11.6 1.8A3.8 3.8 0 0 0 7 17h12" /><path d="m9 13 3 3 3-3M12 16V9" /></>,
};

function Icon({ name, size = 20 }: { name: keyof typeof icons; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

/* ---------- Utilitários ---------- */
function localDateKey(date = new Date()) {
  return \`\${date.getFullYear()}-\${String(date.getMonth() + 1).padStart(2, "0")}-\${String(date.getDate()).padStart(2, "0")}\`;
}

function daysUntil(dateKey: string) {
  const a = new Date(\`\${dateKey}T12:00:00\`).getTime();
  const b = new Date(\`\${localDateKey()}T12:00:00\`).getTime();
  return Math.round((a - b) / 86400000);
}

function formatValue(value: number, unit: string) {
  const safe = Number.isFinite(value) ? value : 0;
  if (unit === "R$") return safe.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const n = safe.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unit === "%" ? \`\${n}%\` : \`\${n} \${unit}\`;
}

function parseNumber(raw: string) {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return NaN;
  return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

function newId() {
  return \`\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;
}

const percent = (goal: Goal) => goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
const isDone = (goal: Goal) => goal.target > 0 && goal.current >= goal.target;

function deadlineInfo(goal: Goal) {
  if (!goal.deadline) return { label: "Sem prazo", late: false };
  const days = daysUntil(goal.deadline);
  const date = new Date(\`\${goal.deadline}T12:00:00\`).toLocaleDateString("pt-BR");
  if (isDone(goal)) return { label: \`Prazo: \${date}\`, late: false };
  if (days < 0) return { label: \`Atrasada há \${Math.abs(days)} dia(s) · \${date}\`, late: true };
  if (days === 0) return { label: \`Vence hoje · \${date}\`, late: false };
  if (days === 1) return { label: \`Vence amanhã · \${date}\`, late: false };
  return { label: \`Faltam \${days} dias · \${date}\`, late: false };
}

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const moonNoise = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='700'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.011 .014' numOctaves='7' seed='11'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncR type='linear' slope='1.9' intercept='-.45'/%3E%3CfeFuncG type='linear' slope='1.9' intercept='-.45'/%3E%3CfeFuncB type='linear' slope='1.9' intercept='-.45'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const moonCraters = [
  "radial-gradient(circle at 34% 26%, rgba(0,0,0,.34) 0 3.2%, rgba(255,255,255,.12) 3.6%, transparent 5%)",
  "radial-gradient(circle at 24% 44%, rgba(0,0,0,.28) 0 2.2%, rgba(255,255,255,.10) 2.6%, transparent 4%)",
  "radial-gradient(ellipse at 20% 62%, rgba(20,20,24,.38) 0 6%, transparent 9%)",
  "radial-gradient(circle at 40% 52%, rgba(0,0,0,.30) 0 4%, rgba(255,255,255,.10) 4.6%, transparent 6%)",
].join(",");
const moonStyle: CSSProperties = {
  backgroundImage: \`\${moonCraters}, \${moonNoise}, radial-gradient(circle at 14% 52%, #dcdce0 0%, #b0b0b5 16%, #75757b 36%, #3a3a40 58%, #121215 82%)\`,
  backgroundBlendMode: "normal, normal, normal, normal, overlay, normal",
};

/* ---------- Componente ---------- */
export default function MetasCenter() {
  const { items: goals, setItems: setGoals, loaded, safeToSave, storageError } =
    useRoutineCollection<Goal>("nexo_personal_goals", isValidGoal);

  const [filter, setFilter] = useState<Filter>("todas");
  const [progressInputs, setProgressInputs] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [unit, setUnit] = useState(units[0]);
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const active = goals.filter((g) => !isDone(g));
  const finished = goals.filter(isDone);
  const avgProgress = goals.length ? Math.round(goals.reduce((sum, g) => sum + percent(g), 0) / goals.length) : 0;
  const nextDeadline = useMemo(
    () => active.filter((g) => g.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline))[0],
    [goals]
  );
  const visible = useMemo(() => {
    const list = goals.filter((g) => filter === "todas" ? true : filter === "concluidas" ? isDone(g) : !isDone(g));
    return [...list].sort((a, b) => {
      const done = Number(isDone(a)) - Number(isDone(b));
      if (done) return done;
      return (a.deadline || "9999-99-99").localeCompare(b.deadline || "9999-99-99");
    });
  }, [goals, filter]);

  function addGoal() {
    const targetValue = parseNumber(target);
    const currentValue = current.trim() ? parseNumber(current) : 0;
    if (!safeToSave) return setFormError("Aguarde a sincronização com a nuvem antes de criar uma meta.");
    if (!title.trim()) return setFormError("Dê um nome para a meta.");
    if (!Number.isFinite(targetValue) || targetValue <= 0) return setFormError("Informe um valor alvo maior que zero.");
    if (!Number.isFinite(currentValue) || currentValue < 0) return setFormError("O valor atual não pode ser negativo.");
    setGoals((prev) => [...prev, {
      id: newId(), title: title.trim(), category, unit, target: targetValue,
      current: currentValue, deadline, createdAt: localDateKey(),
    }]);
    setTitle(""); setTarget(""); setCurrent(""); setDeadline(""); setFormError(null);
  }

  function addProgress(id: string) {
    const amount = parseNumber(progressInputs[id] || "");
    if (!safeToSave || !Number.isFinite(amount) || amount <= 0) return;
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, current: g.current + amount } : g));
    setProgressInputs((prev) => ({ ...prev, [id]: "" }));
  }

  function completeGoal(id: string) {
    if (!safeToSave) return;
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, current: Math.max(g.current, g.target) } : g));
  }

  function removeGoal(id: string) {
    if (!safeToSave || (typeof window !== "undefined" && !window.confirm("Remover esta meta?"))) return;
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "todas", label: "Todas", count: goals.length },
    { key: "andamento", label: "Em andamento", count: active.length },
    { key: "concluidas", label: "Concluídas", count: finished.length },
  ];

  return (
    <div className="metas-center">
      <div className="metas-moon" style={moonStyle} aria-hidden="true" />
      <section className="metas-hero">
        <span className="metas-date">{dateLabel}</span>
        <h2>Metas</h2>
        <p>Defina objetivos, acompanhe o progresso e conquiste cada etapa.</p>
        <div className={safeToSave ? "metas-cloud is-ready" : "metas-cloud"}>
          <Icon name="cloud" size={14} />
          {loaded ? safeToSave ? "Dados sincronizados com a nuvem" : "Sincronização indisponível" : "Sincronizando suas metas…"}
        </div>
      </section>

      {storageError && <div className="metas-storage-error" role="alert">{storageError}</div>}

      <section className="metas-kpis">
        <article className="metas-kpi"><span className="metas-kpi-icon"><Icon name="target" size={27} /></span><strong>{String(active.length).padStart(2, "0")}</strong><small>Metas ativas</small></article>
        <article className="metas-kpi"><span className="metas-kpi-icon"><Icon name="checkCircle" size={27} /></span><strong>{String(finished.length).padStart(2, "0")}</strong><small>Metas concluídas</small></article>
        <article className="metas-kpi"><span className="metas-kpi-icon"><Icon name="bars" size={27} /></span><strong>{avgProgress}%</strong><small>Progresso médio</small></article>
        <article className="metas-kpi"><span className="metas-kpi-icon"><Icon name="calendar" size={27} /></span>
          <strong>{nextDeadline ? (() => { const d = daysUntil(nextDeadline.deadline); return d < 0 ? "Atrasada" : d === 0 ? "Hoje" : \`\${d} dia\${d === 1 ? "" : "s"}\`; })() : "—"}</strong>
          <small>{nextDeadline ? \`Próximo prazo · \${nextDeadline.title}\` : "Próximo prazo"}</small>
        </article>
      </section>

      <div className="metas-grid">
        <section className="metas-list">
          <div className="metas-tabs" role="tablist" aria-label="Filtrar metas">
            {tabs.map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={filter === tab.key}
              className={filter === tab.key ? "is-active" : ""} onClick={() => setFilter(tab.key)}>
              {tab.label} <em>{tab.count}</em>
            </button>)}
          </div>

          {!loaded ? <div className="metas-card"><p className="metas-empty">Carregando metas da sua conta…</p></div>
          : visible.length === 0 ? <div className="metas-card"><p className="metas-empty">
            {goals.length === 0 ? "Você ainda não criou nenhuma meta. Use o formulário ao lado para começar." : "Nenhuma meta neste filtro."}
          </p></div>
          : visible.map((goal) => {
            const pct = percent(goal);
            const done = isDone(goal);
            const info = deadlineInfo(goal);
            return <article className={\`metas-card metas-goal\${done ? " is-done" : ""}\`} key={goal.id}>
              <div className="metas-ring"><svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r={RING_RADIUS} className="ring-bg" />
                <circle cx="50" cy="50" r={RING_RADIUS} className="ring-fg" strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - pct / 100)} />
              </svg><strong>{pct}%</strong></div>
              <div className="metas-goal-body">
                <div className="metas-goal-top"><span className="metas-tag">{goal.category}</span>
                  <span className={\`metas-status\${done ? " ok" : info.late ? " late" : ""}\`}>{done ? "Concluída" : info.late ? "Atrasada" : "Em andamento"}</span>
                </div>
                <h3>{goal.title}</h3>
                <p className="metas-values"><b>{formatValue(goal.current, goal.unit)}</b> de {formatValue(goal.target, goal.unit)}</p>
                <small className={info.late ? "late" : ""}>{info.label}</small>
                <div className="metas-actions">
                  {!done && <>
                    <input value={progressInputs[goal.id] || ""} disabled={!safeToSave}
                      onChange={(e) => setProgressInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") addProgress(goal.id); }}
                      inputMode="decimal" placeholder="Quanto avançou?" aria-label={\`Registrar progresso em \${goal.title}\`} />
                    <button type="button" disabled={!safeToSave} onClick={() => addProgress(goal.id)}>Adicionar</button>
                    <button type="button" disabled={!safeToSave} className="ghost" onClick={() => completeGoal(goal.id)}>Concluir</button>
                  </>}
                  <button type="button" disabled={!safeToSave} className="icon" onClick={() => removeGoal(goal.id)}
                    aria-label={\`Remover \${goal.title}\`}><Icon name="trash" size={16} /></button>
                </div>
              </div>
            </article>;
          })}
        </section>

        <aside className="metas-card metas-form">
          <header><h3><Icon name="flag" size={20} /> Nova meta</h3><small>Um passo de cada vez.</small></header>
          <label><span>Nome da meta</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Reserva de emergência" /></label>
          <div className="metas-form-row">
            <label><span>Categoria</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label><span>Unidade</span><select value={unit} onChange={(e) => setUnit(e.target.value)}>{units.map((u) => <option key={u}>{u}</option>)}</select></label>
          </div>
          <div className="metas-form-row">
            <label><span>Valor alvo</span><input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="10000" /></label>
            <label><span>Valor atual</span><input value={current} onChange={(e) => setCurrent(e.target.value)} inputMode="decimal" placeholder="0" /></label>
          </div>
          <label><span>Prazo (opcional)</span><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
          {formError && <p className="metas-error" role="alert">{formError}</p>}
          <button type="button" className="metas-submit" disabled={!safeToSave} onClick={addGoal}><Icon name="plus" size={16} /> Criar meta</button>
          {!safeToSave && <small className="metas-form-hint">Entre na sua conta e aguarde a sincronização para cadastrar metas.</small>}
          <Link href="/" className="metas-back">Voltar ao início <Icon name="arrow" size={14} /></Link>
        </aside>
      </div>

      <style jsx global>{\`
        .metas-center{position:relative;isolation:isolate;display:flex;flex-direction:column;gap:16px;min-width:0;padding:6px 0 28px;color:#f1f1f3;overflow:hidden}
        .metas-center>*{position:relative;z-index:1}
        .metas-center>.metas-moon{position:absolute;z-index:0;pointer-events:none;top:-290px;right:-70px;width:min(780px,70%);aspect-ratio:1;border-radius:50%;opacity:.72;filter:grayscale(1);box-shadow:0 0 90px rgba(190,190,205,.07)}
        .metas-center::after{content:"";position:absolute;z-index:0;inset:0 0 auto;height:560px;pointer-events:none;opacity:.28;background-image:radial-gradient(1px 1px at 8% 18%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 22% 9%,#dfe2ea 99%,transparent),radial-gradient(1.5px 1.5px at 49% 15%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 33% 38%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 61% 43%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 13% 57%,#dfe2ea 99%,transparent);mask-image:linear-gradient(to bottom,#000,transparent)}
        .metas-hero{padding:28px 0 4px;max-width:640px}
        .metas-date{display:block;color:#a9a9b3;font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase}
        .metas-hero h2{margin:9px 0 7px;color:#fff;font-size:clamp(38px,5vw,62px);font-weight:700;letter-spacing:-2px;line-height:1.05}
        .metas-hero p{margin:0;color:#b8b8c2;font-size:clamp(14px,1.4vw,18px);font-weight:300}
        .metas-cloud{display:flex;align-items:center;gap:6px;margin-top:13px;color:#9999a3;font-size:11px}
        .metas-cloud.is-ready{color:#a8cbb3}
        .metas-storage-error{padding:11px 14px;border:1px solid #704b4b;border-radius:10px;background:#24191b;color:#dfb4b4;font-size:12px;line-height:1.5}
        .metas-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-top:4px}
        .metas-kpi{display:flex;flex-direction:column;gap:2px;min-width:0;padding:17px 18px 15px;border:1px solid #2d2d34;border-radius:15px;background:rgba(20,20,24,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 12px 28px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.04)}
        .metas-kpi-icon{display:flex;color:#d7d7df;margin-bottom:5px}
        .metas-kpi strong{overflow-wrap:anywhere;font-size:clamp(24px,2.4vw,33px);font-weight:700;letter-spacing:-.8px;line-height:1.15}
        .metas-kpi small{color:#a6a6b0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .metas-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:14px;align-items:start}
        .metas-list{display:flex;flex-direction:column;gap:12px;min-width:0}
        .metas-tabs{display:flex;flex-wrap:wrap;gap:7px}
        .metas-tabs button{padding:9px 13px;border:1px solid #2d2d34;border-radius:9px;background:rgba(20,20,24,.72);color:#c9c9d0;font-size:12px;cursor:pointer;transition:all .18s ease}
        .metas-tabs button em{margin-left:5px;color:#8d8d97;font-style:normal}
        .metas-tabs button:hover{border-color:#55555f;color:#fff}
        .metas-tabs button.is-active{border-color:#c6c8cf;background:linear-gradient(180deg,#dedfe3,#bfc1c8);color:#17171a;font-weight:700}
        .metas-tabs button.is-active em{color:#4a4a52}
        .metas-card{min-width:0;padding:19px 20px;border:1px solid #2d2d34;border-radius:15px;background:rgba(20,20,24,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 12px 28px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.04)}
        .metas-empty{margin:6px 0;color:#9999a3;font-size:13px;line-height:1.6}
        .metas-goal{display:flex;align-items:center;gap:20px}
        .metas-goal.is-done{opacity:.82}
        .metas-ring{position:relative;flex-shrink:0;width:90px;height:90px}
        .metas-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
        .metas-ring circle{fill:none;stroke-width:9}
        .metas-ring .ring-bg{stroke:#3a3a42}
        .metas-ring .ring-fg{stroke:#d9dbe1;stroke-linecap:round;transition:stroke-dashoffset .4s ease}
        .metas-ring strong{position:absolute;inset:0;display:grid;place-items:center;font-size:18px;font-weight:650}
        .metas-goal-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
        .metas-goal-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .metas-tag,.metas-status{padding:4px 9px;border:1px solid #42424a;border-radius:7px;color:#b9b9c1;font-size:10px}
        .metas-status.ok{border-color:#4f6a58;color:#a9cdb4}
        .metas-status.late{border-color:#765454;color:#d7aaaa}
        .metas-goal h3{margin:2px 0 0;color:#f4f4f6;font-size:17px;font-weight:650;letter-spacing:-.2px;overflow-wrap:anywhere}
        .metas-values{margin:0;color:#b4b4bd;font-size:13px}
        .metas-values b{color:#f1f1f3;font-weight:650}
        .metas-goal small{color:#92929c;font-size:11px}
        .metas-goal small.late{color:#d7aaaa}
        .metas-actions{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:7px}
        .metas-actions input{flex:1;min-width:120px;height:35px;padding:0 11px;border:1px solid #3b3b44;border-radius:8px;background:#111114;color:#eeeef1;font-size:13px;outline:none}
        .metas-actions input:focus{border-color:#85858f}
        .metas-actions button{height:35px;padding:0 12px;border:1px solid #d0d2d8;border-radius:8px;background:linear-gradient(180deg,#dedfe3,#bfc1c8);color:#17171a;font-size:11px;font-weight:700;cursor:pointer}
        .metas-actions button:disabled,.metas-submit:disabled{opacity:.45;cursor:not-allowed}
        .metas-actions button.ghost,.metas-actions button.icon{border-color:#3b3b44;background:rgba(255,255,255,.035);color:#d8d8de;font-weight:500}
        .metas-actions button.ghost:hover,.metas-actions button.icon:hover{border-color:#62626c;color:#fff}
        .metas-actions button.icon{display:grid;place-items:center;width:35px;padding:0}
        .metas-form{display:flex;flex-direction:column;gap:13px;position:sticky;top:12px}
        .metas-form header{display:flex;justify-content:space-between;align-items:center;gap:10px}
        .metas-form header h3{display:flex;align-items:center;gap:9px;margin:0;color:#f4f4f6;font-size:16px;font-weight:650}
        .metas-form header>small{color:#888894;font-size:10px}
        .metas-form label{display:flex;flex-direction:column;gap:6px;min-width:0}
        .metas-form label>span{color:#a9a9b3;font-size:11px}
        .metas-form input,.metas-form select{width:100%;height:39px;padding:0 11px;border:1px solid #3b3b44;border-radius:8px;background:#111114;color:#eeeef1;font-size:13px;outline:none;box-sizing:border-box;color-scheme:dark}
        .metas-form input::placeholder{color:#777781}
        .metas-form input:focus,.metas-form select:focus{border-color:#85858f}
        .metas-form-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
        .metas-error{margin:0;padding:9px 11px;border:1px solid #654b4b;border-radius:8px;background:#241b1d;color:#dcb5b5;font-size:12px}
        .metas-form-hint{color:#a0a0aa;font-size:10px;line-height:1.5}
        .metas-submit{display:flex;align-items:center;justify-content:center;gap:8px;height:41px;border:1px solid #d0d2d8;border-radius:9px;background:linear-gradient(180deg,#dedfe3,#bfc1c8);color:#17171a;font-size:12px;font-weight:700;cursor:pointer;transition:filter .18s ease,transform .18s ease}
        .metas-submit:hover:not(:disabled){filter:brightness(1.06);transform:translateY(-1px)}
        .metas-back{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;color:#c9c9d0;font-size:11px;text-decoration:none}
        .metas-back:hover{color:#fff}
        @media(max-width:1100px){.metas-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.metas-grid{grid-template-columns:minmax(0,1fr)}.metas-form{position:static}}
        @media(max-width:640px){.metas-center{gap:13px}.metas-center>.metas-moon{top:-130px;right:-210px;width:450px;opacity:.55}.metas-hero{padding:20px 0 3px}.metas-kpis{gap:9px}.metas-kpi{padding:14px 12px;border-radius:13px}.metas-kpi small{font-size:11px}.metas-card{padding:14px;border-radius:13px}.metas-goal{align-items:flex-start;gap:12px}.metas-ring{width:68px;height:68px}.metas-ring strong{font-size:14px}.metas-actions input{font-size:16px}}
      \`}</style>
    </div>
  );
}
