"use client";

import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { useFinanceDashboard } from "@/app/hooks/finance/useFinanceDashboard";
import { useRoutineCollection } from "@/hooks/useRoutineCollection";
import {
  isValidRoutineTask,
  isValidRoutineHabit,
  type RoutineTask,
  type RoutineHabit,
} from "@/lib/routine/types";

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function RelatoriosPage() {
  const finance = useFinanceDashboard();
  const { items: tasks } = useRoutineCollection<RoutineTask>("nexo_tasks", isValidRoutineTask);
  const { items: habits } = useRoutineCollection<RoutineHabit>("nexo_habits", isValidRoutineHabit);

  const completedTasks = tasks.filter((task) => task.done).length;
  const taskRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const activeHabits = habits.filter((habit) => habit.active);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const completedHabits = activeHabits.filter((habit) => habit.completedDates.includes(todayKey)).length;
  const habitRate = activeHabits.length ? Math.round((completedHabits / activeHabits.length) * 100) : 0;

  const reports = [
    {
      title: "Desempenho semanal",
      description: "Acompanhe tarefas, hábitos e consistência da sua rotina.",
      href: "/rotina/produtividade",
      icon: "◷",
      value: "Abrir",
      caption: "Indicadores dos últimos 7 dias",
    },
    {
      title: "Evolução financeira",
      description: "Analise receitas, despesas, saldos e indicadores financeiros.",
      href: "/financeiro/dashboard",
      icon: "▥",
      value: money(finance.currentBalance),
      caption: "Resultado realizado no mês",
    },
    {
      title: "Evolução dos hábitos",
      description: "Consulte frequência e histórico dos hábitos acompanhados.",
      href: "/rotina/habitos",
      icon: "↻",
      value: `${habitRate}%`,
      caption: "Hábitos concluídos hoje",
    },
    {
      title: "Histórico de resultados",
      description: "Consulte suas movimentações e registros anteriores.",
      href: "/financeiro/historico",
      icon: "▤",
      value: "Histórico",
      caption: "Movimentações financeiras anteriores",
    },
  ];

  return (
    <AppLayout>
      <div className="content reports-page">
        <header className="page-heading">
          <div>
            <div className="eyebrow">ACOMPANHAMENTO / INDICADORES</div>
            <h1>Relatórios</h1>
            <p>Consulte os resultados financeiros e a evolução da sua rotina.</p>
          </div>
        </header>

        <section className="metrics-grid">
          <article className="metric-card">
            <div className="metric-top"><span>Receitas realizadas</span><span className="metric-icon">↗</span></div>
            <div className="metric-value">{money(finance.currentConfirmedRevenue)}</div>
            <div className="metric-caption">No mês atual</div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Despesas realizadas</span><span className="metric-icon">↙</span></div>
            <div className="metric-value">{money(finance.currentConfirmedExpenses)}</div>
            <div className="metric-caption">No mês atual</div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Tarefas concluídas</span><span className="metric-icon">✓</span></div>
            <div className="metric-value">{completedTasks}<small> / {tasks.length}</small></div>
            <div className="metric-caption">Taxa geral: {taskRate}%</div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Hábitos de hoje</span><span className="metric-icon">↻</span></div>
            <div className="metric-value">{completedHabits}<small> / {activeHabits.length}</small></div>
            <div className="metric-caption">Concluídos hoje</div>
          </article>
        </section>

        <div className="section-heading">
          <div><div className="section-kicker">ANÁLISES DISPONÍVEIS</div><h2>Explorar relatórios</h2></div>
        </div>
        <section className="report-grid">
          {reports.map((item) => (
            <Link href={item.href} className="report-card" key={item.title}>
              <div className="report-card-top"><span className="report-icon">{item.icon}</span><span>↗</span></div>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <strong>{item.value}</strong>
              <small>{item.caption}</small>
              <span className="report-open">Abrir relatório →</span>
            </Link>
          ))}
        </section>
      </div>
      <style jsx>{`
        .reports-page { max-width:1500px; margin:0 auto; padding-bottom:40px; }
        .report-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
        .report-card { display:flex; min-width:0; flex-direction:column; padding:20px; border:1px solid #303030; border-radius:10px; background:#171717; color:#eee; text-decoration:none; transition:border-color .2s,transform .2s; }
        .report-card:hover { border-color:#777; transform:translateY(-2px); }
        .report-card-top { display:flex; justify-content:space-between; color:#888; font-size:17px; }
        .report-icon { color:#ddd; font-size:20px; }
        .report-card h2 { margin:18px 0 7px; font-size:15px; }
        .report-card p { min-height:38px; margin:0 0 16px; color:#929292; font-size:11px; line-height:1.6; }
        .report-card strong { font-size:23px; font-weight:650; }
        .report-card small { margin-top:4px; color:#858585; font-size:10px; }
        .report-open { margin-top:18px; padding-top:12px; border-top:1px solid #303030; color:#ccc; font-size:10px; }
        @media(max-width:700px) { .report-grid { grid-template-columns:1fr; } }
      `}</style>
    </AppLayout>
  );
}
