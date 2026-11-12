
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

const financeNavigation = [
  { label: "Visão geral", href: "/financeiro", icon: "⌂" },
  { label: "Contas", href: "/financeiro/contas", icon: "▣" },
  { label: "Contas a pagar", href: "/financeiro/contas-a-pagar", icon: "↓" },
  { label: "Contas a receber", href: "/financeiro/contas-a-receber", icon: "↑" },
  { label: "Histórico financeiro", href: "/financeiro/historico", icon: "↻" },
  { label: "Investimentos", href: "/financeiro/investimentos", icon: "◈" },
  { label: "Reserva financeira", href: "/financeiro/reservas", icon: "▣" },
  { label: "Planejamento", href: "/financeiro/planejamento", icon: "▤" },
  { label: "Dashboard financeiro", href: "/financeiro/dashboard", icon: "▥" },
];

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
  "Salário": ["Salário mensal", "Adiantamento", "Outros"],
  "13º Salário": ["Primeira parcela", "Segunda parcela", "Integral", "Outros"],
  "Adiantamento Salarial": ["Adiantamento", "Outros"],
  "Horas Extras": ["Horas extras", "DSR", "Outros"],
  "Comissões": ["Comissão", "Outros"],
  "Trabalhos Extras": ["Serviços extras", "Freelance", "Outros"],
  "Reembolsos": ["Reembolso de despesas", "Outros"],
  "Receitas Eventuais": ["Venda", "Presente", "Outros"],
  "Rendimentos": ["Rendimento de conta", "Rendimento financeiro", "Outros"],
  "Moradia": [
    "Aluguel", "Condomínio", "Energia", "Água", "Internet",
    "Gás", "Manutenção", "Móveis", "Casa", "Outros",
  ],
  "Alimentação": [
    "Mercado", "Restaurante", "iFood", "Keeta", "99 Food", "Lanches", "Outros",
  ],
  "Transporte": [
    "Combustível", "Transporte público", "Aplicativos",
    "Estacionamento", "Manutenção do veículo", "Carro", "Outros",
  ],
  "Saúde": [
    "Plano de saúde", "Consulta", "Exames", "Medicamentos", "Odontologia", "Outros",
  ],
  "Educação": ["Cursos", "Material escolar", "Livros", "Notebook", "Outros"],
  "Lazer": ["Viagem", "Cinema", "Passeios", "Eventos", "Televisão", "Outros"],
  "Serviços": ["Telefonia", "Internet", "Manutenção", "Serviços domésticos", "Outros"],
  "Assinaturas": ["Streaming", "Telefonia", "Aplicativos", "Outros"],
  "Religião": ["Dízimo", "Oferta", "Doação", "Caixinha", "Outros"],
  "Impostos": ["IPVA", "IPTU", "Imposto de renda", "Multas", "Outros"],
  "Dívidas": [
    "Empréstimo", "Cartão de crédito", "Financiamento", "Parcelamento", "Outros",
  ],
  "Outros": ["Notebook", "Televisão", "Carro", "Casa", "Viagem", "Outros"],
  "Transferência": ["Entre contas"],
};

const investmentOptions = [
  "CDB", "LCI", "LCA", "Tesouro Direto", "Ações",
  "Fundos imobiliários (FIIs)", "Fundos de investimento",
  "Renda fixa", "Renda variável", "Criptomoedas",
  "Previdência privada", "Outros",
];

