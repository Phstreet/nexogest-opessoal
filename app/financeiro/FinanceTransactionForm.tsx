"use client";

import type { FormEvent, RefObject } from "react";
import SelectField from "./SelectField";
import type { FormMovementType } from "@/lib/finance/finance-utils";

type FinanceTransactionFormProps = {
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  editingTransactionId: number | null;
  description: string;
  setDescription: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  type: FormMovementType;
  changeType: (value: string) => void;
  movementTypes: string[];
  category: string;
  changeCategory: (value: string) => void;
  availableCategories: string[];
  subcategory: string;
  setSubcategory: (value: string) => void;
  availableSubcategories: string[];
  investmentOptions: string[];
  institution: string;
  setInstitution: (value: string) => void;
  institutions: string[];
  paymentMethods: string[];
  date: string;
  setDate: (value: string) => void;
  account: string;
  setAccount: (value: string) => void;
  accountOptions: string[];
  destinationAccount: string;
  setDestinationAccount: (value: string) => void;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  settledAmount: string;
  setSettledAmount: (value: string) => void;
  recurrence: string;
  setRecurrence: (value: string) => void;
  recurrences: string[];
  safeToSave: boolean;
  onCancelEditing: () => void;
};

export default function FinanceTransactionForm({
  formRef,
  onSubmit,
  editingTransactionId,
  description,
  setDescription,
  amount,
  setAmount,
  type,
  changeType,
  movementTypes,
  category,
  changeCategory,
  availableCategories,
  subcategory,
  setSubcategory,
  availableSubcategories,
  investmentOptions,
  institution,
  setInstitution,
  institutions,
  paymentMethods,
  date,
  setDate,
  account,
  setAccount,
  accountOptions,
  destinationAccount,
  setDestinationAccount,
  paymentMethod,
  setPaymentMethod,
  status,
  setStatus,
  settledAmount,
  setSettledAmount,
  recurrence,
  setRecurrence,
  recurrences,
  safeToSave,
  onCancelEditing,
}: FinanceTransactionFormProps) {
  return (
        <form
          ref={formRef}
          className="finance-form finance-form-compact"
          onSubmit={onSubmit}
        >
          <div className="finance-section-title">
            <div>
              <span className="finance-eyebrow">
                {editingTransactionId !== null ? "EDIÇÃO INDIVIDUAL" : "CADASTRO"}
              </span>
              <h2>
                {editingTransactionId !== null
                  ? "Editar lançamento"
                  : "Novo lançamento"}
              </h2>
            </div>
          </div>

          <div className="finance-fields-grid">
            <div className="finance-field field-description">
              <label>Descrição</label>

              <input
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder={
                  type === "Investimento"
                    ? "Ex.: Aplicação em CDB"
                    : "Ex.: Salário, aluguel, mercado..."
                }
                required
              />
            </div>

            <SelectField
              label="Tipo"
              value={type}
              onChange={changeType}
              options={movementTypes}
            />

            <div className="finance-field">
              <label>Valor (R$)</label>

              <input
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder="0,00"
                inputMode="decimal"
                required
              />
            </div>

            {type !== "Transferência" && (
              <>
                {type === "Investimento" ? (
                  <>
                    <div className="finance-field">
                      <label>Categoria</label>
                      <input value="Investimento" readOnly />
                    </div>

                    <SelectField
                      label="Tipo de investimento"
                      value={subcategory}
                      onChange={setSubcategory}
                      options={investmentOptions}
                    />

                    <SelectField
                      label="Banco / Instituição"
                      value={institution}
                      onChange={setInstitution}
                      options={institutions}
                    />
                  </>
                ) : (
                  <>
                    <SelectField
                      label="Categoria"
                      value={category}
                      onChange={changeCategory}
                      options={availableCategories}
                    />

                    <SelectField
                      label="Subcategoria"
                      value={subcategory}
                      onChange={setSubcategory}
                      options={availableSubcategories}
                    />
                  </>
                )}
              </>
            )}

            <div className="finance-field">
              <label>Data do lançamento</label>

              <input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(event.target.value)
                }
                required
              />
            </div>

            <SelectField
              label={
                type === "Receita"
                  ? "Conta de recebimento"
                  : type === "Despesa"
                    ? "Conta de pagamento"
                    : "Conta de origem"
              }
              value={account}
              onChange={setAccount}
              options={accountOptions}
              helper={
                type === "Receita"
                  ? "Salário, adiantamento ou 13º: ao marcar como Recebida, o valor entra no saldo desta conta."
                  : type === "Despesa"
                    ? "Ao marcar a despesa como paga, o valor será descontado desta conta."
                    : type === "Transferência"
                      ? "Conta de onde o dinheiro será retirado."
                      : "Conta de onde sairá o valor aplicado."
              }
            />

            {type === "Transferência" && (
              <SelectField
                label="Conta de destino"
                value={destinationAccount}
                onChange={setDestinationAccount}
                options={accountOptions}
                helper="Ao marcar a transferência como Realizada, o valor será acrescentado ao saldo desta conta."
              />
            )}

            {type === "Investimento" && (
              <div className="finance-field investment-destination-field">
                <label>Destino do valor</label>

                <input
                  value={`${subcategory} - ${institution}`}
                  readOnly
                />
              </div>
            )}

            <SelectField
              label="Forma de pagamento"
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={paymentMethods}
            />

            <SelectField
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);

                if (
                  value !== "Recebida parcialmente" &&
                  value !== "Paga parcialmente"
                ) {
                  setSettledAmount("");
                }
              }}
              options={
                type === "Investimento"
                  ? ["Aplicado", "Pendente", "Cancelada"]
                  : type === "Receita"
                    ? [
                        "Prevista",
                        "Pendente",
                        "Recebida parcialmente",
                        "Recebida",
                        "Atrasada",
                        "Cancelada",
                      ]
                    : type === "Despesa"
                      ? [
                          "Prevista",
                          "Pendente",
                          "Paga parcialmente",
                          "Pago",
                          "Atrasada",
                          "Cancelada",
                        ]
                      : ["Pendente", "Realizada", "Cancelada"]
              }
            />

            {(status === "Recebida parcialmente" ||
              status === "Paga parcialmente") && (
              <div className="finance-field">
                <label>
                  {status === "Recebida parcialmente"
                    ? "Valor já recebido (R$)"
                    : "Valor já pago (R$)"}
                </label>

                <input
                  value={settledAmount}
                  onChange={(event) =>
                    setSettledAmount(event.target.value)
                  }
                  placeholder="0,00"
                  inputMode="decimal"
                  required
                />
              </div>
            )}

            <SelectField
              label="Recorrência"
              value={recurrence}
              onChange={setRecurrence}
              options={recurrences}
            />
          </div>

          {type === "Investimento" && (
            <div className="investment-info">
              <span className="investment-info-icon">◈</span>

              <div>
                <strong>
                  Investimento — saída do saldo disponível
                </strong>

                <p>
                  Ao registrar como aplicado, o valor será descontado
                  da conta de origem e do saldo disponível. Ele continuará
                  registrado como patrimônio investido, sem ser
                  contabilizado como despesa.
                </p>
              </div>
            </div>
          )}

          <div className="finance-form-actions">
            {editingTransactionId !== null && (
              <button
                type="button"
                className="finance-cancel-edit"
                onClick={onCancelEditing}
              >
                Cancelar edição
              </button>
            )}
            <button type="submit" disabled={!safeToSave}>
              {editingTransactionId !== null
                ? "Salvar alterações"
                : type === "Investimento"
                  ? "+ Registrar investimento"
                  : "+ Adicionar lançamento"}
            </button>
          </div>
        </form>


  );
}
