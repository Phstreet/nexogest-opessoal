
"use client";

import { useFinanceDashboard } from "@/app/hooks/finance/useFinanceDashboard";
import DashboardHeader from "@/components/finance/dashboard/DashboardHeader";
import DashboardSummary from "@/components/finance/dashboard/DashboardSummary";
import DashboardCharts from "@/components/finance/dashboard/DashboardCharts";
import DashboardCategories from "@/components/finance/dashboard/DashboardCategories";
import DashboardForecast from "@/components/finance/dashboard/DashboardForecast";
import DashboardRecommendations from "@/components/finance/dashboard/DashboardRecommendations";
import DashboardAccounts from "@/components/finance/dashboard/DashboardAccounts";
import DashboardFooter from "@/components/finance/dashboard/DashboardFooter";

export default function FinancialDashboardPage() {
  const {
    loaded,
    accounts,
    period,
    setPeriod,
    currentMonthName,
    financialSituation,
    currentRevenue,
    currentExpenses,
    currentInvestments,
    currentReserves,
    currentConfirmedExpenses,
    currentConfirmedRevenue,
    currentBalance,
    accountBalance,
    reserveBalance,
    monthlyData,
    maxChartValue,
    categoryExpenses,
    totalCategoryExpenses,
    maxCategoryValue,
    monthlySavingsTarget,
    savingsRate,
    visibleForecast,
    averageFutureBalance,
    totalFutureExpenses,
    totalFutureRevenue,
    recommendations,
    availableToSpend,
    money,
  } = useFinanceDashboard();

  if (!loaded) {
    return (
      <div className="content dashboard-content">
        <div className="dashboard-loading">
          <div className="loading-indicator" />
          <p>Carregando dashboard financeiro...</p>
        </div>

        <style jsx global>{`
          .dashboard-loading {
            min-height: 60vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            color: #a1a1aa;
            font-size: 13px;
          }

          .loading-indicator {
            width: 28px;
            height: 28px;
            border: 3px solid #34343a;
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="content dashboard-content">
      <DashboardHeader
        currentMonthName={currentMonthName}
        financialSituation={financialSituation}
      />

      <DashboardSummary
        currentRevenue={currentRevenue}
        currentExpenses={currentExpenses}
        currentBalance={currentBalance}
        currentConfirmedRevenue={currentConfirmedRevenue}
        currentConfirmedExpenses={currentConfirmedExpenses}
        availableToSpend={availableToSpend}
        money={money}
      />

      <DashboardCharts
        monthlyData={monthlyData}
        maxChartValue={maxChartValue}
        currentRevenue={currentRevenue}
        currentExpenses={currentExpenses}
        currentBalance={currentBalance}
        currentInvestments={currentInvestments}
        currentReserves={currentReserves}
        savingsRate={savingsRate}
        money={money}
      />

      <DashboardCategories
        categoryExpenses={categoryExpenses}
        totalCategoryExpenses={totalCategoryExpenses}
        maxCategoryValue={maxCategoryValue}
        monthlySavingsTarget={monthlySavingsTarget}
        currentInvestments={currentInvestments}
        currentReserves={currentReserves}
        currentBalance={currentBalance}
        money={money}
      />

      <DashboardForecast
        period={period}
        setPeriod={setPeriod}
        visibleForecast={visibleForecast}
        totalFutureRevenue={totalFutureRevenue}
        totalFutureExpenses={totalFutureExpenses}
        averageFutureBalance={averageFutureBalance}
        money={money}
      />

      <section className="main-grid bottom-grid">
        <DashboardRecommendations
          recommendations={recommendations}
        />

        <DashboardAccounts
          accounts={accounts}
          accountBalance={accountBalance}
          reserveBalance={reserveBalance}
          money={money}
        />
      </section>

      <section className="disclaimer">
        <span>ⓘ</span>
        <p>
          <strong>Sobre os indicadores:</strong> os valores são calculados
          com base nos lançamentos cadastrados no NEXO. Quando o lançamento
          possui valor efetivamente pago ou recebido, esse valor é considerado
          nos indicadores de confirmação. Os saldos das contas consideram movimentações efetivadas. As reservas são apresentadas separadamente.
        </p>
      </section>

      <DashboardFooter />

      <style jsx global>{`
        .dashboard-content {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .dashboard-content .welcome-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 0;
        }

        .dashboard-content .section-eyebrow {
          display: block;
          color: #85858f;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .dashboard-content .welcome-section h2 {
          margin: 8px 0 6px;
          font-size: 21px;
          font-weight: 600;
        }

        .dashboard-content .welcome-section h2 strong {
          color: #fff;
          text-transform: capitalize;
        }

        .dashboard-content .welcome-section p {
          margin: 0;
          color: #92929c;
          font-size: 13px;
          line-height: 1.6;
        }

        .dashboard-content .situation-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          padding: 9px 13px;
          border: 1px solid #38383e;
          border-radius: 20px;
          background: #1a1a1e;
          color: #c9c9d0;
          font-size: 11px;
        }

        .dashboard-content .situation-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #aaa;
        }

        .dashboard-content .situation-badge.positive .situation-dot {
          background: #70bd91;
        }

        .dashboard-content .situation-badge.negative .situation-dot {
          background: #e17a7a;
        }

        .dashboard-content .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .dashboard-content .summary-card,
        .dashboard-content .panel {
          min-width: 0;
          padding: 20px;
          border: 1px solid #29292e;
          border-radius: 9px;
          background: #171719;
        }

        .dashboard-content .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 17px;
        }

        .dashboard-content .card-label {
          color: #a4a4ad;
          font-size: 12px;
        }

        .dashboard-content .card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 29px;
          height: 29px;
          border: 1px solid #34343a;
          border-radius: 7px;
          color: #d0d0d6;
          background: #222226;
          font-size: 16px;
        }

        .dashboard-content .card-icon.income {
          color: #80c69c;
        }

        .dashboard-content .card-icon.expense {
          color: #e18a8a;
        }

        .dashboard-content .card-value {
          display: block;
          overflow-wrap: anywhere;
          font-size: clamp(19px, 2vw, 25px);
          font-weight: 700;
          letter-spacing: -0.7px;
        }

        .dashboard-content .card-description {
          display: block;
          margin-top: 9px;
          color: #85858f;
          font-size: 10px;
          line-height: 1.5;
        }

        .dashboard-content .income-text {
          color: #83c99e !important;
        }

        .dashboard-content .negative-text {
          color: #e58a8a !important;
        }

        .dashboard-content .positive-text {
          color: #83c99e !important;
        }

        .dashboard-content .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr);
          gap: 18px;
          min-width: 0;
        }

        .dashboard-content .panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .dashboard-content .panel-header h3 {
          margin: 7px 0 5px;
          font-size: 16px;
          font-weight: 650;
        }

        .dashboard-content .panel-header p {
          margin: 0;
          color: #85858f;
          font-size: 11px;
          line-height: 1.5;
        }

        .dashboard-content .chart-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          color: #a2a2ab;
          font-size: 10px;
        }

        .dashboard-content .chart-legend span {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .dashboard-content .chart-legend i {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }

        .dashboard-content .legend-income {
          background: #82bd98;
        }

        .dashboard-content .legend-expense {
          background: #a0a0aa;
        }

        .dashboard-content .bar-chart {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          gap: 12px;
          min-height: 190px;
          padding: 10px 0 0;
          border-bottom: 1px solid #303036;
        }

        .dashboard-content .bar-group {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .dashboard-content .bars {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 4px;
          height: 160px;
          width: 100%;
        }

        .dashboard-content .bar {
          width: min(25px, 40%);
          min-height: 3px;
          border-radius: 4px 4px 0 0;
          transition: height 0.3s;
        }

        .dashboard-content .income-bar {
          background: #82bd98;
        }

        .dashboard-content .expense-bar {
          background: #777781;
        }

        .dashboard-content .bar-label {
          max-width: 100%;
          color: #898993;
          font-size: 9px;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .dashboard-content .chart-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 15px;
          color: #93939d;
          font-size: 10px;
        }

        .dashboard-content .chart-footer strong {
          color: #e5e5e9;
        }

        .dashboard-content .result-main {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 16px;
          margin-bottom: 16px;
          border: 1px solid #303036;
          border-radius: 7px;
          background: #202024;
        }

        .dashboard-content .result-main span {
          color: #9a9aa4;
          font-size: 11px;
        }

        .dashboard-content .result-main strong {
          font-size: 25px;
          letter-spacing: -0.7px;
        }

        .dashboard-content .result-line {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 0;
          border-bottom: 1px solid #29292e;
          color: #a3a3ad;
          font-size: 11px;
        }

        .dashboard-content .result-line strong {
          color: #e5e5e9;
          text-align: right;
        }

        .dashboard-content .total-line {
          margin-top: 3px;
          border-bottom: 0;
          color: #ddd;
        }

        .dashboard-content .category-grid {
          grid-template-columns: minmax(0, 1.3fr) minmax(300px, 1fr);
        }

        .dashboard-content .category-list {
          display: flex;
          flex-direction: column;
          gap: 19px;
        }

        .dashboard-content .category-info {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
          color: #d4d4da;
          font-size: 11px;
        }

        .dashboard-content .category-info strong {
          color: #f0f0f2;
        }

        .dashboard-content .progress-track {
          width: 100%;
          height: 6px;
          overflow: hidden;
          border-radius: 10px;
          background: #303036;
        }

        .dashboard-content .progress-fill {
          height: 100%;
          border-radius: 10px;
          background: #96969f;
        }

        .dashboard-content .category-percentage {
          display: block;
          margin-top: 6px;
          color: #85858f;
          font-size: 9px;
        }

        .dashboard-content .economy-highlight {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 17px;
          margin-bottom: 12px;
          border: 1px solid #34343a;
          border-radius: 7px;
          background: #202024;
        }

        .dashboard-content .economy-highlight span {
          color: #a1a1aa;
          font-size: 11px;
        }

        .dashboard-content .economy-highlight strong {
          font-size: 25px;
        }

        .dashboard-content .economy-highlight small {
          color: #85858f;
          font-size: 10px;
          line-height: 1.5;
        }

        .dashboard-content .economy-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 0;
          border-bottom: 1px solid #29292e;
          color: #a5a5ae;
          font-size: 10px;
        }

        .dashboard-content .economy-row strong {
          color: #e5e5e9;
          text-align: right;
        }

        .dashboard-content .economy-note {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 12px;
          margin-top: 15px;
          border: 1px solid #34343a;
          border-radius: 6px;
          color: #a1a1aa;
          background: #202024;
          font-size: 10px;
          line-height: 1.5;
        }

        .dashboard-content .economy-note span {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: #414149;
          color: white;
          font-weight: 700;
        }

        .dashboard-content .forecast-panel {
          margin-bottom: 0;
        }

        .dashboard-content .forecast-header {
          align-items: center;
        }

        .dashboard-content .period-select {
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid #38383e;
          border-radius: 6px;
          outline: none;
          background: #222226;
          color: #e5e5e9;
          font-size: 11px;
        }

        .dashboard-content .forecast-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .dashboard-content .forecast-table {
          width: 100%;
          border-collapse: collapse;
          white-space: nowrap;
        }

        .dashboard-content .forecast-table th {
          padding: 12px 10px;
          border-bottom: 1px solid #34343a;
          color: #85858f;
          font-size: 10px;
          font-weight: 600;
          text-align: left;
        }

        .dashboard-content .forecast-table td {
          padding: 14px 10px;
          border-bottom: 1px solid #29292e;
          color: #d5d5da;
          font-size: 11px;
        }

        .dashboard-content .forecast-table td strong {
          font-weight: 600;
        }

        .dashboard-content .estimate-label {
          display: block;
          margin-top: 4px;
          color: #85858f;
          font-size: 9px;
        }

        .dashboard-content .forecast-status {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border: 1px solid #38383e;
          border-radius: 20px;
          font-size: 9px;
        }

        .dashboard-content .forecast-status.safe {
          color: #9bc9a9;
          background: #1b2920;
          border-color: #304a38;
        }

        .dashboard-content .forecast-status.danger {
          color: #e59a9a;
          background: #2b1d1d;
          border-color: #533333;
        }

        .dashboard-content .forecast-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          padding: 16px 0 4px;
        }

        .dashboard-content .forecast-summary div {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .dashboard-content .forecast-summary span {
          color: #85858f;
          font-size: 10px;
        }

        .dashboard-content .forecast-summary strong {
          font-size: 15px;
        }

        .dashboard-content .forecast-disclaimer {
          margin: 15px 0 0;
          color: #777781;
          font-size: 10px;
          line-height: 1.6;
        }

        .dashboard-content .bottom-grid {
          grid-template-columns: minmax(0, 1.3fr) minmax(300px, 1fr);
        }

        .dashboard-content .recommendation-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .dashboard-content .recommendation-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 13px;
          border: 1px solid #303036;
          border-radius: 7px;
          background: #202024;
        }

        .dashboard-content .recommendation-icon {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 23px;
          height: 23px;
          border-radius: 6px;
          background: #34343a;
          color: #ddd;
          font-size: 12px;
          font-weight: 700;
        }

        .dashboard-content .recommendation-item.warning .recommendation-icon {
          color: #e8a1a1;
        }

        .dashboard-content .recommendation-item.success .recommendation-icon {
          color: #9bc9a9;
        }

        .dashboard-content .recommendation-item strong {
          display: block;
          margin-bottom: 5px;
          color: #e7e7eb;
          font-size: 11px;
        }

        .dashboard-content .recommendation-item p {
          margin: 0;
          color: #9999a3;
          font-size: 10px;
          line-height: 1.6;
        }

        .dashboard-content .panel-link {
          flex-shrink: 0;
          color: #c3c3cb;
          font-size: 10px;
          text-decoration: none;
        }

        .dashboard-content .account-total {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 15px;
          margin-bottom: 12px;
          border: 1px solid #34343a;
          border-radius: 7px;
          background: #202024;
        }

        .dashboard-content .account-total span {
          color: #9999a3;
          font-size: 10px;
        }

        .dashboard-content .account-total strong {
          font-size: 22px;
        }

        .dashboard-content .account-list {
          display: flex;
          flex-direction: column;
        }

        .dashboard-content .account-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 0;
          border-bottom: 1px solid #29292e;
        }

        .dashboard-content .account-symbol {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 31px;
          height: 31px;
          border: 1px solid #38383e;
          border-radius: 7px;
          background: #252529;
          color: #c5c5cd;
        }

        .dashboard-content .account-info {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          gap: 4px;
        }

        .dashboard-content .account-info strong {
          overflow: hidden;
          color: #e5e5e9;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-content .account-info span {
          color: #85858f;
          font-size: 9px;
        }

        .dashboard-content .account-value {
          color: #e1e1e6;
          font-size: 10px;
          white-space: nowrap;
        }

        .dashboard-content .empty-state {
          display: flex;
          min-height: 150px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #85858f;
          text-align: center;
        }

        .dashboard-content .empty-state > span {
          font-size: 25px;
        }

        .dashboard-content .empty-state strong {
          color: #d5d5da;
          font-size: 12px;
        }

        .dashboard-content .empty-state p {
          max-width: 260px;
          margin: 0;
          font-size: 10px;
          line-height: 1.5;
        }

        .dashboard-content .empty-state.compact {
          min-height: 100px;
        }

        .dashboard-content .empty-table {
          padding: 25px !important;
          color: #85858f !important;
          text-align: center;
        }

        .dashboard-content .disclaimer {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px;
          border: 1px solid #34343a;
          border-radius: 7px;
          background: #19191c;
        }

        .dashboard-content .disclaimer > span {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 21px;
          height: 21px;
          border-radius: 50%;
          background: #34343a;
          color: #e0e0e5;
          font-size: 12px;
        }

        .dashboard-content .disclaimer p {
          margin: 0;
          color: #9696a0;
          font-size: 10px;
          line-height: 1.7;
        }

        .dashboard-content .disclaimer strong {
          color: #d7d7dc;
        }

        @media (max-width: 1100px) {
          .dashboard-content .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard-content .main-grid,
          .dashboard-content .category-grid,
          .dashboard-content .bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .dashboard-content .welcome-section {
            align-items: flex-start;
            flex-direction: column;
          }

          .dashboard-content .welcome-section h2 {
            font-size: 18px;
          }

          .dashboard-content .summary-grid {
            gap: 9px;
          }

          .dashboard-content .summary-card {
            padding: 14px;
          }

          .dashboard-content .card-value {
            font-size: 19px;
          }

          .dashboard-content .card-description {
            font-size: 9px;
          }

          .dashboard-content .panel {
            padding: 15px;
          }

          .dashboard-content .panel-header {
            flex-direction: column;
          }

          .dashboard-content .chart-legend {
            margin-top: -10px;
          }

          .dashboard-content .bar-chart {
            gap: 4px;
          }

          .dashboard-content .bar-label {
            font-size: 8px;
          }

          .dashboard-content .chart-footer {
            flex-direction: column;
          }

          .dashboard-content .forecast-header {
            align-items: flex-start;
          }

          .dashboard-content .forecast-summary {
            grid-template-columns: 1fr;
          }

          .dashboard-content .forecast-summary div {
            padding: 9px 0;
            border-bottom: 1px solid #29292e;
          }

          .dashboard-content .forecast-table {
            min-width: 650px;
          }
        }

        @media (max-width: 380px) {
          .dashboard-content .summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
