
import type { ReactNode } from "react";

type CategoryExpense = {
  category: string;
  amount: number;
};

type DashboardCategoriesProps = {
  categoryExpenses: CategoryExpense[];
  totalCategoryExpenses: number;
  maxCategoryValue: number;
  monthlySavingsTarget: number;
  currentInvestments: number;
  currentReserves: number;
  currentBalance: number;
  money: (value: number) => string;
};

export default function DashboardCategories({
  categoryExpenses,
  totalCategoryExpenses,
  maxCategoryValue,
  monthlySavingsTarget,
  currentInvestments,
  currentReserves,
  currentBalance,
  money,
}: DashboardCategoriesProps): ReactNode {
  return (
    <section className="main-grid category-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <span className="section-eyebrow">
              CONTROLE DE GASTOS
            </span>

            <h3>Onde você está gastando</h3>

            <p>
              Despesas agrupadas por categoria neste mês.
            </p>
          </div>
        </div>

        {categoryExpenses.length > 0 ? (
          <div className="category-list">
            {categoryExpenses.slice(0, 7).map((item) => {
              const percentage =
                totalCategoryExpenses > 0
                  ? (item.amount / totalCategoryExpenses) * 100
                  : 0;

              return (
                <div
                  className="category-item"
                  key={item.category}
                >
                  <div className="category-info">
                    <span>{item.category}</span>

                    <strong>{money(item.amount)}</strong>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${
                          (item.amount / maxCategoryValue) * 100
                        }%`,
                      }}
                    />
                  </div>

                  <span className="category-percentage">
                    {percentage.toFixed(1)}% das despesas
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <span>◈</span>

            <strong>Nenhuma despesa registrada</strong>

            <p>
              Quando você cadastrar despesas, elas aparecerão aqui.
            </p>
          </div>
        )}
      </article>

      <article className="panel economy-panel">
        <div className="panel-header">
          <div>
            <span className="section-eyebrow">
              META DE ECONOMIA
            </span>

            <h3>Quanto guardar</h3>

            <p>
              Referência de economia mensal de 10% da receita média.
            </p>
          </div>
        </div>

        <div className="economy-highlight">
          <span>Meta mensal sugerida</span>

          <strong>{money(monthlySavingsTarget)}</strong>

          <small>
            Baseada na receita média disponível no histórico.
          </small>
        </div>

        <div className="economy-row">
          <span>Investimentos e aplicações</span>

          <strong>{money(currentInvestments)}</strong>
        </div>

        <div className="economy-row">
          <span>Valores destinados a reservas</span>

          <strong>{money(currentReserves)}</strong>
        </div>

        <div className="economy-row">
          <span>Margem atual do mês</span>

          <strong
            className={
              currentBalance < 0
                ? "negative-text"
                : "positive-text"
            }
          >
            {money(currentBalance)}
          </strong>
        </div>

        <div className="economy-note">
          <span>!</span>

          A meta de 10% é uma referência inicial. Ajuste sua economia de
          acordo com suas despesas essenciais e compromissos.
        </div>
      </article>
    </section>
  );
}
