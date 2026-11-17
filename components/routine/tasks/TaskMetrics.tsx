"use client";

interface TaskMetricsData {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  today: number;
  percentage: number;
}

interface TaskMetricsProps {
  metrics: TaskMetricsData;
}

export default function TaskMetrics({ metrics }: TaskMetricsProps) {
  return (
    <>
          <section className="metrics-grid">
            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Total de tarefas</span>
                <span className="metric-icon">▤</span>
              </div>
              <div className="metric-value">{metrics.total}</div>
              <div className="metric-description">Atividades cadastradas</div>
            </div>
    
            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Pendentes</span>
                <span className="metric-icon">◷</span>
              </div>
              <div className="metric-value">{metrics.pending}</div>
              <div className="metric-description">Aguardando conclusão</div>
            </div>
    
            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Concluídas</span>
                <span className="metric-icon">✓</span>
              </div>
              <div className="metric-value">{metrics.completed}</div>
              <div className="metric-description">Atividades finalizadas</div>
            </div>
    
            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Atrasadas</span>
                <span className="metric-icon">!</span>
              </div>
              <div className="metric-value overdue-value">
                {metrics.overdue}
              </div>
              <div className="metric-description">Precisam de atenção</div>
            </div>
          </section>
    
          <section className="progress-section">
            <div className="progress-info">
              <div>
                <span className="section-label">SEU DESEMPENHO</span>
                <h2>Progresso geral</h2>
                <p>
                  Você concluiu {metrics.completed} de {metrics.total} tarefas.
                </p>
              </div>
    
              <div className="progress-percentage">
                {metrics.percentage}%
              </div>
            </div>
    
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${metrics.percentage}%` }}
              />
            </div>
    
            <div className="progress-footer">
              <span>{metrics.completed} concluídas</span>
              <span>{metrics.pending} pendentes</span>
            </div>
          </section>
    </>
  );
}
