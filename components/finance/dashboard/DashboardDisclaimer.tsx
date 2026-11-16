
"use client";

export default function DashboardDisclaimer() {
  return (
    <section className="disclaimer">
      <span>ⓘ</span>
      <p>
        <strong>Sobre os indicadores:</strong> os valores são calculados
        com base nos lançamentos cadastrados no NEXO. O valor total do
        lançamento é utilizado nos cálculos, pois o cadastro atual não
        armazena o valor efetivamente liquidado em pagamentos parciais.
        O saldo inicial das contas é exibido separadamente e não representa
        o saldo bancário atualizado.
      </p>
    </section>
  );
}
