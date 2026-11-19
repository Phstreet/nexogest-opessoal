
"use client";

import { useRoutineCollection } from "@/hooks/useRoutineCollection";
import { useFinanceDashboard } from "@/app/hooks/finance/useFinanceDashboard";
import {
  isValidRoutineTask,
  isValidRoutineHabit,
  type RoutineTask,
  type RoutineHabit,
} from "@/lib/routine/types";
import AppLayout from "../components/layout/AppLayout";
import DailyCenter from "@/components/dashboard/DailyCenter";

export default function Home() {
  // Usa o armazenamento centralizado para preservar dados inválidos
  // e impedir gravações quando a coleção não puder ser validada.
  const {
    items: tasks,
    storageError,
  } = useRoutineCollection<RoutineTask>("nexo_tasks", isValidRoutineTask);

  // Mantém o resumo alinhado ao Dashboard Financeiro:
  // somente valores efetivamente recebidos e pagos no mês atual.
  const {
    transactions: financeTransactions,
    currentConfirmedRevenue: income,
    currentConfirmedExpenses: expenses,
    currentBalance: balance,
    loaded: financeLoaded,
    error: financeError,
  } = useFinanceDashboard();

  const {
    items: habits,
    storageError: habitsStorageError,
  } = useRoutineCollection<RoutineHabit>("nexo_habits", isValidRoutineHabit);

  // =====================================================
  // CABEÇALHO
  // =====================================================

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // =====================================================
  // INTERFACE
  // =====================================================

  return (
    <AppLayout
      header={
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              NEXO / CENTRAL DO DIA
            </div>

            <h1>Central do Dia</h1>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-search-trigger"
              onClick={() => window.dispatchEvent(new Event("nexo:open-search"))}
            >
              <span aria-hidden="true">⌕</span>
              <span>Buscar no NEXO</span>
              <kbd>Ctrl K</kbd>
            </button>

            <div className="date-display">
              <span className="date-icon">◷</span>
              {today}
            </div>

            <div className="profile-avatar">N</div>
          </div>
        </header>
      }
    >
      <div className="content daily-home-content">
        {storageError && (
          <div role="alert" className="storage-protection-message">
            <strong>Armazenamento protegido — tarefas:</strong> {storageError}
          </div>
        )}
        {habitsStorageError && (
          <div role="alert" className="storage-protection-message">
            <strong>Armazenamento protegido — hábitos:</strong> {habitsStorageError}
          </div>
        )}

        {/* RESUMO PRINCIPAL DO DIA */}

        <DailyCenter
            tasks={tasks}
            habits={habits}
            transactions={financeTransactions}
            financeLoaded={financeLoaded}
            financeError={financeError}
            income={income}
            expenses={expenses}
            balance={balance}
            taskError={storageError}
            habitError={habitsStorageError}
        />

        <style jsx>{`
          .daily-home-content { padding-top: 0; }
          :global(.nexo-account-slot) { padding: 3px 22px 0; background: transparent; }
          :global(.nexo-account-access) { min-height: 23px; padding: 2px 7px; gap: 7px; border-color: #29292e; background: transparent; color: #85858e; font-size: 9px; }
          :global(.nexo-account-access a), :global(.nexo-account-access button) { color: #a5a5ad; }
          :global(.nexo-account-indicator) { width: 5px; height: 5px; }
          .topbar { min-height: 58px; padding: 8px 24px; gap: 12px; background: rgba(12,12,14,.48); }
          .breadcrumb { margin-bottom: 2px; font-size: 7px; letter-spacing: 1.2px; opacity: .72; }
          .topbar h1 { font-size: 16px; font-weight: 650; letter-spacing: -.3px; }
          .topbar-right { gap: 11px; }
          .topbar-search-trigger { min-height: 32px; padding: 0 10px; border-color: #2b2c32; background: rgba(23,24,28,.55); font-size: 10px; }
          .topbar-search-trigger>span:first-child { font-size: 17px; }
          .date-display { font-size: 9px; color: #777b84; }
          .date-icon { font-size: 13px; }
          .profile-avatar { width: 27px; height: 27px; font-size: 10px; }
          .topbar-search-trigger { min-height:42px; display:inline-flex; align-items:center; gap:9px; padding:0 13px; border:1px solid #34363d; border-radius:10px; background:#17181c; color:#c5cad2; font:inherit; font-size:12px; cursor:pointer; }
          .topbar-search-trigger:hover { border-color:#777d88; background:#202126; color:#fff; }
          .topbar-search-trigger>span:first-child { font-size:21px; line-height:1; }
          .topbar-search-trigger kbd { padding:3px 5px; border:1px solid #414148; border-radius:4px; color:#858b95; font-size:9px; }
          @media(max-width:760px) {
            .topbar { padding: 8px 16px; }
            .topbar-right { flex-wrap:wrap; gap: 8px; }
            .topbar-search-trigger { order:3; }
          }
          @media(max-width:480px) {
            .topbar-search-trigger { width:100%; justify-content:center; }
          }
          .daily-quick-links { display:flex; flex-wrap:wrap; gap:14px; margin-top:14px; }
          .daily-quick-links a { color:#aaa; font-size:10px; text-decoration:none; }
          .daily-quick-links a:hover { color:#fff; text-decoration:underline; }
          .daily-overview-grid { margin-top:18px; }
          .daily-completed { color:#888; text-decoration:line-through; }
          @media(max-width:700px) {
            .daily-quick-links { flex-direction:column; gap:10px; }
            .daily-quick-entry .task-entry { align-items:stretch; flex-direction:column; }
            .daily-quick-entry .task-entry button { width:100%; }
          }
        `}</style>

        <footer className="footer">
          <span>
            © 2026 NEXO — GESTÃO PESSOAL
          </span>

          <span>
            PLANEJE. ORGANIZE. CONQUISTE.
          </span>
        </footer>
      </div>
    </AppLayout>
  );
}
