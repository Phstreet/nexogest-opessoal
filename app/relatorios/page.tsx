"use client";

import { progressWidthClass, progressHeightClass } from "@/lib/ui/progress-class";

import { useMemo, useState } from "react";
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
import type { Transaction } from "@/lib/finance/types";
import { addMoney, sumMoney } from "@/lib/finance/money";
import { getSaoPauloCalendarDate, getSaoPauloDateKey } from "@/lib/date/sao-paulo";

type Period = "week" | "month" | "quarter" | "semester" | "year";

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function settledAmount(transaction: Transaction) {
  const amount = Math.max(0, Number(transaction.amount) || 0);
  if (transaction.status === "Cancelada") return 0;
  if (typeof transaction.settledAmount === "number") {
    return Math.min(amount, Math.max(0, transaction.settledAmount));
  }
  const status = (transaction.status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ["pago", "paga", "recebida", "recebido", "aplicado", "aplicada", "realizada", "concluida"].includes(status)
    ? amount
    : 0;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export default function RelatoriosPage() {
  const finance = useFinanceDashboard();
  const tasksCollection = useRoutineCollection<RoutineTask>("nexo_tasks", isValidRoutineTask);
  const habitsCollection = useRoutineCollection<RoutineHabit>("nexo_habits", isValidRoutineHabit);
  const [period, setPeriod] = useState<Period>("quarter");

  const tasks = tasksCollection.items;
  const habits = habitsCollection.items;
  const todayKey = getSaoPauloDateKey();
  const startDate = getSaoPauloCalendarDate();
  if (period === "week") {
    const daysSinceMonday = (startDate.getDay() + 6) % 7;
    startDate.setDate(startDate.getDate() - daysSinceMonday);
  } else if (period === "month") {
    startDate.setDate(1);
  } else if (period === "quarter") {
    startDate.setMonth(Math.floor(startDate.getMonth() / 3) * 3, 1);
  } else if (period === "semester") {
    startDate.setMonth(startDate.getMonth() < 6 ? 0 : 6, 1);
  } else {
    startDate.setMonth(0, 1);
  }
  const startKey = dateKey(startDate);
  const periodLength = Math.floor(
    (new Date(`${todayKey}T12:00:00`).getTime() - new Date(`${startKey}T12:00:00`).getTime()) / 86400000
  ) + 1;

  const periodTransactions = useMemo(() => finance.transactions.filter((item) =>
    item.status !== "Cancelada" && Boolean(item.date) && item.date! >= startKey && item.date! <= todayKey
  ), [finance.transactions, startKey, todayKey]);

  const totals = useMemo(() => {
    const revenue = sumMoney(periodTransactions.filter((item) => item.type === "Receita").map(settledAmount));
    const expenses = sumMoney(periodTransactions.filter((item) => item.type === "Despesa").map(settledAmount));
    const investments = sumMoney(periodTransactions.filter((item) => item.type === "Investimento" || item.type === "Aplicação").map(settledAmount));
    const reserves = sumMoney(periodTransactions.filter((item) => item.type === "Reserva").map(settledAmount));
    const result = sumMoney([revenue, -expenses, -investments, -reserves]);
    return {
      revenue,
      expenses,
      investments,
      reserves,
      result,
      savingsRate: revenue > 0 ? (result / revenue) * 100 : null,
      commitmentRate: revenue > 0 ? (expenses / revenue) * 100 : null,
    };
  }, [periodTransactions]);

  const previousPeriod = useMemo(() => {
    const previousEnd = new Date(`${startKey}T12:00:00`);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - periodLength + 1);
    const from = dateKey(previousStart);
    const to = dateKey(previousEnd);
    return finance.transactions.filter((item) =>
      item.status !== "Cancelada" && Boolean(item.date) && item.date! >= from && item.date! <= to && item.type === "Despesa"
    ).reduce((sum, item) => addMoney(sum, settledAmount(item)), 0);
  }, [finance.transactions, startKey, periodLength]);

  const taskCompleted = tasks.filter((task) => task.done).length;
  const taskRate = tasks.length ? Math.round((taskCompleted / tasks.length) * 100) : null;
  const activeHabits = habits.filter((habit) => habit.active);
  const habitCheckIns = activeHabits.reduce((sum, habit) =>
    sum + habit.completedDates.filter((date) => date >= startKey && date <= todayKey).length, 0
  );

  const categoryTotals = useMemo(() => {
    const totalsByCategory = new Map<string, number>();
    periodTransactions.filter((item) => item.type === "Despesa").forEach((item) => {
      const category = item.category || "Sem categoria";
      totalsByCategory.set(category, addMoney(totalsByCategory.get(category) || 0, settledAmount(item)));
    });
    return Array.from(totalsByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTransactions]);

  const pendingOverdue = finance.transactions.filter((item) =>
    (item.type === "Despesa" || item.type === "Receita") &&
    item.status !== "Cancelada" &&
    Boolean(item.date) &&
    item.date! < todayKey &&
    settledAmount(item) < Number(item.amount || 0)
  );

  const chartBuckets = useMemo(() => {
    const buckets: { key: string; label: string; start: string; end: string; revenue: number; expenses: number }[] = [];
    const rangeStart = new Date(`${startKey}T12:00:00`);
    const rangeEnd = new Date(`${todayKey}T12:00:00`);

    if (period === "week") {
      for (let offset = 0; offset < 7; offset += 1) {
        const date = new Date(rangeStart);
        date.setDate(date.getDate() + offset);
        const key = dateKey(date);
        if (key > todayKey) break;
        buckets.push({
          key,
          label: date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }).replace(".", ""),
          start: key,
          end: key,
          revenue: 0,
          expenses: 0,
        });
      }
    } else if (period === "month") {
      for (let week = 0; week < 5; week += 1) {
        const from = new Date(rangeStart);
        from.setDate(1 + week * 7);
        if (from > rangeEnd) break;
        const to = new Date(from);
        to.setDate(to.getDate() + 6);
        if (to > rangeEnd) to.setTime(rangeEnd.getTime());
        buckets.push({
          key: `week-${week + 1}`,
          label: `${week + 1}ª sem.`,
          start: dateKey(from),
          end: dateKey(to),
          revenue: 0,
          expenses: 0,
        });
      }
    } else {
      const monthCount = period === "quarter" ? 3 : period === "semester" ? 6 : 12;
      for (let offset = 0; offset < monthCount; offset += 1) {
        const from = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + offset, 1, 12);
        if (from > rangeEnd) break;
        const to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 12);
        if (to > rangeEnd) to.setTime(rangeEnd.getTime());
        const key = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
        buckets.push({
          key,
          label: monthLabel(key),
          start: dateKey(from),
          end: dateKey(to),
          revenue: 0,
          expenses: 0,
        });
      }
    }

    periodTransactions.forEach((item) => {
      const bucket = buckets.find((entry) => Boolean(item.date) && item.date! >= entry.start && item.date! <= entry.end);
      if (!bucket) return;
      if (item.type === "Receita") bucket.revenue = addMoney(bucket.revenue, settledAmount(item));
      if (item.type === "Despesa") bucket.expenses = addMoney(bucket.expenses, settledAmount(item));
    });
    return buckets;
  }, [periodTransactions, period, startKey, todayKey]);

  const maxChartValue = Math.max(1, ...chartBuckets.flatMap((bucket) => [bucket.revenue, bucket.expenses]));
  const expenseVariation = previousPeriod > 0 ? ((totals.expenses - previousPeriod) / previousPeriod) * 100 : null;

  const insights = useMemo(() => {
    const items: { tone: "warning" | "positive" | "neutral"; title: string; description: string }[] = [];
    if (totals.revenue > 0 && totals.result < 0) {
      items.push({ tone: "warning", title: "Resultado negativo no período", description: `As saídas realizadas superaram as entradas em ${money(Math.abs(totals.result))}.` });
    } else if (totals.revenue > 0 && totals.result > 0) {
      items.push({ tone: "positive", title: "Resultado positivo", description: `Seu resultado realizado está positivo em ${money(totals.result)} antes de outros compromissos não registrados.` });
    }
    if (expenseVariation !== null && expenseVariation > 10) {
      items.push({ tone: "warning", title: "Despesas em alta", description: `Os gastos realizados aumentaram ${expenseVariation.toFixed(1)}% em comparação ao período anterior equivalente.` });
    } else if (expenseVariation !== null && expenseVariation < -10) {
      items.push({ tone: "positive", title: "Redução de despesas", description: `Os gastos realizados diminuíram ${Math.abs(expenseVariation).toFixed(1)}% em comparação ao período anterior equivalente.` });
    }
    if (pendingOverdue.length) {
      items.push({ tone: "warning", title: "Existem lançamentos pendentes com data passada", description: `${pendingOverdue.length} lançamento(s) de receita ou despesa ainda possuem valor em aberto. Confira as datas e atualize os pagamentos ou recebimentos.` });
    }
    if (categoryTotals[0] && totals.expenses > 0) {
      const share = (categoryTotals[0].amount / totals.expenses) * 100;
      items.push({ tone: "neutral", title: `Maior categoria: ${categoryTotals[0].category}`, description: `${share.toFixed(1)}% das despesas realizadas no período estão concentradas nessa categoria.` });
    }
    if (!items.length) {
      items.push({ tone: "neutral", title: "Ainda não há dados suficientes para uma análise", description: "Registre receitas, despesas, tarefas e hábitos para que o NEXO identifique tendências reais." });
    }
    return items;
  }, [totals, expenseVariation, pendingOverdue.length, categoryTotals]);

  const loading = !finance.loaded || !tasksCollection.loaded || !habitsCollection.loaded;
  const errors = [finance.error, tasksCollection.storageError, habitsCollection.storageError].filter(Boolean);

  return (
    <AppLayout>
      <div className="content intelligence-page">
        <header className="intelligence-heading">
          <div>
            <span className="intelligence-eyebrow">NEXO / ANÁLISE E DESEMPENHO</span>
            <h1>Central de Indicadores e Inteligência</h1>
            <p>Entenda seus resultados, acompanhe tendências e tome decisões com base nos seus registros.</p>
          </div>
          <label className="period-control">
            <span>PERÍODO DE ANÁLISE</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
              <option value="week">Esta semana</option>
              <option value="month">Este mês</option>
              <option value="quarter">Este trimestre</option>
              <option value="semester">Este semestre</option>
              <option value="year">Este ano</option>
            </select>
          </label>
        </header>

        {errors.length > 0 && <div className="intelligence-error" role="alert"><strong>Não foi possível carregar todos os indicadores.</strong><span>{errors.join(" ")}</span></div>}

        {loading ? <div className="intelligence-loading">Carregando seus indicadores do Supabase…</div> : (
          <>
            <section className="intelligence-kpis">
              <article><span>Receitas realizadas</span><strong>{money(totals.revenue)}</strong><small>Valores efetivamente recebidos</small></article>
              <article><span>Despesas realizadas</span><strong>{money(totals.expenses)}</strong><small>Valores efetivamente pagos</small></article>
              <article className={totals.result < 0 ? "negative" : "highlight"}><span>Resultado do período</span><strong>{money(totals.result)}</strong><small>Entradas menos saídas, aplicações e reservas</small></article>
              <article><span>Taxa de economia</span><strong>{totals.savingsRate === null ? "—" : `${totals.savingsRate.toFixed(1)}%`}</strong><small>{totals.savingsRate === null ? "Sem receitas realizadas no período" : "Resultado dividido pelas receitas"}</small></article>
            </section>

            <section className="intelligence-grid">
              <article className="intelligence-panel chart-panel">
                <div className="intelligence-panel-heading"><div><span className="intelligence-eyebrow">EVOLUÇÃO FINANCEIRA</span><h2>Receitas x despesas</h2></div><span className="chart-legend"><i className="legend-income"/> Receitas <i className="legend-expense"/> Despesas</span></div>
                {periodTransactions.length ? (
                  <div className="monthly-chart">
                    {chartBuckets.map((month) => (
                      <div className="month-column" key={month.key}>
                        <div className="month-bars">
                          <div className={progressHeightClass(Math.max(2, month.revenue / maxChartValue * 100), "bar income-bar")} title={`Receitas: ${money(month.revenue)}`} />
                          <div className={progressHeightClass(Math.max(2, month.expenses / maxChartValue * 100), "bar expense-bar")} title={`Despesas: ${money(month.expenses)}`} />
                        </div>
                        <small>{month.label}</small>
                      </div>
                    ))}
                  </div>
                ) : <p className="intelligence-empty">Não há movimentações financeiras no período selecionado.</p>}
              </article>

              <article className="intelligence-panel">
                <div className="intelligence-panel-heading"><div><span className="intelligence-eyebrow">SAÚDE FINANCEIRA</span><h2>Comprometimento da renda</h2></div></div>
                <div className="health-value">{totals.commitmentRate === null ? "—" : `${totals.commitmentRate.toFixed(1)}%`}</div>
                <p className="health-description">Percentual das receitas recebidas que foi utilizado em despesas pagas no período.</p>
                <div className="health-track"><i className={progressWidthClass(Math.min(100, Math.max(0, totals.commitmentRate || 0)))} /></div>
                <div className="health-foot"><span>Despesas: {money(totals.expenses)}</span><span>Receitas: {money(totals.revenue)}</span></div>
                <div className="health-extra"><span>Investimentos aplicados</span><strong>{money(totals.investments)}</strong></div>
                <div className="health-extra"><span>Movimentações para reservas</span><strong>{money(totals.reserves)}</strong></div>
              </article>
            </section>

            <section className="intelligence-grid lower-grid">
              <article className="intelligence-panel">
                <div className="intelligence-panel-heading"><div><span className="intelligence-eyebrow">DISTRIBUIÇÃO</span><h2>Despesas por categoria</h2></div></div>
                {categoryTotals.length ? categoryTotals.slice(0, 7).map((item) => (
                  <div className="category-row" key={item.category}>
                    <div><span>{item.category}</span><strong>{money(item.amount)}</strong></div>
                    <div className="category-track"><i className={progressWidthClass(totals.expenses > 0 ? item.amount / totals.expenses * 100 : 0)} /></div>
                    <small>{totals.expenses > 0 ? (item.amount / totals.expenses * 100).toFixed(1) : "0.0"}% das despesas</small>
                  </div>
                )) : <p className="intelligence-empty">Ainda não há despesas realizadas por categoria neste período.</p>}
              </article>

              <article className="intelligence-panel">
                <div className="intelligence-panel-heading"><div><span className="intelligence-eyebrow">PRODUTIVIDADE</span><h2>Rotina e consistência</h2></div><Link href="/rotina/produtividade">Ver detalhes ↗</Link></div>
                <div className="productivity-stat"><strong>{taskCompleted}/{tasks.length}</strong><span>Tarefas marcadas como concluídas no total atual</span></div>
                <div className="productivity-stat"><strong>{taskRate === null ? "—" : `${taskRate}%`}</strong><span>Taxa de conclusão do total de tarefas</span></div>
                <div className="productivity-stat"><strong>{habitCheckIns}</strong><span>Registros de hábitos realizados no período</span></div>
                <div className="productivity-stat"><strong>{activeHabits.length}</strong><span>Hábitos ativos cadastrados</span></div>
                <p className="data-note">O histórico de conclusão de tarefas não possui data própria em todos os registros; por isso, a taxa de tarefas é apresentada como situação atual, não como evolução histórica.</p>
              </article>
            </section>

            <section className="intelligence-panel insights-panel">
              <div className="intelligence-panel-heading"><div><span className="intelligence-eyebrow">LEITURA DOS SEUS DADOS</span><h2>Análises e pontos de atenção</h2></div></div>
              <div className="insights-grid">
                {insights.map((item) => <article className={`insight-card ${item.tone}`} key={item.title}><span>{item.tone === "warning" ? "ATENÇÃO" : item.tone === "positive" ? "POSITIVO" : "ANÁLISE"}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}
              </div>
            </section>

            <section className="intelligence-links">
              <Link href="/financeiro/dashboard">Dashboard financeiro ↗</Link>
              <Link href="/rotina/produtividade">Produtividade ↗</Link>
              <Link href="/rotina/habitos">Histórico de hábitos ↗</Link>
              <Link href="/financeiro/historico">Histórico financeiro ↗</Link>
            </section>
          </>
        )}
      </div>

      <style jsx>{`
        .intelligence-page{max-width:1550px;margin:0 auto;padding-bottom:38px;display:flex;flex-direction:column;gap:16px;color:#eee}
        .intelligence-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:5px 0 8px}
        .intelligence-eyebrow{display:block;color:#8f9099;font-size:9px;font-weight:750;letter-spacing:1.5px}
        .intelligence-heading h1{margin:8px 0 6px;font-size:clamp(21px,2.5vw,29px);letter-spacing:-.7px}
        .intelligence-heading p{margin:0;color:#9999a3;font-size:11px;line-height:1.6}
        .period-control{display:flex;flex-direction:column;gap:6px;min-width:170px}
        .period-control span{color:#92929c;font-size:8px;font-weight:700;letter-spacing:1px}
        .period-control select{height:36px;padding:0 10px;border:1px solid #3b3b43;border-radius:6px;background:#17171a;color:#eee;font-size:10px}
        .intelligence-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
        .intelligence-kpis article,.intelligence-panel{min-width:0;padding:17px;border:1px solid #303036;border-radius:9px;background:#18181b}
        .intelligence-kpis article{display:flex;flex-direction:column;gap:7px}
        .intelligence-kpis span{color:#a3a3ad;font-size:10px}
        .intelligence-kpis strong{overflow-wrap:anywhere;font-size:clamp(17px,2vw,23px)}
        .intelligence-kpis small{color:#85858f;font-size:9px;line-height:1.4}
        .intelligence-kpis .highlight{background:#202126;border-color:#484951}
        .intelligence-kpis .negative{border-color:#684747;background:#241a1b}
        .intelligence-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,1fr);gap:13px;align-items:stretch}
        .intelligence-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
        .intelligence-panel-heading h2{margin:5px 0 0;font-size:14px}
        .intelligence-panel-heading>a{color:#bcbcc4;font-size:9px;text-decoration:none}
        .chart-legend{display:flex;align-items:center;gap:6px;color:#a3a3ad;font-size:8px}
        .chart-legend i{width:7px;height:7px;border-radius:2px}
        .legend-income{background:#b7c9bd}.legend-expense{background:#777b85}
        .monthly-chart{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px;align-items:end;min-height:190px;padding-top:10px}
        .month-column{display:flex;flex-direction:column;align-items:center;gap:9px;min-width:0;height:180px}
        .month-bars{display:flex;align-items:flex-end;justify-content:center;gap:3px;width:100%;height:150px;border-bottom:1px solid #3a3a41}
        .bar{width:min(15px,38%);min-height:2px;border-radius:3px 3px 0 0}
        .income-bar{background:#a9c1b2}.expense-bar{background:#777b85}
        .month-column small{color:#90909a;font-size:8px;text-transform:capitalize}
        .intelligence-empty{color:#92929c;font-size:10px;line-height:1.6}
        .health-value{font-size:34px;font-weight:750;letter-spacing:-1px}
        .health-description{max-width:440px;color:#9999a3;font-size:10px;line-height:1.6}
        .health-track,.category-track{height:7px;overflow:hidden;border-radius:9px;background:#33333a}
        .health-track i,.category-track i{display:block;height:100%;border-radius:9px;background:#aab7ad}
        .health-foot{display:flex;justify-content:space-between;gap:8px;margin-top:8px;color:#9999a3;font-size:8px}
        .health-extra{display:flex;justify-content:space-between;gap:10px;padding:12px 0 0;margin-top:11px;border-top:1px solid #2e2e34;color:#a3a3ad;font-size:9px}
        .health-extra strong{color:#eee}
        .lower-grid{grid-template-columns:minmax(0,1.15fr) minmax(280px,1fr)}
        .category-row{margin:14px 0}
        .category-row>div:first-child{display:flex;justify-content:space-between;gap:12px;color:#d2d2d8;font-size:10px}
        .category-row>div:first-child strong{color:#eee}
        .category-track{height:5px;margin-top:7px}
        .category-row small{display:block;margin-top:5px;color:#85858f;font-size:8px}
        .productivity-stat{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #2d2d33}
        .productivity-stat strong{flex-shrink:0;font-size:20px}
        .productivity-stat span{color:#a0a0aa;font-size:9px;text-align:right}
        .data-note{margin:13px 0 0;color:#85858f;font-size:9px;line-height:1.6}
        .insights-panel{padding:18px}
        .insights-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .insight-card{padding:13px;border:1px solid #34343a;border-radius:7px;background:#1c1c20}
        .insight-card>span{font-size:8px;font-weight:750;letter-spacing:1px;color:#a9a9b1}
        .insight-card h3{margin:7px 0 5px;font-size:11px}
        .insight-card p{margin:0;color:#9999a3;font-size:9px;line-height:1.6}
        .insight-card.warning{border-color:#684747;background:#241a1b}
        .insight-card.warning>span{color:#e0a0a0}
        .insight-card.positive>span{color:#a8c7b3}
        .intelligence-links{display:flex;flex-wrap:wrap;gap:10px}
        .intelligence-links a{padding:9px 11px;border:1px solid #36363d;border-radius:6px;color:#c5c5cc;font-size:9px;text-decoration:none}
        .intelligence-links a:hover{border-color:#777;color:#fff}
        .intelligence-error{display:flex;flex-direction:column;gap:5px;padding:11px 13px;border:1px solid #704b4b;border-radius:7px;background:#25191b;color:#e5b4b4;font-size:10px}
        .intelligence-loading{display:grid;place-items:center;min-height:220px;color:#a0a0aa;font-size:11px}
        @media(max-width:950px){.intelligence-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.intelligence-grid,.lower-grid{grid-template-columns:1fr}.monthly-chart{grid-template-columns:repeat(6,minmax(0,1fr))}}
        @media(max-width:620px){.intelligence-heading{align-items:stretch;flex-direction:column}.period-control{width:100%}.insights-grid{grid-template-columns:1fr}.monthly-chart{grid-template-columns:repeat(4,minmax(0,1fr))}.intelligence-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>
    </AppLayout>
  );
}
