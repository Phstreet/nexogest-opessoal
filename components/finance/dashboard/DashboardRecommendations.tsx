
"use client";

type Recommendation = {
  title: string;
  description: string;
  type: "warning" | "success" | "info";
};

type DashboardRecommendationsProps = {
  recommendations: Recommendation[];
};

export default function DashboardRecommendations({
  recommendations,
}: DashboardRecommendationsProps) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <span className="section-eyebrow">PLANO DE AÇÃO</span>
          <h3>Como melhorar sua situação financeira</h3>
          <p>
            Recomendações automáticas com base nos seus lançamentos.
          </p>
        </div>
      </div>

      <div className="recommendation-list">
        {recommendations.map((item, index) => (
          <div
            className={`recommendation-item ${item.type}`}
            key={`${item.title}-${index}`}
          >
            <span className="recommendation-icon">
              {item.type === "warning"
                ? "!"
                : item.type === "success"
                  ? "✓"
                  : "i"}
            </span>

            <div>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
