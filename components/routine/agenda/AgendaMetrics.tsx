"use client";

interface AgendaMetricsProps {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
}

export default function AgendaMetrics({ total, pending, completed, overdue }: AgendaMetricsProps) {
  return (
          <section className="agenda-metrics">
            <div className="agenda-metric-card">
              <span className="metric-label">ATIVIDADES DO DIA</span>
              <strong>{total}</strong>
              <span className="metric-description">Total programado</span>
            </div>
    
            <div className="agenda-metric-card">
              <span className="metric-label">PENDENTES</span>
              <strong>{pending}</strong>
              <span className="metric-description">Aguardando conclusão</span>
            </div>
    
            <div className="agenda-metric-card">
              <span className="metric-label">CONCLUÍDAS</span>
              <strong>{completed}</strong>
              <span className="metric-description">Atividades realizadas</span>
            </div>
    
            <div className="agenda-metric-card">
              <span className="metric-label">ATRASADAS</span>
              <strong className={overdue > 0 ? "metric-danger" : ""}>
                {overdue}
              </strong>
              <span className="metric-description">Precisam de atenção</span>
            </div>
          </section>
  );
}
