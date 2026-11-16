
type DashboardHeaderProps = {
    currentMonthName: string;
    financialSituation: "negative" | "neutral" | "positive";
  };
  
  export default function DashboardHeader({
    currentMonthName,
    financialSituation,
  }: DashboardHeaderProps) {
    return (
      <section className="welcome-section">
        <div>
          <span className="section-eyebrow">ANÁLISE FINANCEIRA</span>
  
          <h2>
            Seu panorama de <strong>{currentMonthName}</strong>
          </h2>
  
          <p>
            Uma visão geral para ajudar você a tomar decisões melhores com
            seu dinheiro.
          </p>
        </div>
  
        <div className={`situation-badge ${financialSituation}`}>
          <span className="situation-dot" />
  
          {financialSituation === "negative"
            ? "Resultado negativo"
            : financialSituation === "positive"
              ? "Resultado positivo"
              : "Resultado equilibrado"}
        </div>
      </section>
    );
  }
  