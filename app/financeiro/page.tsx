"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type FormMovementType =
  | "Receita"
  | "Despesa"
  | "Transferência"
  | "Investimento";

type MovementType = FormMovementType | "Aplicação" | "Reserva";

type Transaction = {
  id: number;
  description: string;
  type: MovementType;
  amount: number;
  date?: string;
  category?: string;
  subcategory?: string;
  account?: string;
  destinationAccount?: string;
  paymentMethod?: string;
  status?: string;
  recurrence?: string;
  reserveType?: string;
  investment?: string;
  institution?: string;
};

const STORAGE_KEY = "nexo_transactions";

const categoriesByType: Record<FormMovementType, string[]> = {
  Receita: [
    "Salário", "13º Salário", "Adiantamento Salarial",
    "Horas Extras", "Comissões", "Trabalhos Extras",
    "Reembolsos", "Receitas Eventuais", "Rendimentos", "Outros",
  ],
  Despesa: [
    "Moradia", "Alimentação", "Transporte", "Saúde",
    "Educação", "Lazer", "Serviços", "Assinaturas",
    "Religião", "Impostos", "Dívidas", "Outros",
  ],
  Transferência: ["Transferência"],
  Investimento: ["Investimento"],
};

const subcategories: Record<string, string[]> = {
  Salário: ["Salário mensal", "Adiantamento", "Outros"],
  "13º Salário": ["Primeira parcela", "Segunda parcela", "Integral", "Outros"],
  "Adiantamento Salarial": ["Adiantamento", "Outros"],
  "Horas Extras": ["Horas extras", "DSR", "Outros"],
  Comissões: ["Comissão", "Outros"],
  "Trabalhos Extras": ["Serviços extras", "Freelance", "Outros"],
  Reembolsos: ["Reembolso de despesas", "Outros"],
  "Receitas Eventuais": ["Venda", "Presente", "Outros"],
  Rendimentos: ["Rendimento de conta", "Rendimento financeiro", "Outros"],
  Moradia: [
    "Aluguel", "Condomínio", "Energia", "Água", "Internet",
    "Gás", "Manutenção", "Móveis", "Casa", "Outros",
  ],
  Alimentação: [
    "Mercado", "Restaurante", "iFood", "Keeta",
    "99 Food", "Lanches", "Outros",
  ],
  Transporte: [
    "Combustível", "Transporte público", "Aplicativos",
    "Estacionamento", "Manutenção do veículo", "Carro", "Outros",
  ],
  Saúde: [
    "Plano de saúde", "Consulta", "Exames",
    "Medicamentos", "Odontologia", "Outros",
  ],
  Educação: ["Cursos", "Material escolar", "Livros", "Notebook", "Outros"],
  Lazer: ["Viagem", "Cinema", "Passeios", "Eventos", "Televisão", "Outros"],
  Serviços: ["Telefonia", "Internet", "Manutenção", "Serviços domésticos", "Outros"],
  Assinaturas: ["Streaming", "Telefonia", "Aplicativos", "Outros"],
  Religião: ["Dízimo", "Oferta", "Doação", "Caixinha", "Outros"],
  Impostos: ["IPVA", "IPTU", "Imposto de renda", "Multas", "Outros"],
  Dívidas: [
    "Empréstimo", "Cartão de crédito",
    "Financiamento", "Parcelamento", "Outros",
  ],
  Outros: ["Notebook", "Televisão", "Carro", "Casa", "Viagem", "Outros"],
  Transferência: ["Entre contas"],
};

const investmentOptions = [
  "CDB", "LCI", "LCA", "Tesouro Direto", "Ações",
  "Fundos imobiliários (FIIs)", "Fundos de investimento",
  "Renda fixa", "Renda variável", "Criptomoedas",
  "Previdência privada", "Outros",
];

const institutions = [
  "Nubank", "Banco Inter", "Itaú", "Bradesco",
  "Banco do Brasil", "Caixa Econômica Federal",
  "Santander", "C6 Bank", "BTG Pactual",
  "XP Investimentos", "Rico", "Clear",
  "Mercado Pago", "PicPay", "Outra instituição",
];

