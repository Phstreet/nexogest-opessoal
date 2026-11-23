import type { Transaction } from "@/lib/finance/types";
import {
  isValidDate,
  money,
  movementClass,
  movementIcon,
  movementValue,
} from "@/lib/finance/finance-utils";

type FinanceMovementListProps = {
  filtered: Transaction[];
  filter: string;
  filterOptions: string[];
  safeToSave: boolean;
  settlementEditingId: number | null;
  settlementInput: string;
  onFilterChange: (value: string) => void;
  onSettlementInputChange: (value: string) => void;
  onSaveSettlement: (item: Transaction) => void | Promise<void>;
  onCancelSettlement: () => void;
  onOpenSettlementEditor: (item: Transaction) => void;
  onStartEditingTransaction: (item: Transaction) => void;
  onRemoveTransaction: (id: number) => void | Promise<void>;
};

export default function FinanceMovementList({
  filtered,
  filter,
  filterOptions,
  safeToSave,
  settlementEditingId,
  settlementInput,
  onFilterChange,
  onSettlementInputChange,
  onSaveSettlement,
  onCancelSettlement,
  onOpenSettlementEditor,
  onStartEditingTransaction,
  onRemoveTransaction,
}: FinanceMovementListProps) {
  return (
    <section className="finance-history">
      <div className="finance-section-title">
        <div>
          <span className="finance-eyebrow">HISTÓRICO</span>
          <h2>Movimentações</h2>
        </div>
        <select value={filter} onChange={(event) => onFilterChange(event.target.value)}>
          <option value="Todos">Todos</option>
          {filterOptions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="finance-empty">
          <span>◎</span>
          <strong>Nenhum lançamento encontrado</strong>
          <p>Cadastre uma receita, despesa, transferência ou investimento.</p>
        </div>
      ) : (
        <div className="finance-list">
          {filtered.map((item) => (
            <article className="finance-item" key={item.id}>
              <div className="finance-item-icon">{movementIcon(item)}</div>
              <div className="finance-item-info">
                <strong>{item.description}</strong>
                <span>
                  {item.type} · {item.category || "Sem categoria"}
                  {item.subcategory ? ` / ${item.subcategory}` : ""}
                </span>
                <span>
                  {item.account || "Sem conta"}
                  {item.destinationAccount ? ` → ${item.destinationAccount}` : ""}
                </span>
                {(item.type === "Aplicação" || item.type === "Investimento") && (
                  <span>
                    {item.investment || item.subcategory || "Investimento"}
                    {" · "}
                    {item.institution || "Instituição não informada"}
                  </span>
                )}
                {item.type === "Reserva" && (
                  <span>Reserva: {item.reserveType || "Não especificada"}</span>
                )}
                <span>
                  {item.date && isValidDate(item.date)
                    ? new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")
                    : "Sem data"}
                  {" · "}
                  {item.status || "Pendente"}
                </span>
                {(item.status === "Recebida parcialmente" || item.status === "Paga parcialmente") && (
                  <span>
                    {item.status === "Recebida parcialmente" ? "Recebido: " : "Pago: "}
                    {money(Number(item.settledAmount || 0))} de {money(item.amount)}
                  </span>
                )}
              </div>

              <strong className={movementClass(item)}>
                {movementValue(item)}{money(Number(item.amount || 0))}
              </strong>

              {settlementEditingId === item.id && (
                <div className="finance-settlement-editor">
                  <label htmlFor={`settlement-${item.id}`}>
                    {item.type === "Receita" ? "Valor realmente recebido" : "Valor realmente pago"}
                  </label>
                  <div className="finance-settlement-controls">
                    <input
                      id={`settlement-${item.id}`}
                      type="text"
                      inputMode="decimal"
                      value={settlementInput}
                      onChange={(event) => onSettlementInputChange(event.target.value)}
                      placeholder="0,00"
                      aria-label={item.type === "Receita" ? "Valor recebido" : "Valor pago"}
                    />
                    <button type="button" className="finance-edit" onClick={() => onSaveSettlement(item)} disabled={!safeToSave}>
                      Confirmar
                    </button>
                    <button type="button" className="finance-cancel-edit" onClick={onCancelSettlement}>
                      Cancelar
                    </button>
                  </div>
                  <small>
                    Valor previsto: {money(item.amount)}. Se informar um valor menor,
                    o lançamento ficará parcialmente {item.type === "Receita" ? "recebido" : "pago"}.
                  </small>
                </div>
              )}

              <div className="finance-item-actions">
                {(item.type === "Receita" || item.type === "Despesa") &&
                  ["Pendente", "Recebida parcialmente", "Paga parcialmente", "Prevista", "Atrasada", ""].includes(item.status || "") && (
                    <button
                      type="button"
                      className="finance-edit"
                      onClick={() => onOpenSettlementEditor(item)}
                      disabled={!safeToSave}
                      aria-label={item.type === "Receita" ? "Informar valor recebido" : "Informar valor pago"}
                    >
                      {item.status === "Recebida parcialmente" || item.status === "Paga parcialmente"
                        ? "Atualizar valor"
                        : item.type === "Receita" ? "Receber" : "Pagar"}
                    </button>
                  )}
                {(item.type === "Receita" || item.type === "Despesa") && (
                  <button
                    type="button"
                    className="finance-edit"
                    onClick={() => onStartEditingTransaction(item)}
                    aria-label={`Editar ${item.description}`}
                    disabled={!safeToSave}
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  className="finance-delete"
                  onClick={() => onRemoveTransaction(item.id)}
                  aria-label={`Excluir ${item.description}`}
                  disabled={!safeToSave}
                >
                  ×
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
