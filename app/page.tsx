
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
import { PageHeader, SearchButton } from "@/components/ui/DashboardPrimitives";
import UserMenu from "@/components/ui/UserMenu";

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
  // INTERFACE
  // =====================================================

  return (
    <AppLayout
      header={
        <div className="nexo-page-header-bar">
          <div className="nexo-page-header-container">
            <PageHeader
              className="nexo-topbar-page"
              breadcrumb="NEXO / CENTRAL DO DIA"
              title="Central do Dia"
              actions={
                <>
                  <button
                    type="button"
                    className="nexo-mobile-nav-toggle"
                    aria-label="Abrir menu de navegação"
                    onClick={() => window.dispatchEvent(new Event("nexo:toggle-mobile-nav"))}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <SearchButton />
                  <UserMenu />
                </>
              }
            />
          </div>
        </div>
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

        <style jsx global>{`
          #nexo-app .nexo-page-header-bar {
            width: 100%;
            border-bottom: 1px solid var(--border);
            background: rgba(12, 12, 14, 0.48);
          }

          #nexo-app .nexo-page-header-container {
            width: 100%;
            max-width: 1400px;
            margin-inline: auto;
            padding-inline: 20px;
          }

          #nexo-app .nexo-page-header.nexo-topbar-page {
            display: flex;
            flex-direction: row;
            height: 52px;
            min-height: 52px;
            align-items: center;
            gap: 12px;
            margin: 0;
            padding: 8px 0;
          }

          #nexo-app .nexo-topbar-page .nexo-page-header-copy {
            gap: 2px;
          }

          #nexo-app .nexo-topbar-page .nexo-page-breadcrumb {
            color: var(--text-subtle);
            font-size: 11px;
            line-height: 10px;
            letter-spacing: 1px;
            text-transform: uppercase;
          }

          #nexo-app .nexo-topbar-page h1 {
            color: var(--text-primary);
            font-size: 20px;
            font-weight: 650;
            line-height: 24px;
            letter-spacing: -0.35px;
          }

          #nexo-app .nexo-topbar-page .nexo-mobile-nav-toggle {
            display: none;
            width: 32px;
            height: 32px;
            flex: 0 0 32px;
            padding: 0;
            border-radius: 10px;
          }

          #nexo-app .nexo-topbar-page .nexo-search-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 32px;
            min-height: 32px;
            padding: 0 10px;
            color: var(--text-secondary);
            background: var(--surface-elevated, var(--surface-raised));
            border: 1px solid var(--border);
            border-radius: 10px;
            font-size: 13px;
            line-height: 1;
            white-space: nowrap;
          }

          #nexo-app .nexo-topbar-page .nexo-search-button:hover {
            border-color: var(--border-strong);
            background: var(--surface-raised);
          }

          #nexo-app .nexo-topbar-page .nexo-search-button svg {
            display: block;
            width: 14px;
            height: 14px;
            flex: 0 0 14px;
            stroke-width: 1.8;
          }

          #nexo-app .nexo-topbar-page .nexo-search-button kbd {
            padding: 2px 6px;
            color: var(--text-subtle);
            border: 1px solid var(--border);
            border-radius: 6px;
            background: transparent;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 10px;
            line-height: 12px;
          }

          #nexo-app .nexo-topbar-page .nexo-page-header-actions {
            flex: 0 0 auto;
            align-items: center;
            justify-content: flex-end;
            gap: 12px;
            flex-wrap: nowrap;
          }

          #nexo-app .nexo-topbar-page .nexo-account-trigger {
            width: 34px;
            min-width: 34px;
            min-height: 34px;
            height: 34px;
            justify-content: center;
            padding: 0;
            border-radius: 50%;
          }

          #nexo-app .nexo-topbar-page .nexo-account-avatar {
            width: 32px;
            height: 32px;
            flex-basis: 32px;
            border-radius: 50%;
          }

          #nexo-app .nexo-topbar-page .nexo-account-email,
          #nexo-app .nexo-topbar-page .nexo-account-chevron {
            display: none;
          }

          #nexo-app .daily-home-content {
            padding-top: 0 !important;
            padding-inline: 20px !important;
          }

          @media (max-width: 1023px) {
            #nexo-app .nexo-topbar-page .nexo-mobile-nav-toggle {
              display: inline-flex;
            }
          }

          @media (max-width: 639px) {
            #nexo-app .nexo-page-header-container {
              padding-inline: 12px;
            }

            #nexo-app .nexo-page-header.nexo-topbar-page {
              height: 48px;
              min-height: 48px;
              padding-block: 8px;
            }

            #nexo-app .nexo-topbar-page .nexo-page-breadcrumb {
              display: none;
            }

            #nexo-app .nexo-topbar-page .nexo-mobile-nav-toggle {
              display: inline-flex;
            }

            #nexo-app .nexo-topbar-page .nexo-search-button {
              width: 32px;
              min-width: 32px;
              padding: 0;
            }

            #nexo-app .nexo-topbar-page .nexo-search-label,
            #nexo-app .nexo-topbar-page .nexo-search-button kbd {
              display: none;
            }

            #nexo-app .nexo-topbar-page h1 {
              font-size: 18px;
              line-height: 24px;
            }

            #nexo-app .daily-home-content {
              padding-inline: 12px !important;
            }
          }
        `}</style>      <footer className="footer">
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