const institutions = [
  "Nubank", "Banco Inter", "Itaú", "Bradesco",
  "Banco do Brasil", "Caixa Econômica Federal", "Santander",
  "C6 Bank", "BTG Pactual", "XP Investimentos",
  "Rico", "Clear", "Mercado Pago", "PicPay", "Outra instituição",
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
  "Paga parcialmente", "Recebida", "Pago", "Aplicado",
  "Atrasada", "Cancelada",
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
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
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

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<FormMovementType>("Despesa");
  const [category, setCategory] = useState("Moradia");
  const [subcategory, setSubcategory] = useState("Aluguel");
  const [date, setDate] = useState(localDate());
  const [account, setAccount] = useState("Conta Corrente");
  const [destinationAccount, setDestinationAccount] = useState("Poupança");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [status, setStatus] = useState("Pendente");
  const [recurrence, setRecurrence] = useState("Nenhuma");
  const [institution, setInstitution] = useState("Nubank");
  const [filter, setFilter] = useState("Todos");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setTransactions(parsed);
      }
    } catch {
      console.error("Não foi possível carregar os lançamentos.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
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
      .filter((item) => item === "Aplicação" || item === "Reserva");

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
      alert("Preencha a descrição e informe um valor válido.");
      return;
    }

    if (type === "Transferência" && account === destinationAccount) {
      alert("Escolha contas diferentes para origem e destino.");
      return;
    }

    if (type === "Investimento" && !institution.trim()) {
      alert("Selecione a instituição financeira do investimento.");
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
      date,
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
    if (!confirm("Deseja excluir este lançamento?")) return;
    setTransactions((current) => current.filter((item) => item.id !== id));
  }

  function movementIcon(item: Transaction) {
    if (item.type === "Receita") return "↗";
    if (item.type === "Despesa") return "↙";
    if (item.type === "Aplicação" || item.type === "Investimento") return "◈";
    if (item.type === "Reserva") return "▣";
    return "⇄";
  }

  function movementValue(item: Transaction) {
    if (item.type === "Receita") return "+";
    if (item.type === "Despesa") return "-";

    if (
      (item.type === "Investimento" || item.type === "Aplicação") &&
      isInvestmentApplied(item)
    ) return "-";

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
    <main className="finance-page finance-page-compact">
      <header className="finance-header">
        <div>
          <Link href="/" className="finance-back">← Voltar ao início</Link>
          <span className="finance-eyebrow">NEXO / GESTÃO FINANCEIRA</span>
          <h1>Financeiro</h1>
          <p>Controle suas receitas, despesas, transferências e investimentos.</p>
        </div>

        <div className="finance-date">
          {new Date().toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
      </header>

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
          <small>Receitas − despesas − investimentos aplicados</small>
        </article>
      </section>

      <section className="finance-investment-summary">
        <span>◈</span>
        <div>
          <strong>Total investido</strong>
          <p>
            {money(totals.investimentosAplicados)} retirados do saldo disponível
            e destinados aos investimentos.
          </p>
        </div>
      </section>

      <nav className="finance-module-nav" aria-label="Navegação financeira">
        {financeNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              item.href === "/financeiro"
                ? "finance-module-link active"
                : "finance-module-link"
            }
            aria-current={item.href === "/financeiro" ? "page" : undefined}
          >
            <span className="finance-module-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <section className="finance-content finance-content-vertical">
        <form className="finance-form finance-form-compact" onSubmit={addTransaction}>
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
                <strong>Investimento — saída do saldo disponível</strong>
                <p>
                  Ao registrar como aplicado, o valor será descontado da conta
                  de origem e do saldo disponível. Ele continuará registrado
                  como patrimônio investido, sem ser contabilizado como despesa.
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
                      {item.destinationAccount
                        ? ` → ${item.destinationAccount}`
                        : ""}
                    </span>

                    {(item.type === "Aplicação" ||
                      item.type === "Investimento") && (
                      <span>
                        {item.investment || item.subcategory || "Investimento"}
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
                        ? new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")
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
      </section>

      <footer className="finance-footer">
        NEXO · Planeje. Organize. Conquiste.
      </footer>

      <style jsx global>{`
        .finance-page-compact {
          padding: 18px 28px !important;
          gap: 9px !important;
        }

        .finance-page-compact .finance-header {
          margin-bottom: 0 !important;
          gap: 8px !important;
        }

        .finance-page-compact .finance-header h1 {
          font-size: 25px !important;
          margin: 4px 0 2px !important;
        }

        .finance-page-compact .finance-header p {
          font-size: 12px !important;
          margin: 0 !important;
        }

        .finance-page-compact .finance-back {
          font-size: 11px !important;
          margin-bottom: 5px !important;
        }

        .finance-page-compact .finance-eyebrow {
          font-size: 9px !important;
          letter-spacing: 1px !important;
        }

        .finance-page-compact .finance-cards {
          gap: 9px !important;
          margin: 0 !important;
        }

        .finance-page-compact .finance-card {
          padding: 11px 15px !important;
          min-height: 82px !important;
          gap: 3px !important;
        }

        .finance-page-compact .finance-card span {
          font-size: 11px !important;
        }

        .finance-page-compact .finance-card strong {
          font-size: 19px !important;
        }

        .finance-page-compact .finance-card small {
          font-size: 10px !important;
        }

        .finance-investment-summary {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          margin-top: 8px;
          border: 1px solid #303034;
          border-radius: 9px;
          background: #151517;
        }

        .finance-investment-summary > span {
          font-size: 20px;
          color: #d0d3d9;
        }

        .finance-investment-summary strong {
          display: block;
          font-size: 11px;
          color: #e6e7ea;
        }

        .finance-investment-summary p {
          margin: 3px 0 0;
          font-size: 10px;
          color: #a5a5ad;
        }

        .finance-module-nav {
          display: flex;
          align-items: stretch;
          flex-wrap: wrap;
          gap: 8px;
          width: 100%;
          margin: 9px 0 0;
          padding: 11px;
          border: 1px solid #29292d;
          border-radius: 11px;
          background: #111113;
          box-sizing: border-box;
        }

        .finance-module-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 37px;
          padding: 0 13px;
          border: 1px solid #303034;
          border-radius: 7px;
          color: #a5a5ab;
          background: #171719;
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .finance-module-link:hover,
        .finance-module-link.active {
          color: #f5f5f6;
          border-color: #777d87;
          background: #29292d;
        }

        .finance-module-icon {
          color: #c3c7ce;
          font-size: 15px;
          line-height: 1;
        }

        .finance-content.finance-content-vertical {
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: flex-start !important;
          width: 100% !important;
          max-width: none !important;
          gap: 8px !important;
          margin: 18px 0 0 !important;
        }

        .finance-content-vertical > .finance-form,
        .finance-content-vertical > .finance-history {
          display: block;
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          flex: 0 0 auto !important;
          box-sizing: border-box;
        }

        .finance-form-compact {
          padding: 10px 14px !important;
          gap: 6px !important;
          margin-bottom: 0 !important;
        }

        .finance-form-compact .finance-section-title {
          margin-bottom: 0 !important;
        }

        .finance-page-compact .finance-section-title h2 {
          font-size: 15px !important;
          margin: 2px 0 0 !important;
        }

        .finance-fields-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px 8px !important;
          align-items: end;
        }

        .finance-fields-grid .finance-field {
          display: flex;
          flex-direction: column;
          gap: 2px !important;
          min-width: 0;
        }

        .finance-fields-grid .field-description {
          grid-column: span 2;
        }

        .finance-fields-grid .finance-field label {
          display: block;
          margin: 0;
          font-size: 10px !important;
          font-weight: 600;
          letter-spacing: 0.2px;
        }

        .finance-fields-grid input,
        .finance-fields-grid select {
          width: 100%;
          min-width: 0;
          height: 30px !important;
          min-height: 30px !important;
          padding: 0 8px !important;
          font-size: 11px !important;
          border-radius: 6px !important;
          box-sizing: border-box;
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
          margin-top: 5px;
          padding: 10px 12px;
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
          color: #e6e7ea;
          font-size: 11px;
          margin-bottom: 3px;
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
          margin-top: 0 !important;
        }

        .finance-form-actions button {
          min-height: 30px !important;
          padding: 0 14px !important;
          font-size: 11px !important;
          border-radius: 6px !important;
        }

        .finance-history {
          padding: 12px 15px !important;
          margin-top: 0 !important;
        }

        .finance-history .finance-section-title {
          margin-bottom: 8px !important;
        }

        .finance-history .finance-section-title select {
          height: 29px !important;
          min-height: 29px !important;
          padding: 0 8px !important;
          font-size: 11px !important;
        }

        .finance-list {
          gap: 5px !important;
        }

        .finance-item {
          padding: 8px 10px !important;
          gap: 9px !important;
          min-height: 0 !important;
        }

        .finance-item-icon {
          width: 30px !important;
          height: 30px !important;
          min-width: 30px !important;
          font-size: 14px !important;
        }

        .finance-item-info {
          gap: 2px !important;
        }

        .finance-item-info strong {
          font-size: 12px !important;
        }

        .finance-item-info span {
          font-size: 10px !important;
          line-height: 1.3 !important;
        }

        .finance-item > strong {
          font-size: 12px !important;
          white-space: nowrap;
        }

        .finance-delete {
          width: 25px !important;
          height: 25px !important;
          font-size: 16px !important;
        }

        .finance-empty {
          padding: 18px 12px !important;
        }

        .finance-empty span {
          font-size: 24px !important;
        }

        .finance-empty strong {
          font-size: 12px !important;
        }

        .finance-empty p {
          font-size: 10px !important;
          margin-top: 4px !important;
        }

        .finance-page-compact .finance-footer {
          margin-top: 0 !important;
          padding: 8px 0 !important;
          font-size: 10px !important;
        }

        @media (max-width: 900px) {
          .finance-page-compact {
            padding: 16px !important;
          }

          .finance-fields-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .finance-fields-grid .field-description {
            grid-column: span 2;
          }

          .finance-module-nav {
            gap: 7px;
          }
        }

        @media (max-width: 520px) {
          .finance-page-compact {
            padding: 12px !important;
            gap: 8px !important;
          }

          .finance-page-compact .finance-header {
            flex-direction: column;
            align-items: flex-start !important;
          }

          .finance-page-compact .finance-date {
            font-size: 10px !important;
          }

          .finance-page-compact .finance-cards {
            grid-template-columns: 1fr !important;
          }

          .finance-page-compact .finance-card {
            min-height: 68px !important;
          }

          .finance-module-nav {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            padding: 9px;
          }

          .finance-module-link {
            justify-content: flex-start;
            min-width: 0;
            padding: 0 9px;
            font-size: 10px;
            white-space: normal;
          }

          .finance-module-icon {
            flex-shrink: 0;
          }

          .finance-content.finance-content-vertical {
            gap: 7px !important;
          }

          .finance-form-compact,
          .finance-history {
            padding: 10px !important;
          }

          .finance-fields-grid {
            grid-template-columns: 1fr;
            gap: 7px !important;
          }

          .finance-fields-grid .field-description,
          .investment-destination-field {
            grid-column: span 1;
          }

          .finance-form-actions button {
            width: 100%;
          }

          .finance-item {
            flex-wrap: wrap;
          }

          .finance-item-info {
            flex: 1;
            min-width: 0;
          }
        }
      `}</style>
    </main>
  );
}
