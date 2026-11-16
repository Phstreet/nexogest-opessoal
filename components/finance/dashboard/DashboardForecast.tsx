
"use client";

type ForecastMonth = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  balance: number;
  estimated?: boolean;
};

type DashboardForecastProps = {
  period: "3" | "6";
  setPeriod: (value: "3" | "6") => void;
  visibleForecast: ForecastMonth[];
  totalFutureRevenue: number;
  totalFutureExpenses: number;
  averageFutureBalance: number;
  money: (value: number) => string;
};

export default function DashboardForecast({
  period,
  setPeriod,
  visibleForecast,
  totalFutureRevenue,
  totalFutureExpenses,
  averageFutureBalance,
  money,
}: DashboardForecastProps) {
  return (
    <section className="panel forecast-panel">
      <div className="panel-header forecast-header">
        <div>
          <span className="section-eyebrow">VISÃO DE FUTURO</span>
          <h3>Projeção dos próximos meses</h3>
          <p>
            Acompanhe o que está previsto e identifique períodos que exigem
            atenção.
          </p>
        </div>

        <select
          value={period}
          onChange={(event) =>
            setPeriod(event.target.value as "3" | "6")
          }
          className="period-select"
        >
          <option value="3">Próximos 3 meses</option>
          <option value="6">Próximos 6 meses</option>
        </select>
      </div>

      <div className="forecast-table-wrapper">
        <table className="forecast-table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Receitas estimadas</th>
              <th>Despesas estimadas</th>
              <th>Resultado projetado</th>
              <th>Situação</th>
            </tr>
          </thead>

          <tbody>
            {visibleForecast.map((month) => (
              <tr key={month.key}>
                <td>
                  <strong>{month.label}</strong>

                  {month.estimated && (
                    <small className="estimate-label">
                      Estimativa
                    </small>
                  )}
                </td>

                <td className="income-text">
                  {money(month.revenue)}
                </td>

                <td>{money(month.expenses)}</td>

                <td
                  className={
                    month.balance < 0
                      ? "negative-text"
                      : "positive-text"
                  }
                >
                  {money(month.balance)}
                </td>

                <td>
                  <span
                    className={`forecast-status ${
                      month.balance < 0 ? "danger" : "safe"
                    }`}
                  >
                    {month.balance < 0 ? "Atenção" : "Positivo"}
                  </span>
                </td>
              </tr>
            ))}

            {visibleForecast.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-table">
                  Não há dados suficientes para a projeção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="forecast-summary">
        <div>
          <span>Receitas do período</span>
          <strong className="income-text">
            {money(totalFutureRevenue)}
          </strong>
        </div>

        <div>
          <span>Despesas do período</span>
          <strong>{money(totalFutureExpenses)}</strong>
        </div>

        <div>
          <span>Resultado médio mensal</span>
          <strong
            className={
              averageFutureBalance < 0
                ? "negative-text"
                : "positive-text"
            }
          >
            {money(averageFutureBalance)}
          </strong>
        </div>
      </div>

      <p className="forecast-disclaimer">
        As projeções utilizam lançamentos futuros cadastrados. Quando não
        existem lançamentos para determinado mês, o painel utiliza a média
        dos meses anteriores como estimativa. Não representa garantia de
        receita ou despesa futura.
      </p>
    </section>
  );
}
