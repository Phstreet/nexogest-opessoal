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
        /* Lua realista: ESO/NASA/M. Kornmesser — CC BY 4.0
           https://www.eso.org/public/images/eso1210d */
        .daily-center::before{content:none}
        .daily-center::after{content:"";position:absolute;z-index:0;inset:-35px -12px auto;height:560px;pointer-events:none;opacity:.24;background-image:radial-gradient(1px 1px at 8% 18%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 22% 9%,#dfe2ea 99%,transparent),radial-gradient(1.5px 1.5px at 49% 15%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 76% 11%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 92% 34%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 61% 43%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 13% 57%,#dfe2ea 99%,transparent),radial-gradient(1px 1px at 84% 71%,#dfe2ea 99%,transparent);background-size:100% 100%;mask-image:linear-gradient(to bottom,#000,transparent)}
        .daily-center>*{position:relative;z-index:1}

        .daily-center{position:relative;isolation:isolate;display:flex;flex-direction:column;gap:18px;min-width:0;padding:4px 0 26px;color:#f1f1f3;overflow:hidden}
        .daily-welcome{position:relative;isolation:isolate;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:28px;padding:30px 32px;border:1px solid #36363e;border-radius:16px;background:linear-gradient(135deg,#222227 0%,#19191e 58%,#151519 100%);box-shadow:0 18px 42px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.045)}
        .daily-welcome::before{content:"";position:absolute;z-index:0;pointer-events:none;top:-155px;right:-88px;width:min(500px,58%);aspect-ratio:1;border-radius:50%;background-image:linear-gradient(90deg,rgba(20,20,24,.04),rgba(20,20,24,.2)),url("https://upload.wikimedia.org/wikipedia/commons/0/0a/Artists%E2%80%99s_impression_of_the_Moon_showing_earthshine_%28eso1210d%29.jpg");background-size:cover;background-position:center;opacity:.58;filter:grayscale(1) contrast(1.1) brightness(.9);-webkit-mask-image:radial-gradient(circle at 48% 48%,#000 0 57%,rgba(0,0,0,.82) 67%,transparent 80%);mask-image:radial-gradient(circle at 48% 48%,#000 0 57%,rgba(0,0,0,.82) 67%,transparent 80%)}
        .daily-welcome>div{position:relative;z-index:1}
        .daily-eyebrow{display:block;color:#a5a5af;font-size:9px;font-weight:750;letter-spacing:1.65px}
        .daily-welcome h2{margin:11px 0 7px;color:#f5f5f7;font-size:clamp(22px,2.6vw,31px);font-weight:650;letter-spacing:-1.05px;line-height:1.16}
        .daily-welcome p{margin:0;color:#a4a4ad;font-size:12px;line-height:1.65;text-transform:capitalize}
        .daily-progress{width:min(250px,32%);flex-shrink:0;padding:17px 18px;border:1px solid #414149;border-radius:12px;background:linear-gradient(145deg,rgba(12,12,15,.82),rgba(23,23,27,.9));box-shadow:0 8px 24px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.035)}
        .daily-progress>span{color:#a5a5af;font-size:8px;font-weight:700;letter-spacing:1.2px}
        .daily-progress>strong{display:block;margin:6px 0 8px;color:#f4f4f6;font-size:28px;font-weight:650;letter-spacing:-1px}
        .daily-progress small{display:block;margin-top:9px;color:#92929c;font-size:10px}
        .daily-progress-track{height:5px;overflow:hidden;border-radius:10px;background:#34343c}
        .daily-progress-track i{display:block;height:100%;border-radius:10px;background:linear-gradient(90deg,#92939b,#e1e2e6);transition:width .3s ease}
        .daily-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .daily-kpi{display:flex;flex-direction:column;gap:9px;min-width:0;padding:19px 18px;border:1px solid var(--line);border-radius:13px;background:linear-gradient(150deg,#202025 0%,#18181c 82%);box-shadow:0 10px 25px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.025);transition:border-color .2s ease,transform .2s ease,background .2s ease}
        .daily-kpi span{color:#aaaab3;font-size:11px;font-weight:500}
        .daily-kpi strong{overflow-wrap:anywhere;color:#f1f1f3;font-size:clamp(17px,2vw,23px);font-weight:650;letter-spacing:-.55px}
        .daily-kpi small{color:#85858f;font-size:10px}
        .daily-kpi.featured{border-color:#4a4a53;background:linear-gradient(145deg,#292930,#1b1b20);box-shadow:0 12px 28px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.04)}
        .panel{padding:22px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(150deg,#1d1d22 0%,#17171b 100%);box-shadow:0 12px 30px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.025)}
        .daily-quick{display:flex;flex-direction:column;gap:15px}
        .daily-quick h3,.daily-panel h3,.daily-close h3{margin:6px 0 0;color:#f0f0f2;font-size:15px;font-weight:620;letter-spacing:-.25px}
        .daily-entry{display:flex;gap:10px}
        .daily-entry input{flex:1;min-width:0;height:44px;padding:0 14px;border:1px solid #3b3b44;border-radius:8px;background:#111114;color:#eeeef1;font-size:12px;outline:none;transition:border-color .2s ease,box-shadow .2s ease}
        .daily-entry input::placeholder{color:#777781}
        .daily-entry button{padding:0 19px;border:1px solid #d5d6da;border-radius:8px;background:linear-gradient(180deg,#e0e1e5,#c4c6cc);color:#17171a;font-size:11px;font-weight:750;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.16);transition:filter .2s ease,transform .2s ease}
        .daily-entry button:disabled,.daily-task button:disabled{opacity:.45;cursor:not-allowed}
        .daily-shortcuts{display:flex;flex-wrap:wrap;gap:9px}
        .daily-shortcuts a,.daily-panel-heading>a,.daily-empty a{color:#bfc0c7;font-size:10px;text-decoration:none}
        .daily-shortcuts a{padding:8px 10px;border:1px solid #35353d;border-radius:7px;background:rgba(255,255,255,.018);transition:color .18s ease,border-color .18s ease,background .18s ease}
        .daily-shortcuts a:hover,.daily-panel-heading>a:hover{color:#fff;border-color:#62626c}
        .daily-columns{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:15px;align-items:start}
        .daily-panel{min-width:0}
        .daily-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px;padding-bottom:13px;border-bottom:1px solid #303037}
        .daily-panel-heading>a{flex-shrink:0;font-size:10px}
        .daily-priority-group{margin-top:16px}
        .daily-priority-group h4{margin:0 0 8px;color:#c9c9cf;font-size:11px;font-weight:650}
        .daily-task{display:flex;align-items:center;gap:11px;min-width:0;padding:11px 2px;border-bottom:1px solid #2a2a30;transition:background .18s ease}
        .daily-task:last-child{border-bottom:0}
        .daily-task>button{display:grid;place-items:center;flex-shrink:0;width:27px;height:27px;border:1px solid #4a4a54;border-radius:50%;background:#202025;color:#d8d8de;font-size:12px;cursor:pointer;transition:border-color .18s ease,background .18s ease,color .18s ease}
        .daily-task>div{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0}
        .daily-task>div strong{overflow:hidden;color:#e7e7eb;font-size:11px;font-weight:550;text-overflow:ellipsis}
        .daily-task>div small{color:#92929c;font-size:10px}
        .daily-task.overdue>div strong{color:#d9b3b3}
        .daily-task .is-done{color:#aeb8b0;text-decoration:line-through}
        .daily-task-dot{width:7px;height:7px;flex-shrink:0;border-radius:50%;background:#b4b5bd}
        .priority-tag{padding:5px 8px;border:1px solid #42424a;border-radius:6px;color:#b9b9c1;font-size:9px}
        .priority-urgente,.priority-alta{border-color:#765454;color:#d7aaaa}
        .priority-baixa{color:#92929c}
        .danger-text{color:#d9aaaa!important}
        .daily-empty{margin:10px 0;color:#9999a3;font-size:11px;line-height:1.65}
        .daily-habit-progress{display:flex;justify-content:space-between;margin:0 0 9px;color:#aaaab3;font-size:10px}
        .daily-habit-progress strong{color:#eeeef0}
        .daily-finance-attention{margin-top:24px;padding-top:19px;border-top:1px solid #35353c}
        .daily-finance-attention .daily-panel-heading{border-bottom:0;padding-bottom:0;margin-bottom:10px}
        .daily-finance-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid #2a2a30}
        .daily-finance-item>div{display:flex;flex-direction:column;gap:5px;min-width:0}
        .daily-finance-item>div strong{overflow:hidden;color:#e3e3e7;font-size:11px;font-weight:550;text-overflow:ellipsis}
        .daily-finance-item small{color:#92929c;font-size:10px}
        .daily-finance-item>strong{flex-shrink:0;color:#e4e4e8;font-size:11px;font-weight:650}
        .daily-finance-warning{padding:10px 11px;border:1px solid #654b4b;border-radius:8px;background:#241b1d;color:#dcb5b5;font-size:10px;line-height:1.55}
        .daily-close{display:flex;align-items:center;justify-content:space-between;gap:18px;background:linear-gradient(115deg,#202025,#17171b)}
        .daily-close p{margin:7px 0 0;color:#9999a3;font-size:11px;line-height:1.55}
        .daily-close-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
        .daily-close-actions span,.daily-close-actions a{padding:8px 10px;border:1px solid #3a3a42;border-radius:7px;background:rgba(255,255,255,.018);color:#c4c4cb;font-size:10px;text-decoration:none}
        .daily-close-actions a{border-color:#777780;color:#ededf0}
        .daily-alert{display:flex;flex-direction:column;gap:5px;padding:13px 15px;border:1px solid #704e4e;border-radius:9px;background:#261c1e;color:#e1baba;font-size:11px}
        .daily-kpi:hover{border-color:#50505a;transform:translateY(-2px)}
        .daily-entry input:focus{border-color:#85858f;box-shadow:0 0 0 3px rgba(205,205,215,.08)}
        .daily-entry button:hover:not(:disabled){filter:brightness(1.06);transform:translateY(-1px)}
        .daily-task>button:hover:not(:disabled){border-color:#b8b9c1;background:#303037;color:#fff}
        @media(max-width:900px){
          .daily-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
          .daily-columns{grid-template-columns:minmax(0,1fr)}
          .daily-welcome{gap:18px}
        }
        @media(max-width:600px){
          .daily-center{gap:13px;padding:0 0 20px}.daily-center::after{height:390px;opacity:.18}.daily-welcome::before{top:-88px;right:-105px;width:330px;opacity:.48}
          .daily-welcome,.daily-close{align-items:stretch;flex-direction:column}
          .daily-welcome{gap:16px;padding:21px 18px;border-radius:12px}
          .daily-eyebrow{font-size:8px;letter-spacing:1.3px}
          .daily-welcome h2{margin:8px 0 6px;font-size:24px;line-height:1.2;letter-spacing:-.65px}
          .daily-welcome p{font-size:11px;line-height:1.6}
          .daily-progress{display:grid;grid-template-columns:1fr auto;align-items:center;gap:5px 12px;width:100%;padding:12px 14px;box-sizing:border-box}
          .daily-progress>span{align-self:end}
          .daily-progress>strong{grid-column:2;grid-row:1 / span 2;margin:0;font-size:24px}
          .daily-progress-track{grid-column:1;grid-row:2}
          .daily-progress small{grid-column:1 / -1;margin-top:4px;font-size:10px}
          .daily-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
          .daily-kpi{min-height:96px;justify-content:space-between;gap:7px;padding:14px 12px;border-radius:10px}
          .daily-kpi span{font-size:10px;line-height:1.35}
          .daily-kpi strong{font-size:clamp(16px,4.4vw,20px);line-height:1.2;overflow-wrap:anywhere}
          .daily-kpi small{font-size:9px;line-height:1.4}
          .panel{padding:16px;border-radius:11px}
          .daily-quick{gap:13px}
          .daily-quick h3,.daily-panel h3,.daily-close h3{font-size:14px;line-height:1.4}
          .daily-entry{flex-direction:column;gap:9px}
          .daily-entry input{height:45px;padding:0 13px;font-size:16px}
          .daily-entry button{min-height:44px;padding:0 15px;font-size:11px}
          .daily-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
          .daily-shortcuts a{display:flex;align-items:center;min-height:42px;padding:8px 9px;font-size:10px;line-height:1.4}
          .daily-panel-heading{align-items:flex-start;gap:9px;margin-bottom:13px;padding-bottom:11px}
          .daily-panel-heading>a{padding-top:2px;font-size:9px}
          .daily-priority-group{margin-top:14px}
          .daily-priority-group h4{font-size:11px;line-height:1.4}
          .daily-task{gap:9px;padding:11px 0}
          .daily-task>button{width:30px;height:30px;font-size:14px}
          .daily-task>div strong{font-size:12px;line-height:1.4;white-space:normal;overflow-wrap:anywhere}
          .daily-task>div small{font-size:10px;line-height:1.4}
          .priority-tag{flex-shrink:0;font-size:9px}
          .daily-empty{font-size:11px}
          .daily-habit-progress{font-size:10px}
          .daily-finance-attention{margin-top:19px;padding-top:15px}
          .daily-finance-item{align-items:flex-start;gap:8px;padding:10px 0}
          .daily-finance-item>div strong{font-size:11px;white-space:normal;overflow-wrap:anywhere}
          .daily-finance-item small,.daily-finance-item>strong{font-size:10px}
          .daily-finance-warning{font-size:10px}
          .daily-close{gap:13px}
          .daily-close p{font-size:11px;line-height:1.55}
          .daily-close-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
          .daily-close-actions span,.daily-close-actions a{display:flex;align-items:center;justify-content:center;min-height:38px;padding:7px 8px;text-align:center;font-size:9px;line-height:1.35}
          .daily-alert{font-size:11px;line-height:1.5}
        }
        @media(max-width:380px){
          .daily-welcome{padding:18px 15px}
          .daily-welcome h2{font-size:22px}
          .daily-kpis{gap:8px}
          .daily-kpi{padding:12px 10px}
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
