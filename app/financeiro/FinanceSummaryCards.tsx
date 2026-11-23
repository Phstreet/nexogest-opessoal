import { money } from "@/lib/finance/finance-utils";

type FinanceTotals = {
  receitas: number;
  despesas: number;
  receitasRealizadas: number;
  despesasRealizadas: number;
  investimentosAplicados: number;
  resultado: number;
};

type FinanceSummaryCardsProps = {
  totals: FinanceTotals;
};

export default function FinanceSummaryCards({ totals }: FinanceSummaryCardsProps) {
  return (
    <>
      <section className="finance-cards">
        <article className="finance-card">
          <span>Receitas lançadas</span>
          <strong>{money(totals.receitas)}</strong>
          <small>Total cadastrado, inclusive pendente</small>
        </article>
        <article className="finance-card">
          <span>Despesas lançadas</span>
          <strong>{money(totals.despesas)}</strong>
          <small>Total cadastrado, inclusive pendente</small>
        </article>
        <article className="finance-card highlight">
          <span>Saldo disponível</span>
          <strong>{money(totals.resultado)}</strong>
          <small>Recebido − pago − investimentos efetivamente aplicados</small>
        </article>
      </section>

      <section className="finance-investment-summary">
        <span>◈</span>
        <div>
          <strong>Total investido</strong>
          <p>
            {money(totals.investimentosAplicados)} efetivamente aplicados.
            Investimentos pendentes não reduzem o saldo disponível.
          </p>
        </div>
      </section>
    </>
  );
}
