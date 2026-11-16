
type MonthData = {
    key: string;
    label: string;
    revenue: number;
    expenses: number;
  };
  
  type DashboardChartsProps = {
    monthlyData: MonthData[];
    maxChartValue: number;
    currentRevenue: number;
    currentExpenses: number;
    currentBalance: number;
    currentInvestments: number;
    currentReserves: number;
    savingsRate: number;
    money: (value: number) => string;
  };
  
  export default function DashboardCharts({
    monthlyData,
    maxChartValue,
    currentRevenue,
    currentExpenses,
    currentBalance,
    currentInvestments,
    currentReserves,
    savingsRate,
    money,
  }: DashboardChartsProps) {
    return (
      <section className="main-grid">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <span className="section-eyebrow">DESEMPENHO</span>
              <h3>Receitas x despesas</h3>
              <p>Comparativo dos últimos meses e do período atual.</p>
            </div>
  
            <div className="chart-legend">
              <span><i className="legend-income" /> Receitas</span>
              <span><i className="legend-expense" /> Despesas</span>
            </div>
          </div>
  
          <div className="bar-chart">
            {monthlyData.map((month) => (
              <div className="bar-group" key={month.key}>
                <div className="bars">
                  <div
                    className="bar income-bar"
                    style={{
                      height: `${Math.max(
                        3,
                        (month.revenue / maxChartValue) * 150
                      )}px`,
                    }}
                    title={`Receitas: ${money(month.revenue)}`}
                  />
  
                  <div
                    className="bar expense-bar"
                    style={{
                      height: `${Math.max(
                        3,
                        (month.expenses / maxChartValue) * 150
                      )}px`,
                    }}
                    title={`Despesas: ${money(month.expenses)}`}
                  />
                </div>
  
                <span className="bar-label">{month.label}</span>
              </div>
            ))}
          </div>
  
          <div className="chart-footer">
            <span>
              <strong>{money(currentRevenue)}</strong> em receitas
            </span>
  
            <span>
              <strong>{money(currentExpenses)}</strong> em despesas
            </span>
          </div>
        </article>
  
        <article className="panel result-panel">
          <div className="panel-header">
            <div>
              <span className="section-eyebrow">SEU RESULTADO</span>
              <h3>Distribuição do dinheiro</h3>
              <p>Composição dos lançamentos do mês atual.</p>
            </div>
          </div>
  
          <div className="result-main">
            <span>Saldo do mês</span>
  
            <strong
              className={
                currentBalance < 0 ? "negative-text" : "positive-text"
              }
            >
              {money(currentBalance)}
            </strong>
          </div>
  
          <div className="result-line">
            <span>Receitas registradas</span>
            <strong className="income-text">{money(currentRevenue)}</strong>
          </div>
  
          <div className="result-line">
            <span>Despesas registradas</span>
            <strong>{money(currentExpenses)}</strong>
          </div>
  
          <div className="result-line">
            <span>Investimentos e aplicações</span>
            <strong>{money(currentInvestments)}</strong>
          </div>
  
          <div className="result-line">
            <span>Reservas</span>
            <strong>{money(currentReserves)}</strong>
          </div>
  
          <div className="result-line total-line">
            <span>Margem sobre receitas</span>
  
            <strong className={savingsRate < 0 ? "negative-text" : ""}>
              {savingsRate.toFixed(1)}%
            </strong>
          </div>
        </article>
      </section>
    );
  }
  