
type DashboardSummaryProps = {
    money: (value: number) => string;
    currentRevenue: number;
    currentExpenses: number;
    currentBalance: number;
    currentConfirmedRevenue: number;
    currentConfirmedExpenses: number;
    availableToSpend: number;
  };
  
  export default function DashboardSummary({
    money,
    currentRevenue,
    currentExpenses,
    currentBalance,
    currentConfirmedRevenue,
    currentConfirmedExpenses,
    availableToSpend,
  }: DashboardSummaryProps) {
    return (
      <section className="summary-grid">
        <article className="summary-card">
          <div className="card-top">
            <span className="card-label">Receitas do mês</span>
            <span className="card-icon income">↑</span>
          </div>
  
          <strong className="card-value income-text">
            {money(currentRevenue)}
          </strong>
  
          <span className="card-description">
            {money(currentConfirmedRevenue)} com status recebido
          </span>
        </article>
  
        <article className="summary-card">
          <div className="card-top">
            <span className="card-label">Despesas do mês</span>
            <span className="card-icon expense">↓</span>
          </div>
  
          <strong className="card-value">
            {money(currentExpenses)}
          </strong>
  
          <span className="card-description">
            {money(currentConfirmedExpenses)} com status pago
          </span>
        </article>
  
        <article className="summary-card">
          <div className="card-top">
            <span className="card-label">Resultado do mês</span>
            <span className="card-icon result">∑</span>
          </div>
  
          <strong
            className={`card-value ${
              currentBalance < 0 ? "negative-text" : "positive-text"
            }`}
          >
            {money(currentBalance)}
          </strong>
  
          <span className="card-description">
            Receitas menos despesas, investimentos e reservas
          </span>
        </article>
  
        <article className="summary-card">
          <div className="card-top">
            <span className="card-label">Limite recomendado</span>
            <span className="card-icon limit">◎</span>
          </div>
  
          <strong className="card-value">
            {money(availableToSpend)}
          </strong>
  
          <span className="card-description">
            Estimativa disponível para novas despesas neste mês
          </span>
        </article>
      </section>
    );
  }
  