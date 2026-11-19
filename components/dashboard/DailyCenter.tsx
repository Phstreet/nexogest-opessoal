"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { RoutineHabit, RoutineTask } from "@/lib/routine/types";
import type { Transaction } from "@/lib/finance/types";

type Props = {
  tasks: RoutineTask[];
  habits: RoutineHabit[];
  transactions: Transaction[];
  financeLoaded: boolean;
  financeError: string | null;
  income: number;
  expenses: number;
  balance: number;
  onToggleTask: (id: number) => void;
  onToggleHabit: (id: number) => void;
  onAddTask: () => void;
  taskName: string;
  onTaskNameChange: (value: string) => void;
  canSaveTasks: boolean;
  canSaveHabits: boolean;
  taskError: string | null;
  habitError: string | null;
};

/* ---------- Ícones (SVG inline, sem dependências) ---------- */
const icons: Record<string, ReactNode> = {
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="4" y="8" width="16" height="11" rx="2.5" /><path d="M16 13.5h2" /></>,
  bars: <path d="M6 20V11M12 20V5M18 20v-7" />,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  trend: <><path d="m4 16 5-5 3 3 7-7" /><path d="M4 20h16" /></>,
  card: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M3.5 10h17" /></>,
  drop: <path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z" />,
  wifi: <><path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a8 8 0 0 1 11 0M9.4 16a4 4 0 0 1 5.2 0" /><circle cx="12" cy="19" r=".6" /></>,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

function Icon({ name, size = 20 }: { name: keyof typeof icons; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

/* ---------- Utilitários ---------- */
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function money(value: number) {
  return (Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function settledAmount(item: Transaction) {
  const amount = Math.max(0, Number(item.amount) || 0);
  if (item.status === "Cancelada") return 0;
  if (typeof item.settledAmount === "number") {
    return Math.min(amount, Math.max(0, item.settledAmount));
  }
  const status = (item.status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ["pago", "paga", "recebida", "recebido", "aplicado", "aplicada"].includes(status)
    ? amount
    : 0;
}

function daysBetween(dateKey: string, fromKey: string) {
  const a = new Date(`${dateKey}T12:00:00`).getTime();
  const b = new Date(`${fromKey}T12:00:00`).getTime();
  return Math.round((a - b) / 86400000);
}

function dueLabel(days: number) {
  if (days <= 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

function billIcon(description: string): keyof typeof icons {
  const text = (description || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/agua|esgoto|saneamento/.test(text)) return "drop";
  if (/internet|wifi|wi-fi|fibra|net\b/.test(text)) return "wifi";
  return "card";
}

const priorityWeight: Record<string, number> = {
  Urgente: 0,
  Alta: 1,
  Média: 2,
  Baixa: 3,
};

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export default function DailyCenter(props: Props) {
  const today = new Date();
  const todayKey = localDateKey(today);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekKey = localDateKey(nextWeek);
  const hour = today.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const dateLabel = today.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  /* Tarefas */
  const todaysTasks = props.tasks.filter((task) => task.date === todayKey);
  const completedToday = todaysTasks.filter((task) => task.done);
  const pendingToday = todaysTasks.filter((task) => !task.done).sort((a, b) => {
    const priority = (priorityWeight[a.priority || "Média"] ?? 2) - (priorityWeight[b.priority || "Média"] ?? 2);
    return priority || (a.time || "99:99").localeCompare(b.time || "99:99");
  });
  const overdueTasks = props.tasks.filter((task) => !task.done && Boolean(task.date) && task.date! < todayKey)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const taskRate = todaysTasks.length ? Math.round((completedToday.length / todaysTasks.length) * 100) : 0;
  const pendingCount = pendingToday.length + overdueTasks.length;
  const focusTasks = [...overdueTasks, ...pendingToday].slice(0, 4);

  /* Agenda: tarefas de hoje que têm horário */
  const agendaToday = todaysTasks
    .filter((task) => Boolean(task.time))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  /* Hábitos */
  const activeHabits = props.habits.filter((habit) => habit.active);
  const completedHabits = activeHabits.filter((habit) => habit.completedDates.includes(todayKey));
  const habitRate = activeHabits.length ? completedHabits.length / activeHabits.length : 0;

  /* Contas próximas (despesas pendentes nos próximos 7 dias) */
  const upcomingBills = props.transactions.filter((item) =>
    item.type === "Despesa" &&
    item.status !== "Cancelada" &&
    Boolean(item.date) &&
    item.date! >= todayKey &&
    item.date! <= nextWeekKey &&
    settledAmount(item) < Number(item.amount || 0)
  ).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const overdueBills = props.transactions.filter((item) =>
    item.type === "Despesa" &&
    item.status !== "Cancelada" &&
    Boolean(item.date) &&
    item.date! < todayKey &&
    settledAmount(item) < Number(item.amount || 0)
  );

  const quickLinks: { label: string; href: string; icon: keyof typeof icons }[] = [
    { label: "Tarefas", href: "/rotina/agenda", icon: "checkCircle" },
    { label: "Finanças", href: "/financeiro", icon: "wallet" },
    { label: "Hábitos", href: "/rotina/habitos", icon: "trend" },
    { label: "Metas", href: "/rotina/metas", icon: "target" },
    { label: "Agenda", href: "/rotina/agenda", icon: "calendar" },
    { label: "Relatórios", href: "/relatorios", icon: "bars" },
  ];

  return (
    <div className="daily-center">
      {(props.taskError || props.habitError || props.financeError) && (
        <div className="daily-alert" role="alert">
          <strong>Alguns dados não puderam ser carregados.</strong>
          <span>{[props.taskError, props.habitError, props.financeError].filter(Boolean).join(" ")}</span>
        </div>
      )}

      {/* HERO */}
      <section className="daily-hero">
        <span className="daily-date">{dateLabel}</span>
        <h2>{greeting}!</h2>
        <p>Sua central de organização e controle.</p>
      </section>

      {/* KPIs */}
      <section className="daily-kpis">
        <Link href="/rotina/agenda" className="daily-kpi">
          <span className="daily-kpi-icon"><Icon name="checkCircle" size={30} /></span>
          <strong>{String(pendingCount).padStart(2, "0")}</strong>
          <div><small>Tarefas pendentes</small><Icon name="arrow" size={18} /></div>
        </Link>
        <Link href="/rotina/agenda" className="daily-kpi">
          <span className="daily-kpi-icon"><Icon name="calendar" size={30} /></span>
          <strong>{String(agendaToday.length).padStart(2, "0")}</strong>
          <div><small>Compromissos hoje</small><Icon name="arrow" size={18} /></div>
        </Link>
        <Link href="/financeiro" className="daily-kpi">
          <span className="daily-kpi-icon"><Icon name="wallet" size={30} /></span>
          <strong>{props.financeLoaded ? money(props.balance) : "Carregando…"}</strong>
          <div><small>Saldo disponível</small><Icon name="arrow" size={18} /></div>
        </Link>
        <Link href="/rotina/habitos" className="daily-kpi">
          <span className="daily-kpi-icon"><Icon name="bars" size={30} /></span>
          <strong>{taskRate}%</strong>
          <div><small>Progresso do dia</small><Icon name="arrow" size={18} /></div>
        </Link>
      </section>

      {/* GRADE PRINCIPAL */}
      <div className="daily-grid">
        {/* Prioridades de hoje */}
        <section className="daily-card area-priorities">
          <header>
            <h3><Icon name="star" size={20} /> Prioridades de hoje</h3>
            <Link href="/rotina/agenda">Ver todas <Icon name="arrow" size={13} /></Link>
          </header>
          {focusTasks.length ? focusTasks.map((task) => (
            <div className="daily-row" key={task.id}>
              <button type="button" className="daily-circle" disabled={!props.canSaveTasks}
                onClick={() => props.onToggleTask(task.id)} aria-label={`Concluir ${task.description}`} />
              <span className={task.date && task.date < todayKey ? "is-overdue" : ""}>{task.description}</span>
            </div>
          )) : (
            <p className="daily-empty">{todaysTasks.length ? "Você concluiu todas as tarefas de hoje." : "Nenhuma tarefa programada para hoje."}</p>
          )}
          <div className="daily-add">
            <input value={props.taskName} onChange={(event) => props.onTaskNameChange(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") props.onAddTask(); }}
              placeholder="Adicionar tarefa para hoje…" aria-label="Nova tarefa para hoje" />
            <button type="button" onClick={props.onAddTask} disabled={!props.canSaveTasks}>Adicionar</button>
          </div>
        </section>

        {/* Minha agenda */}
        <section className="daily-card area-agenda">
          <header>
            <h3><Icon name="calendar" size={20} /> Minha agenda</h3>
            <Link href="/rotina/agenda">Ver agenda <Icon name="arrow" size={13} /></Link>
          </header>
          {agendaToday.length ? agendaToday.slice(0, 4).map((task) => (
            <div className="daily-agenda-item" key={task.id}>
              <time>{task.time}</time>
              <i />
              <span className={task.done ? "is-done" : ""}>{task.description}</span>
            </div>
          )) : <p className="daily-empty">Nenhum compromisso com horário hoje.</p>}
        </section>

        {/* Acesso rápido */}
        <section className="daily-card area-quick">
          <header>
            <h3><Icon name="bolt" size={20} /> Acesso rápido</h3>
          </header>
          <nav className="daily-quick-grid" aria-label="Acesso rápido">
            {quickLinks.map((item) => (
              <Link href={item.href} key={item.label}>
                <Icon name={item.icon} size={24} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </section>

        {/* Hábitos do dia */}
        <section className="daily-card area-habits">
          <header>
            <h3><Icon name="bars" size={20} /> Hábitos do dia</h3>
            <Link href="/rotina/habitos">Ver todos <Icon name="arrow" size={13} /></Link>
          </header>
          {activeHabits.length ? (
            <div className="daily-habits">
              <div className="daily-ring">
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r={RING_RADIUS} className="ring-bg" />
                  <circle cx="50" cy="50" r={RING_RADIUS} className="ring-fg"
                    strokeDasharray={RING_LENGTH}
                    strokeDashoffset={RING_LENGTH * (1 - habitRate)} />
                </svg>
                <div><strong>{completedHabits.length}/{activeHabits.length}</strong><small>Concluídos</small></div>
              </div>
              <ul>
                {activeHabits.slice(0, 4).map((habit) => {
                  const done = habit.completedDates.includes(todayKey);
                  return (
                    <li key={habit.id}>
                      <button type="button" className={`daily-circle small${done ? " checked" : ""}`}
                        disabled={!props.canSaveHabits} onClick={() => props.onToggleHabit(habit.id)}
                        aria-label={done ? `Desmarcar ${habit.name}` : `Concluir ${habit.name}`}>
                        {done && <Icon name="check" size={12} />}
                      </button>
                      <span>{habit.name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : <p className="daily-empty">Você ainda não cadastrou hábitos. <Link href="/rotina/habitos">Criar um hábito ↗</Link></p>}
        </section>

        {/* Contas próximas */}
        <section className="daily-card area-bills">
          <header>
            <h3><Icon name="card" size={20} /> Contas próximas</h3>
            <Link href="/financeiro/contas-a-pagar">Ver todas <Icon name="arrow" size={13} /></Link>
          </header>
          {!props.financeLoaded ? <p className="daily-empty">Carregando informações financeiras…</p> : (
            <>
              {overdueBills.length > 0 && (
                <p className="daily-warning">{overdueBills.length} conta(s) com vencimento anterior ainda pendente(s).</p>
              )}
              {upcomingBills.length ? upcomingBills.slice(0, 3).map((item) => (
                <div className="daily-bill" key={`${item.type}-${item.id}`}>
                  <span className="daily-bill-icon"><Icon name={billIcon(item.description)} size={18} /></span>
                  <div>
                    <strong>{item.description}</strong>
                    <small>{dueLabel(daysBetween(item.date!, todayKey))}</small>
                  </div>
                  <b>{money(Math.max(0, Number(item.amount || 0) - settledAmount(item)))}</b>
                </div>
              )) : <p className="daily-empty">Nenhuma conta vencendo nos próximos 7 dias.</p>}
            </>
          )}
        </section>

        {/* Dica do dia */}
        <section className="daily-card area-tip">
          <span className="daily-bill-icon round"><Icon name="bulb" size={20} /></span>
          <div>
            <strong>Dica do dia</strong>
            <p>Pequenas atitudes diárias constroem grandes resultados.</p>
          </div>
          <Icon name="arrow" size={18} />
        </section>
      </div>

      <style jsx>{`
        /* Lua: ESO/NASA/M. Kornmesser — CC BY 4.0
           https://www.eso.org/public/images/eso1210d
           Para ficar idêntico à referência, salve uma foto da lua em /public/moon.jpg
           e troque a URL abaixo por url("/moon.jpg"). */
        .daily-center{position:relative;isolation:isolate;display:flex;flex-direction:column;gap:18px;min-width:0;padding:6px 0 28px;color:#f1f1f3;overflow:hidden}
        .daily-center>*{position:relative;z-index:1}
        .daily-center::before{content:"";position:absolute;z-index:0;pointer-events:none;top:-200px;right:-170px;width:min(860px,72%);aspect-ratio:1;border-radius:50%;
          background-image:url("https://upload.wikimedia.org/wikipedia/commons/0/0a/Artists%E2%80%99s_impression_of_the_Moon_showing_earthshine_%28eso1210d%29.jpg");
          background-size:cover;background-position:center;opacity:.85;filter:grayscale(1) contrast(1.12) brightness(.95);
          -webkit-mask-image:radial-gradient(circle at 46% 50%,#000 0 56%,rgba(0,0,0,.8) 66%,transparent 78%);
          mask-image:radial-gradient(circle at 46% 50%,#000 0 56%,rgba(0,0,0,.8) 66%,transparent 78%)}
        .daily-center::after{content:"";position:absolute;z-index:0;inset:0 0 auto;height:560px;pointer-events:none;opacity:.35;
          background-image:radial-gradient(1px 1px at 8% 18%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 22% 9%,#dfe2ea 99%,transparent),radial-gradient(1.5px 1.5px at 49% 15%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 33% 38%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 61% 43%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 13% 57%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 41% 6%,#dfe2ea 99%,transparent);
          mask-image:linear-gradient(to bottom,#000,transparent)}

        /* Hero */
        .daily-hero{padding:34px 0 8px;max-width:640px}
        .daily-date{display:block;color:#a9a9b3;font-size:13px;font-weight:500;letter-spacing:2.4px;text-transform:uppercase}
        .daily-hero h2{margin:10px 0 8px;color:#fff;font-size:clamp(42px,5.4vw,68px);font-weight:700;letter-spacing:-2.2px;line-height:1.05}
        .daily-hero p{margin:0;color:#c3c3cb;font-size:clamp(16px,1.6vw,21px);font-weight:300}

        /* KPIs */
        .daily-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:6px}
        .daily-kpi{display:flex;flex-direction:column;gap:2px;min-width:0;padding:20px 22px 16px;border:1px solid #2d2d34;border-radius:18px;background:rgba(20,20,24,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#f1f1f3;text-decoration:none;box-shadow:0 14px 34px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.04);transition:border-color .2s ease,transform .2s ease}
        .daily-kpi:hover{border-color:#55555f;transform:translateY(-2px)}
        .daily-kpi-icon{display:flex;color:#e6e6ea;margin-bottom:6px}
        .daily-kpi strong{overflow-wrap:anywhere;font-size:clamp(26px,2.6vw,36px);font-weight:700;letter-spacing:-.8px;line-height:1.15}
        .daily-kpi>div{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#b4b4bd}
        .daily-kpi small{font-size:15px;font-weight:400}

        /* Grade */
        .daily-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1.08fr) minmax(0,.9fr);gap:16px;grid-template-areas:"priorities agenda quick" "habits bills tip"}
        .area-priorities{grid-area:priorities}.area-agenda{grid-area:agenda}.area-quick{grid-area:quick}
        .area-habits{grid-area:habits}.area-bills{grid-area:bills}.area-tip{grid-area:tip}
        .daily-card{min-width:0;padding:20px 22px;border:1px solid #2d2d34;border-radius:18px;background:rgba(20,20,24,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 14px 34px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.04)}
        .daily-card>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
        .daily-card h3{display:flex;align-items:center;gap:10px;margin:0;color:#f4f4f6;font-size:17px;font-weight:650;letter-spacing:-.2px}
        .daily-card>header>a{display:inline-flex;align-items:center;gap:5px;flex-shrink:0;color:#c9c9d0;font-size:12px;text-decoration:none;transition:color .18s ease}
        .daily-card>header>a:hover{color:#fff}
        .daily-empty{margin:8px 0;color:#9999a3;font-size:13px;line-height:1.6}
        .daily-empty a{color:#c9c9d0;text-decoration:none}
        .daily-warning{margin:0 0 8px;padding:9px 11px;border:1px solid #654b4b;border-radius:8px;background:#241b1d;color:#dcb5b5;font-size:12px;line-height:1.5}

        /* Prioridades */
        .daily-row{display:flex;align-items:center;gap:14px;padding:11px 2px;border-top:1px solid #2a2a30;color:#ececf0;font-size:16px}
        .daily-row>span{min-width:0;overflow-wrap:anywhere}
        .daily-row .is-overdue{color:#d9b3b3}
        .daily-circle{display:grid;place-items:center;flex-shrink:0;width:26px;height:26px;padding:0;border:2px solid #7b7b86;border-radius:50%;background:transparent;color:#fff;cursor:pointer;transition:border-color .18s ease,background .18s ease}
        .daily-circle:hover:not(:disabled){border-color:#fff}
        .daily-circle:disabled{opacity:.45;cursor:not-allowed}
        .daily-circle.small{width:20px;height:20px;border-width:1.5px}
        .daily-circle.checked{background:#3a3a42;border-color:#5a5a64}
        .daily-add{display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #2a2a30}
        .daily-add input{flex:1;min-width:0;height:36px;padding:0 12px;border:1px solid #3b3b44;border-radius:8px;background:#111114;color:#eeeef1;font-size:13px;outline:none}
        .daily-add input::placeholder{color:#777781}
        .daily-add input:focus{border-color:#85858f}
        .daily-add button{padding:0 14px;border:1px solid #d5d6da;border-radius:8px;background:linear-gradient(180deg,#e0e1e5,#c4c6cc);color:#17171a;font-size:12px;font-weight:700;cursor:pointer}
        .daily-add button:disabled{opacity:.45;cursor:not-allowed}

        /* Agenda */
        .daily-agenda-item{display:flex;align-items:center;gap:14px;padding:11px 2px;color:#ececf0;font-size:16px}
        .daily-agenda-item time{flex-shrink:0;width:48px;color:#c3c3cb;font-size:15px;font-variant-numeric:tabular-nums}
        .daily-agenda-item i{flex-shrink:0;width:2px;height:30px;border-radius:2px;background:#8c8c96}
        .daily-agenda-item span{min-width:0;overflow-wrap:anywhere}
        .daily-agenda-item .is-done{color:#8d8d97;text-decoration:line-through}

        /* Acesso rápido */
        .daily-quick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .daily-quick-grid a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:88px;padding:10px 6px;border:1px solid #2d2d34;border-radius:14px;background:rgba(255,255,255,.035);color:#e6e6ea;font-size:13px;text-decoration:none;transition:border-color .18s ease,background .18s ease}
        .daily-quick-grid a:hover{border-color:#55555f;background:rgba(255,255,255,.07)}

        /* Hábitos */
        .daily-habits{display:flex;align-items:center;gap:22px}
        .daily-ring{position:relative;flex-shrink:0;width:104px;height:104px}
        .daily-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
        .daily-ring circle{fill:none;stroke-width:9}
        .daily-ring .ring-bg{stroke:#3a3a42}
        .daily-ring .ring-fg{stroke:#e1e2e6;stroke-linecap:round;transition:stroke-dashoffset .4s ease}
        .daily-ring>div{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .daily-ring strong{font-size:19px;font-weight:650}
        .daily-ring small{color:#9a9aa4;font-size:10px}
        .daily-habits ul{flex:1;min-width:0;margin:0;padding:0;list-style:none}
        .daily-habits li{display:flex;align-items:center;gap:12px;padding:7px 0;color:#ececf0;font-size:15px}
        .daily-habits li span{min-width:0;overflow-wrap:anywhere}

        /* Contas */
        .daily-bill{display:flex;align-items:center;gap:14px;padding:10px 0}
        .daily-bill-icon{display:grid;place-items:center;flex-shrink:0;width:38px;height:38px;border-radius:50%;background:#2a2a30;color:#e6e6ea}
        .daily-bill>div{display:flex;flex:1;flex-direction:column;gap:3px;min-width:0}
        .daily-bill>div strong{overflow:hidden;color:#f0f0f3;font-size:15px;font-weight:550;text-overflow:ellipsis;white-space:nowrap}
        .daily-bill>div small{color:#92929c;font-size:13px}
        .daily-bill>b{flex-shrink:0;color:#f4f4f6;font-size:15px;font-weight:650}

        /* Dica */
        .area-tip{display:flex;align-items:center;gap:16px;color:#c3c3cb}
        .area-tip .round{width:44px;height:44px}
        .area-tip>div{flex:1;min-width:0}
        .area-tip strong{display:block;color:#f4f4f6;font-size:15px;font-weight:650}
        .area-tip p{margin:5px 0 0;font-size:14px;line-height:1.5}

        .daily-alert{display:flex;flex-direction:column;gap:5px;padding:13px 15px;border:1px solid #704e4e;border-radius:12px;background:#261c1e;color:#e1baba;font-size:13px}

        @media(max-width:1100px){
          .daily-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:"priorities agenda" "habits bills" "quick tip"}
          .daily-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
        @media(max-width:640px){
          .daily-center{gap:14px}
          .daily-center::before{top:-90px;right:-190px;width:430px;opacity:.7}
          .daily-hero{padding:22px 0 4px}
          .daily-kpis{gap:10px}
          .daily-kpi{padding:16px 14px 12px;border-radius:14px}
          .daily-kpi small{font-size:13px}
          .daily-grid{grid-template-columns:minmax(0,1fr);grid-template-areas:"priorities" "agenda" "habits" "bills" "quick" "tip"}
          .daily-card{padding:16px;border-radius:14px}
          .daily-row,.daily-agenda-item{font-size:15px}
          .daily-add input{font-size:16px}
          .daily-habits{gap:16px}
        }
      `}</style>
    </div>
  );
}