const movementTypes: FormMovementType[] = [
  "Receita", "Despesa", "Transferência", "Investimento",
];

const accounts = [
  "Conta Corrente", "Poupança",
  "Dinheiro em Espécie", "Carteira Digital",
];

const paymentMethods = [
  "Dinheiro", "Débito", "Crédito", "PIX", "Transferência", "Boleto",
];

const statuses = [
  "Prevista", "Pendente", "Recebida parcialmente",
  "Paga parcialmente", "Recebida", "Pago",
  "Aplicado", "Atrasada", "Cancelada",
];

const recurrences = [
  "Nenhuma", "Semanal", "Quinzenal", "Mensal",
  "Bimestral", "Trimestral", "Semestral", "Anual",
];

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, "");

  if (!normalized) return NaN;

  if (normalized.includes(",")) {
    return Number(normalized.replace(/\./g, "").replace(",", "."));
  }

  return Number(normalized);
}

function localDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="finance-field">
      <label>{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function getDefaultCategory(type: FormMovementType) {
  if (type === "Receita") return "Salário";
  if (type === "Despesa") return "Moradia";
  if (type === "Investimento") return "Investimento";

  return "Transferência";
}

function getDefaultSubcategory(category: string) {
  return subcategories[category]?.[0] || "Outros";
}

function isInvestmentApplied(item: Transaction) {
  if (item.status === "Cancelada" || item.status === "Pendente") {
    return false;
  }

  return item.type === "Investimento" || item.type === "Aplicação";
}

export default function Page() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<FormMovementType>("Despesa");
  const [category, setCategory] = useState("Moradia");
  const [subcategory, setSubcategory] = useState("Aluguel");
  const [date, setDate] = useState("");
  const [account, setAccount] = useState("Conta Corrente");
  const [destinationAccount, setDestinationAccount] = useState("Poupança");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [status, setStatus] = useState("Pendente");
  const [recurrence, setRecurrence] = useState("Nenhuma");
  const [institution, setInstitution] = useState("Nubank");
  const [filter, setFilter] = useState("Todos");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDate(localDate());

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setTransactions(parsed as Transaction[]);
        }
      }
    } catch (error) {
      console.error("Não foi possível carregar os lançamentos.", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(transactions)
      );
    } catch (error) {
      console.error("Não foi possível salvar os lançamentos.", error);
    }
  }, [transactions, loaded]);

  const availableCategories = categoriesByType[type];

  const availableSubcategories =
    type === "Investimento"
      ? investmentOptions
      : subcategories[category] || ["Outros"];

  function changeType(value: string) {
    const newType = value as FormMovementType;
    const newCategory = getDefaultCategory(newType);

    setType(newType);
    setCategory(newCategory);

    if (newType === "Investimento") {
      setSubcategory(investmentOptions[0]);
      setStatus("Aplicado");
    } else {
      setSubcategory(getDefaultSubcategory(newCategory));
      setStatus("Pendente");
    }
  }

  function changeCategory(value: string) {
    setCategory(value);
    setSubcategory(getDefaultSubcategory(value));
  }

  const totals = useMemo(() => {
    const active = transactions.filter(
      (item) => item.status !== "Cancelada"
    );

    const receitas = active
      .filter((item) => item.type === "Receita")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const despesas = active
      .filter((item) => item.type === "Despesa")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const investimentosAplicados = active
      .filter(isInvestmentApplied)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      receitas,
      despesas,
      investimentosAplicados,
      resultado: receitas - despesas - investimentosAplicados,
    };
  }, [transactions]);

  const filterOptions = useMemo(() => {
    const existingTypes = transactions
      .map((item) => item.type)
      .filter(
        (item) => item === "Aplicação" || item === "Reserva"
      );

    return [...movementTypes, ...Array.from(new Set(existingTypes))];
  }, [transactions]);

  const filtered = transactions.filter(
    (item) => filter === "Todos" || item.type === filter
  );

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = parseAmount(amount);

    if (
      !description.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      window.alert("Preencha a descrição e informe um valor válido.");
      return;
    }

    if (type === "Transferência" && account === destinationAccount) {
      window.alert("Escolha contas diferentes para origem e destino.");
      return;
    }

    if (type === "Investimento" && !institution.trim()) {
      window.alert("Selecione a instituição financeira do investimento.");
      return;
    }

    const investmentDestination =
      type === "Investimento"
        ? `Investimento: ${subcategory} - ${institution}`
        : undefined;

    const newTransaction: Transaction = {
      id: Date.now(),
      description: description.trim(),
      type,
      amount: parsedAmount,
      date: date || localDate(),
      category:
        type === "Transferência" || type === "Investimento"
          ? type
          : category,
      subcategory:
        type === "Transferência" ? "Entre contas" : subcategory,
      account,
      destinationAccount:
        type === "Transferência"
          ? destinationAccount
          : investmentDestination,
      paymentMethod,
      status,
      recurrence,
      investment: type === "Investimento" ? subcategory : undefined,
      institution: type === "Investimento" ? institution : undefined,
    };

    setTransactions((current) => [newTransaction, ...current]);

    setDescription("");
    setAmount("");
    setType("Despesa");
    setCategory("Moradia");
    setSubcategory("Aluguel");
    setStatus("Pendente");
    setRecurrence("Nenhuma");
    setDate(localDate());
  }

  function removeTransaction(id: number) {
    if (!window.confirm("Deseja excluir este lançamento?")) return;

    setTransactions((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  function movementIcon(item: Transaction) {
    if (item.type === "Receita") return "↗";
    if (item.type === "Despesa") return "↙";

    if (item.type === "Aplicação" || item.type === "Investimento") {
      return "◈";
    }

    if (item.type === "Reserva") return "▣";

    return "⇄";
  }

  function movementValue(item: Transaction) {
    if (item.type === "Receita") return "+";
    if (item.type === "Despesa") return "-";

    if (
      (item.type === "Investimento" || item.type === "Aplicação") &&
      isInvestmentApplied(item)
    ) {
      return "-";
    }

    return "";
  }

  function movementClass(item: Transaction) {
    if (item.type === "Receita") return "income";
    if (item.type === "Despesa") return "expense";

    if (item.type === "Aplicação" || item.type === "Investimento") {
      return "investment-movement";
    }

    if (item.type === "Reserva") return "reserve-movement";

    return "";
  }

  return (
    <>
      <div className="content finance-content-vertical">
        <section className="finance-intro">
          <div>
            <span className="finance-eyebrow">
              GESTÃO E CONTROLE FINANCEIRO
            </span>
            <h2>Organize sua vida financeira.</h2>
            <p>
              Acompanhe suas receitas, despesas, transferências e
              investimentos em um só lugar.
            </p>
          </div>
        </section>

        <section className="finance-cards">
          <article className="finance-card">
            <span>Receitas lançadas</span>
            <strong>{money(totals.receitas)}</strong>
            <small>Total não cancelado</small>
          </article>

          <article className="finance-card">
            <span>Despesas lançadas</span>
            <strong>{money(totals.despesas)}</strong>
            <small>Total não cancelado</small>
          </article>

          <article className="finance-card highlight">
            <span>Saldo disponível</span>
            <strong>{money(totals.resultado)}</strong>
            <small>
              Receitas − despesas − investimentos aplicados
            </small>
          </article>
        </section>

        <section className="finance-investment-summary">
          <span>◈</span>
          <div>
            <strong>Total investido</strong>
            <p>
              {money(totals.investimentosAplicados)} retirados do saldo
              disponível e destinados aos investimentos.
            </p>
          </div>
        </section>

        <form
          className="finance-form finance-form-compact"
          onSubmit={addTransaction}
        >
          <div className="finance-section-title">
            <div>
              <span className="finance-eyebrow">CADASTRO</span>
              <h2>Novo lançamento</h2>
            </div>
          </div>

          <div className="finance-fields-grid">
            <div className="finance-field field-description">
              <label>Descrição</label>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
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
                onChange={(event) => setAmount(event.target.value)}
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
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>

            <SelectField
              label={
                type === "Transferência" || type === "Investimento"
                  ? "Conta de origem"
                  : "Conta financeira"
              }
              value={account}
              onChange={setAccount}
              options={accounts}
            />

            {type === "Transferência" && (
              <SelectField
                label="Conta de destino"
                value={destinationAccount}
                onChange={setDestinationAccount}
                options={accounts}
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
              onChange={setStatus}
              options={
                type === "Investimento"
                  ? ["Aplicado", "Pendente", "Cancelada"]
                  : statuses
              }
            />

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
                  registrado como patrimônio investido, sem ser contabilizado
                  como despesa.
                </p>
              </div>
            </div>
          )}

          <div className="finance-form-actions">
            <button type="submit">
              {type === "Investimento"
                ? "+ Registrar investimento"
                : "+ Adicionar lançamento"}
            </button>
          </div>
        </form>

        <section className="finance-history">
          <div className="finance-section-title">
            <div>
              <span className="finance-eyebrow">HISTÓRICO</span>
              <h2>Movimentações</h2>
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="Todos">Todos</option>
              {filterOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="finance-empty">
              <span>◎</span>
              <strong>Nenhum lançamento encontrado</strong>
              <p>
                Cadastre uma receita, despesa, transferência ou investimento.
              </p>
            </div>
          ) : (
            <div className="finance-list">
              {filtered.map((item) => (
                <article className="finance-item" key={item.id}>
                  <div className="finance-item-icon">
                    {movementIcon(item)}
                  </div>

                  <div className="finance-item-info">
                    <strong>{item.description}</strong>
                    <span>
                      {item.type} · {item.category || "Sem categoria"}
                      {item.subcategory ? ` / ${item.subcategory}` : ""}
                    </span>
                    <span>
                      {item.account || "Sem conta"}
                      {item.destinationAccount
                        ? ` → ${item.destinationAccount}`
                        : ""}
                    </span>

                    {(item.type === "Aplicação" ||
                      item.type === "Investimento") && (
                      <span>
                        {item.investment ||
                          item.subcategory ||
                          "Investimento"}
                        {" · "}
                        {item.institution || "Instituição não informada"}
                      </span>
                    )}

                    {item.type === "Reserva" && (
                      <span>
                        Reserva: {item.reserveType || "Não especificada"}
                      </span>
                    )}

                    <span>
                      {item.date
                        ? new Date(
                            item.date + "T12:00:00"
                          ).toLocaleDateString("pt-BR")
                        : "Sem data"}
                      {" · "}
                      {item.status || "Pendente"}
                    </span>
                  </div>

                  <strong className={movementClass(item)}>
                    {movementValue(item)}
                    {money(Number(item.amount || 0))}
                  </strong>

                  <button
                    type="button"
                    className="finance-delete"
                    onClick={() => removeTransaction(item.id)}
                    aria-label={`Excluir ${item.description}`}
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="routine-footer">
          <span>© 2026 NEXO — GESTÃO PESSOAL</span>
          <span>PLANEJE. ORGANIZE. CONQUISTE.</span>
        </footer>
      </div>

      <style jsx global>{`
        .finance-content-vertical {
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: flex-start !important;
          width: 100% !important;
          max-width: none !important;
          gap: 12px !important;
          box-sizing: border-box;
        }

        .finance-intro {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          min-height: 125px;
          padding: 22px 25px;
          border: 1px solid #35353a;
          border-radius: 9px;
          background: linear-gradient(100deg, #222326 0%, #171719 60%, #101012 100%);
        }

        .finance-intro h2 {
          margin: 8px 0 5px;
          color: #f0f0f2;
          font-family: var(--font-heading);
          font-size: clamp(20px, 2.2vw, 27px);
          font-weight: 800;
          letter-spacing: -0.8px;
        }

        .finance-intro p {
          margin: 0;
          color: #a1a2a8;
          font-size: 11px;
          line-height: 1.6;
        }

        .finance-eyebrow {
          color: #9298a2;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .finance-cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          width: 100%;
          margin: 0;
        }

        .finance-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          min-height: 105px;
          padding: 16px;
          gap: 5px;
          border: 1px solid #2c2c31;
          border-radius: 8px;
          background: linear-gradient(145deg, #1b1b1e, #131315);
        }

        .finance-card span {
          color: #a5a6ac;
          font-size: 11px;
        }

        .finance-card strong {
          color: #f0f0f2;
          font-family: var(--font-heading);
          font-size: clamp(17px, 2vw, 22px);
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .finance-card small {
          color: #777980;
          font-size: 9px;
        }

        .finance-card.highlight {
          border-color: #50545d;
          background: linear-gradient(145deg, #24262b, #17181b);
        }

        .finance-investment-summary {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 16px;
          border: 1px solid #303034;
          border-radius: 8px;
          background: #151517;
        }

        .finance-investment-summary > span {
          color: #d0d3d9;
          font-size: 21px;
        }

        .finance-investment-summary strong {
          display: block;
          color: #e6e7ea;
          font-size: 11px;
        }

        .finance-investment-summary p {
          margin: 4px 0 0;
          color: #a5a5ad;
          font-size: 10px;
          line-height: 1.5;
        }

        .finance-form {
          display: flex;
          flex-direction: column;
          width: 100%;
          min-width: 0;
          padding: 16px;
          gap: 12px;
          margin: 0;
          border: 1px solid #2c2c31;
          border-radius: 8px;
          background: linear-gradient(145deg, #19191c, #131315);
          box-sizing: border-box;
        }

        .finance-form-compact {
          padding: 15px 16px;
        }

        .finance-section-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 4px;
        }

        .finance-section-title h2 {
          margin: 5px 0 0;
          color: #f0f0f2;
          font-family: var(--font-heading);
          font-size: 15px;
          font-weight: 700;
        }

        .finance-fields-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          align-items: end;
          gap: 10px;
        }

        .finance-fields-grid .finance-field {
          display: flex;
          flex-direction: column;
          min-width: 0;
          gap: 5px;
        }

        .finance-fields-grid .field-description {
          grid-column: span 2;
        }

        .finance-fields-grid .finance-field label {
          display: block;
          margin: 0;
          color: #a7a8ae;
          font-size: 10px;
          font-weight: 600;
        }

        .finance-fields-grid input,
        .finance-fields-grid select {
          width: 100%;
          min-width: 0;
          height: 34px;
          min-height: 34px;
          padding: 0 9px;
          border: 1px solid #37373d;
          border-radius: 6px;
          outline: none;
          background: #101012;
          color: #f3f3f5;
          font-family: inherit;
          font-size: 11px;
          color-scheme: dark;
          box-sizing: border-box;
        }

        .finance-fields-grid input:focus,
        .finance-fields-grid select:focus {
          border-color: #aeb4be;
          box-shadow: 0 0 0 2px rgba(190, 195, 205, 0.08);
        }

        .finance-fields-grid input[readonly] {
          color: #c5c7cc;
          background: #202024;
          cursor: default;
        }

        .investment-destination-field {
          grid-column: span 2;
        }

        .investment-info {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 3px;
          padding: 11px 13px;
          border: 1px solid #34343a;
          border-radius: 7px;
          background: #171719;
        }

        .investment-info-icon {
          color: #d1d4da;
          font-size: 19px;
          line-height: 1;
        }

        .investment-info strong {
          display: block;
          margin-bottom: 4px;
          color: #e6e7ea;
          font-size: 11px;
        }

        .investment-info p {
          margin: 0;
          color: #a5a5ad;
          font-size: 10px;
          line-height: 1.5;
        }

        .finance-form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 2px;
        }

        .finance-form-actions button {
          min-height: 35px;
          padding: 0 15px;
          border: 1px solid #aeb3bc;
          border-radius: 5px;
          background: linear-gradient(135deg, #e1e3e7, #9da3ad);
          color: #111214;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition);
        }

        .finance-form-actions button:hover {
          filter: brightness(1.12);
          transform: translateY(-1px);
        }

        .finance-history {
          display: flex;
          flex-direction: column;
          width: 100%;
          min-width: 0;
          padding: 16px;
          margin: 0;
          border: 1px solid #2c2c31;
          border-radius: 8px;
          background: linear-gradient(145deg, #19191c, #131315);
          box-sizing: border-box;
        }

        .finance-history .finance-section-title {
          margin-bottom: 12px;
        }

        .finance-history .finance-section-title select {
          height: 32px;
          min-height: 32px;
          padding: 0 9px;
          border: 1px solid #37373d;
          border-radius: 6px;
          outline: none;
          background: #101012;
          color: #f3f3f5;
          font-family: inherit;
          font-size: 10px;
          color-scheme: dark;
        }

        .finance-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .finance-item {
          display: flex;
          align-items: center;
          min-width: 0;
          min-height: 55px;
          gap: 11px;
          padding: 10px 11px;
          border: 1px solid #29292e;
          border-radius: 7px;
          background: #151517;
        }

        .finance-item-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border: 1px solid #41444c;
          border-radius: 7px;
          background: #22242a;
          color: #d2d5db;
          font-size: 15px;
        }

        .finance-item-info {
          display: flex;
          flex: 1;
          flex-direction: column;
          min-width: 0;
          gap: 3px;
        }

        .finance-item-info strong {
          overflow: hidden;
          color: #e1e3e7;
          font-size: 11px;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .finance-item-info span {
          overflow: hidden;
          color: #858b95;
          font-size: 9px;
          line-height: 1.4;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .finance-item > strong {
          flex-shrink: 0;
          color: #d7d9de;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .finance-item > strong.income {
          color: #a8c7b3;
        }

        .finance-item > strong.expense,
        .finance-item > strong.investment-movement {
          color: #d18c8c;
        }

        .finance-item > strong.reserve-movement {
          color: #c3c7ce;
        }

        .finance-delete {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 27px;
          height: 27px;
          border: 1px solid #39393f;
          border-radius: 5px;
          background: transparent;
          color: #999da5;
          font-size: 17px;
          cursor: pointer;
          transition: var(--transition);
        }

        .finance-delete:hover {
          border-color: #9c6262;
          background: rgba(160, 70, 70, 0.12);
          color: #e3a0a0;
        }

        .finance-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 145px;
          padding: 20px 12px;
          text-align: center;
          color: #777d87;
        }

        .finance-empty span {
          color: #b4bbc5;
          font-size: 25px;
        }

        .finance-empty strong {
          margin-top: 8px;
          color: #c5c9d0;
          font-size: 11px;
          font-weight: 500;
        }

        .finance-empty p {
          margin: 5px 0 0;
          color: #858b95;
          font-size: 9px;
        }

        @media (max-width: 1100px) {
          .finance-fields-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .finance-content-vertical {
            gap: 10px !important;
          }

          .finance-intro {
            min-height: 110px;
            padding: 18px;
          }

          .finance-cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .finance-card.highlight {
            grid-column: span 2;
          }

          .finance-fields-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .finance-intro {
            padding: 17px;
          }

          .finance-intro h2 {
            font-size: 20px;
          }

          .finance-intro p {
            font-size: 10px;
          }

          .finance-cards {
            grid-template-columns: 1fr;
          }

          .finance-card.highlight {
            grid-column: span 1;
          }

          .finance-card {
            min-height: 75px;
            padding: 12px 14px;
          }

          .finance-fields-grid {
            grid-template-columns: 1fr;
            gap: 9px;
          }

          .finance-fields-grid .field-description,
          .investment-destination-field {
            grid-column: span 1;
          }

          .finance-form,
          .finance-history {
            padding: 12px;
          }

          .finance-form-actions button {
            width: 100%;
          }

          .finance-item {
            flex-wrap: wrap;
            gap: 8px;
          }

          .finance-item-info {
            flex: 1;
            min-width: 0;
          }

          .finance-item > strong {
            margin-left: 42px;
          }

          .finance-history .finance-section-title {
            align-items: flex-start;
          }

          .finance-investment-summary {
            align-items: flex-start;
          }
        }
      `}</style>
    </>
  );
}