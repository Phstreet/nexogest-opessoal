"use client";

import Link from "next/link";
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

const priorityWeight: Record<string, number> = {
  Urgente: 0,
  Alta: 1,
  Média: 2,
  Baixa: 3,
};

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
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const todaysTasks = props.tasks.filter((task) => task.date === todayKey);
  const completedToday = todaysTasks.filter((task) => task.done);
  const pendingToday = todaysTasks.filter((task) => !task.done).sort((a, b) => {
    const priority = (priorityWeight[a.priority || "Média"] ?? 2) - (priorityWeight[b.priority || "Média"] ?? 2);
    return priority || (a.time || "99:99").localeCompare(b.time || "99:99");
  });
  const overdueTasks = props.tasks.filter((task) => !task.done && Boolean(task.date) && task.date! < todayKey)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const upcomingTasks = props.tasks.filter((task) => !task.done && Boolean(task.date) && task.date! > todayKey && task.date! <= nextWeekKey)
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));
  const activeHabits = props.habits.filter((habit) => habit.active);
  const completedHabits = activeHabits.filter((habit) => habit.completedDates.includes(todayKey));
  const taskRate = todaysTasks.length ? Math.round((completedToday.length / todaysTasks.length) * 100) : 0;
  const habitRate = activeHabits.length ? Math.round((completedHabits.length / activeHabits.length) * 100) : 0;

  const financialItems = props.transactions.filter((item) =>
    (item.type === "Despesa" || item.type === "Receita") &&
    item.status !== "Cancelada" &&
    Boolean(item.date) &&
    item.date! >= todayKey &&
    item.date! <= nextWeekKey &&
    settledAmount(item) < Number(item.amount || 0)
  ).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const overdueFinancial = props.transactions.filter((item) =>
    (item.type === "Despesa" || item.type === "Receita") &&
    item.status !== "Cancelada" &&
    Boolean(item.date) &&
    item.date! < todayKey &&
    settledAmount(item) < Number(item.amount || 0)
  );

  return (
    <div className="daily-center">
      {(props.taskError || props.habitError || props.financeError) && (
        <div className="daily-alert error" role="alert">
          <strong>Alguns dados não puderam ser carregados.</strong>
          <span>{[props.taskError, props.habitError, props.financeError].filter(Boolean).join(" ")}</span>
        </div>
      )}

      <section className="daily-welcome">
        <div>
          <span className="daily-eyebrow">SEU PAINEL DE COMANDO</span>
          <h2>{greeting}, vamos organizar seu dia.</h2>
          <p>{dateLabel}. Aqui estão suas prioridades e os pontos que merecem atenção.</p>
        </div>
        <div className="daily-progress">
          <span>PROGRESSO DE HOJE</span>
          <strong>{taskRate}%</strong>
          <div className="daily-progress-track"><i style={{ width: `${taskRate}%` }} /></div>
          <small>{completedToday.length} de {todaysTasks.length} tarefas concluídas</small>
        </div>
      </section>

      <section className="daily-kpis">
        <article className="daily-kpi">
          <span>Receitas realizadas</span>
          <strong>{props.financeLoaded ? money(props.income) : "Carregando…"}</strong>
          <small>Este mês</small>
        </article>
        <article className="daily-kpi">
          <span>Despesas realizadas</span>
          <strong>{props.financeLoaded ? money(props.expenses) : "Carregando…"}</strong>
          <small>Este mês</small>
        </article>
        <article className="daily-kpi featured">
          <span>Resultado do mês</span>
          <strong>{props.financeLoaded ? money(props.balance) : "Carregando…"}</strong>
          <small>Recebido menos pago e aplicações</small>
        </article>
        <article className="daily-kpi">
          <span>Hábitos de hoje</span>
          <strong>{completedHabits.length}/{activeHabits.length}</strong>
          <small>{habitRate}% realizados</small>
        </article>
      </section>

      <section className="daily-quick panel">
        <div>
          <span className="daily-eyebrow">AÇÃO RÁPIDA</span>
          <h3>O que você precisa resolver hoje?</h3>
        </div>
        <div className="daily-entry">
          <input value={props.taskName} onChange={(event) => props.onTaskNameChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") props.onAddTask(); }}
            placeholder="Digite uma tarefa para hoje…" aria-label="Nova tarefa para hoje" />
          <button type="button" onClick={props.onAddTask} disabled={!props.canSaveTasks}>Adicionar tarefa</button>
        </div>
        <nav className="daily-shortcuts" aria-label="Ações rápidas">
          <Link href="/financeiro">＋ Lançamento financeiro</Link>
          <Link href="/rotina/agenda">＋ Compromisso na agenda</Link>
          <Link href="/rotina/habitos">Ver meus hábitos ↗</Link>
          <Link href="/financeiro/contas-a-pagar">Contas a pagar ↗</Link>
        </nav>
      </section>

      <div className="daily-columns">
        <section className="panel daily-panel">
          <div className="daily-panel-heading">
            <div><span className="daily-eyebrow">FOCO IMEDIATO</span><h3>Prioridades de hoje</h3></div>
            <Link href="/rotina/agenda">Abrir agenda ↗</Link>
          </div>
          {overdueTasks.length > 0 && (
            <div className="daily-priority-group">
              <h4 className="danger-text">Atrasadas ({overdueTasks.length})</h4>
              {overdueTasks.slice(0, 4).map((task) => (
                <div className="daily-task overdue" key={task.id}>
                  <button type="button" disabled={!props.canSaveTasks} onClick={() => props.onToggleTask(task.id)} aria-label={`Concluir ${task.description}`}>○</button>
                  <div><strong>{task.description}</strong><small>{task.date ? new Date(`${task.date}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data"} · {task.priority || "Média"}</small></div>
                </div>
              ))}
            </div>
          )}
          <div className="daily-priority-group">
            <h4>Programadas para hoje ({pendingToday.length})</h4>
            {pendingToday.length ? pendingToday.slice(0, 7).map((task) => (
              <div className="daily-task" key={task.id}>
                <button type="button" disabled={!props.canSaveTasks} onClick={() => props.onToggleTask(task.id)} aria-label={`Concluir ${task.description}`}>○</button>
                <div><strong>{task.description}</strong><small>{task.time ? `${task.time} · ` : ""}{task.priority || "Média"}{task.category ? ` · ${task.category}` : ""}</small></div>
                <span className={`priority-tag priority-${(task.priority || "Média").toLowerCase().replace("é", "e")}`}>{task.priority || "Média"}</span>
              </div>
            )) : <p className="daily-empty">{todaysTasks.length ? "Você concluiu todas as tarefas programadas para hoje." : "Nenhuma tarefa foi programada para hoje."}</p>}
          </div>
          {upcomingTasks.length > 0 && (
            <div className="daily-priority-group">
              <h4>Próximos 7 dias ({upcomingTasks.length})</h4>
              {upcomingTasks.slice(0, 3).map((task) => (
                <div className="daily-task upcoming" key={task.id}>
                  <span className="daily-task-dot" />
                  <div><strong>{task.description}</strong><small>{task.date ? new Date(`${task.date}T12:00:00`).toLocaleDateString("pt-BR") : ""}{task.time ? ` · ${task.time}` : ""}</small></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel daily-panel">
          <div className="daily-panel-heading">
            <div><span className="daily-eyebrow">CONSISTÊNCIA</span><h3>Hábitos de hoje</h3></div>
            <Link href="/rotina/habitos">Gerenciar ↗</Link>
          </div>
          {activeHabits.length ? (
            <>
              <div className="daily-habit-progress"><span>{completedHabits.length} de {activeHabits.length} realizados</span><strong>{habitRate}%</strong></div>
              <div className="daily-progress-track"><i style={{ width: `${habitRate}%` }} /></div>
              {activeHabits.slice(0, 8).map((habit) => {
                const done = habit.completedDates.includes(todayKey);
                return <div className="daily-task" key={habit.id}>
                  <button type="button" disabled={!props.canSaveHabits} onClick={() => props.onToggleHabit(habit.id)} aria-label={done ? `Desmarcar ${habit.name}` : `Concluir ${habit.name}`}>{done ? "✓" : "○"}</button>
                  <div><strong className={done ? "is-done" : ""}>{habit.name}</strong><small>{habit.time || habit.category}</small></div>
                </div>;
              })}
            </>
          ) : <p className="daily-empty">Você ainda não cadastrou hábitos. <Link href="/rotina/habitos">Criar um hábito ↗</Link></p>}
          <div className="daily-finance-attention">
            <div className="daily-panel-heading">
              <div><span className="daily-eyebrow">ATENÇÃO FINANCEIRA</span><h3>Próximos compromissos</h3></div>
              <Link href="/financeiro/contas-a-pagar">Ver contas ↗</Link>
            </div>
            {!props.financeLoaded ? <p className="daily-empty">Carregando informações financeiras…</p> :
              overdueFinancial.length || financialItems.length ? (
                <>
                  {overdueFinancial.length > 0 && <p className="daily-finance-warning">{overdueFinancial.length} lançamento(s) financeiro(s) com data anterior e valor ainda pendente.</p>}
                  {financialItems.slice(0, 4).map((item) => (
                    <div className="daily-finance-item" key={`${item.type}-${item.id}`}>
                      <div><strong>{item.description}</strong><small>{item.type} · {new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}</small></div>
                      <strong>{money(Math.max(0, Number(item.amount || 0) - settledAmount(item)))}</strong>
                    </div>
                  ))}
                </>
              ) : <p className="daily-empty">Nenhum lançamento pendente com vencimento nos próximos 7 dias.</p>}
          </div>
        </section>
      </div>

      <section className="daily-close panel">
        <div><span className="daily-eyebrow">ENCERRAMENTO</span><h3>Prepare o próximo passo</h3><p>Revise suas pendências e organize o que precisa continuar amanhã.</p></div>
        <div className="daily-close-actions"><span>{overdueTasks.length} atrasadas</span><span>{pendingToday.length} pendentes hoje</span><span>{upcomingTasks.length} nos próximos 7 dias</span><Link href="/rotina/agenda">Revisar planejamento ↗</Link></div>
      </section>

      <style jsx>{`
        .daily-center{display:flex;flex-direction:column;gap:16px;min-width:0;padding-bottom:24px}
        .daily-welcome{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:25px 27px;border:1px solid #303036;border-radius:12px;background:linear-gradient(115deg,#202024,#151518 70%,#101012)}
        .daily-eyebrow{display:block;color:#92929d;font-size:9px;font-weight:750;letter-spacing:1.5px}
        .daily-welcome h2{margin:9px 0 6px;color:#f2f2f4;font-size:clamp(20px,2.5vw,29px);letter-spacing:-.8px}
        .daily-welcome p{margin:0;color:#9999a3;font-size:11px;line-height:1.6;text-transform:capitalize}
        .daily-progress{width:min(245px,32%);padding:14px;border:1px solid #34343b;border-radius:9px;background:#17171a}
        .daily-progress>span{color:#9999a3;font-size:8px;letter-spacing:1px}
        .daily-progress>strong{display:block;margin:4px 0;font-size:25px}
        .daily-progress small{display:block;margin-top:7px;color:#92929c;font-size:9px}
        .daily-progress-track{height:6px;overflow:hidden;border-radius:10px;background:#34343b}
        .daily-progress-track i{display:block;height:100%;border-radius:10px;background:#bfc4cc}
        .daily-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
        .daily-kpi{display:flex;flex-direction:column;gap:7px;min-width:0;padding:15px;border:1px solid #2e2e34;border-radius:9px;background:#18181b}
        .daily-kpi span{color:#a4a4ad;font-size:10px}
        .daily-kpi strong{overflow-wrap:anywhere;color:#f1f1f3;font-size:clamp(16px,2vw,21px)}
        .daily-kpi small{color:#85858f;font-size:9px}
        .daily-kpi.featured{background:#202126;border-color:#45464d}
        .panel{padding:17px;border:1px solid #303036;border-radius:10px;background:#171719}
        .daily-quick{display:flex;flex-direction:column;gap:12px}
        .daily-quick h3,.daily-panel h3,.daily-close h3{margin:5px 0 0;color:#eee;font-size:14px}
        .daily-entry{display:flex;gap:9px}
        .daily-entry input{flex:1;min-width:0;height:38px;padding:0 12px;border:1px solid #3a3a42;border-radius:6px;background:#101012;color:#eee;font-size:11px}
        .daily-entry button{padding:0 16px;border:1px solid #c3c6ce;border-radius:6px;background:#c3c6ce;color:#151518;font-size:10px;font-weight:700;cursor:pointer}
        .daily-entry button:disabled,.daily-task button:disabled{opacity:.45;cursor:not-allowed}
        .daily-shortcuts{display:flex;flex-wrap:wrap;gap:13px}
        .daily-shortcuts a,.daily-panel-heading>a,.daily-empty a{color:#b9bbc2;font-size:9px;text-decoration:none}
        .daily-shortcuts a:hover,.daily-panel-heading>a:hover{color:#fff;text-decoration:underline}
        .daily-columns{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:14px;align-items:start}
        .daily-panel{min-width:0}
        .daily-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:15px}
        .daily-priority-group{margin-top:13px}
        .daily-priority-group h4{margin:0 0 7px;color:#c7c7ce;font-size:10px;font-weight:650}
        .daily-task{display:flex;align-items:center;gap:10px;min-width:0;padding:9px 0;border-bottom:1px solid #29292e}
        .daily-task:last-child{border-bottom:0}
        .daily-task>button{display:grid;place-items:center;flex-shrink:0;width:24px;height:24px;border:1px solid #45454d;border-radius:50%;background:transparent;color:#d5d5db;cursor:pointer}
        .daily-task>div{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0}
        .daily-task>div strong{overflow:hidden;color:#e4e4e8;font-size:10px;text-overflow:ellipsis}
        .daily-task>div small{color:#85858f;font-size:9px}
        .daily-task.overdue>div strong{color:#e4b1b1}
        .daily-task .is-done{color:#8dba9b;text-decoration:line-through}
        .daily-task-dot{width:7px;height:7px;flex-shrink:0;border-radius:50%;background:#a6a6ae}
        .priority-tag{padding:4px 6px;border:1px solid #3c3c43;border-radius:5px;color:#aaa;font-size:8px}
        .priority-urgente,.priority-alta{border-color:#765151;color:#e0a0a0}
        .priority-baixa{color:#92929c}
        .danger-text{color:#dfa0a0!important}
        .daily-empty{margin:8px 0;color:#92929c;font-size:10px;line-height:1.6}
        .daily-habit-progress{display:flex;justify-content:space-between;margin:0 0 7px;color:#a4a4ad;font-size:9px}
        .daily-habit-progress strong{color:#eee}
        .daily-finance-attention{margin-top:22px;padding-top:16px;border-top:1px solid #303036}
        .daily-finance-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #29292e}
        .daily-finance-item>div{display:flex;flex-direction:column;gap:4px;min-width:0}
        .daily-finance-item>div strong{overflow:hidden;color:#ddd;font-size:10px;text-overflow:ellipsis}
        .daily-finance-item small{color:#888;font-size:9px}
        .daily-finance-item>strong{flex-shrink:0;color:#ddd;font-size:10px}
        .daily-finance-warning{padding:8px;border:1px solid #654747;border-radius:6px;background:#24191b;color:#e2aaaa;font-size:9px;line-height:1.5}
        .daily-close{display:flex;align-items:center;justify-content:space-between;gap:15px}
        .daily-close p{margin:6px 0 0;color:#92929c;font-size:10px}
        .daily-close-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px}
        .daily-close-actions span,.daily-close-actions a{padding:7px 9px;border:1px solid #37373d;border-radius:6px;color:#bdbdc5;font-size:9px;text-decoration:none}
        .daily-alert{display:flex;flex-direction:column;gap:5px;padding:11px 13px;border:1px solid #704b4b;border-radius:7px;background:#25191b;color:#e5b4b4;font-size:10px}
        @media(max-width:900px){
          .daily-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
          .daily-columns{grid-template-columns:minmax(0,1fr)}
          .daily-welcome{gap:16px}
        }
        @media(max-width:600px){
          .daily-center{gap:12px;padding-bottom:18px}
          .daily-welcome,.daily-close{align-items:stretch;flex-direction:column}
          .daily-welcome{gap:15px;padding:18px 16px;border-radius:10px}
          .daily-eyebrow{font-size:8px;letter-spacing:1.2px}
          .daily-welcome h2{margin:7px 0 6px;font-size:23px;line-height:1.18;letter-spacing:-.5px}
          .daily-welcome p{font-size:11px;line-height:1.55}
          .daily-progress{display:grid;grid-template-columns:1fr auto;align-items:center;gap:5px 12px;width:100%;padding:11px 12px;box-sizing:border-box}
          .daily-progress>span{align-self:end}
          .daily-progress>strong{grid-column:2;grid-row:1 / span 2;margin:0;font-size:23px}
          .daily-progress-track{grid-column:1;grid-row:2}
          .daily-progress small{grid-column:1 / -1;margin-top:3px;font-size:10px}
          .daily-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
          .daily-kpi{min-height:91px;justify-content:space-between;gap:6px;padding:12px 11px;border-radius:9px}
          .daily-kpi span{font-size:10px;line-height:1.3}
          .daily-kpi strong{font-size:clamp(15px,4.3vw,19px);line-height:1.2;overflow-wrap:anywhere}
          .daily-kpi small{font-size:9px;line-height:1.35}
          .panel{padding:14px;border-radius:10px}
          .daily-quick{gap:12px}
          .daily-quick h3,.daily-panel h3,.daily-close h3{font-size:14px;line-height:1.35}
          .daily-entry{flex-direction:column;gap:8px}
          .daily-entry input{height:44px;padding:0 12px;font-size:16px}
          .daily-entry button{min-height:44px;padding:0 14px;font-size:11px}
          .daily-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
          .daily-shortcuts a{display:flex;align-items:center;min-height:40px;padding:8px 9px;border:1px solid #34343b;border-radius:7px;background:#141416;font-size:10px;line-height:1.35}
          .daily-panel-heading{align-items:flex-start;gap:8px;margin-bottom:12px}
          .daily-panel-heading>a{flex-shrink:0;padding-top:2px;font-size:9px}
          .daily-priority-group{margin-top:12px}
          .daily-priority-group h4{font-size:11px;line-height:1.4}
          .daily-task{gap:9px;padding:11px 0}
          .daily-task>button{width:30px;height:30px;font-size:14px}
          .daily-task>div strong{font-size:12px;line-height:1.35;white-space:normal;overflow-wrap:anywhere}
          .daily-task>div small{font-size:10px;line-height:1.35}
          .priority-tag{flex-shrink:0;font-size:9px}
          .daily-empty{font-size:11px}
          .daily-habit-progress{font-size:10px}
          .daily-finance-attention{margin-top:18px;padding-top:14px}
          .daily-finance-item{align-items:flex-start;gap:8px;padding:10px 0}
          .daily-finance-item>div strong{font-size:11px;white-space:normal;overflow-wrap:anywhere}
          .daily-finance-item small,.daily-finance-item>strong{font-size:10px}
          .daily-finance-warning{font-size:10px}
          .daily-close{gap:12px}
          .daily-close p{font-size:11px;line-height:1.5}
          .daily-close-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
          .daily-close-actions span,.daily-close-actions a{display:flex;align-items:center;justify-content:center;min-height:36px;padding:7px 8px;text-align:center;font-size:9px;line-height:1.3}
          .daily-alert{font-size:11px;line-height:1.45}
        }
        @media(max-width:380px){
          .daily-welcome{padding:16px 14px}
          .daily-welcome h2{font-size:21px}
          .daily-kpis{gap:7px}
          .daily-kpi{padding:10px 9px}
          .daily-kpi span{font-size:9px}
          .daily-kpi strong{font-size:15px}
          .daily-shortcuts{grid-template-columns:1fr}
          .daily-close-actions{grid-template-columns:1fr 1fr}
          .daily-panel-heading{flex-wrap:wrap}
        }
      `}</style>
    </div>
  );
}
