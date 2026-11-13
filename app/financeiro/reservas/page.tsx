
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ReserveCategory =
  | "Emergência"
  | "Objetivo pessoal"
  | "Moradia"
  | "Viagem"
  | "Investimentos"
  | "Outros";

type ReserveStatus = "Ativa" | "Concluída" | "Pausada";
type MovementType = "Aporte" | "Resgate" | "Rendimento" | "Ajuste";

type Account = {
  id: number;
  name: string;
  institution?: string;
  active?: boolean;
};

type Reserve = {
  id: number;
  name: string;
  category: ReserveCategory;
  description: string;
  targetAmount: number;
  initialBalance: number;
  monthlyContribution: number;
  startDate: string;
  targetDate: string;
  accountId: number | null;
  institution: string;
  status: ReserveStatus;
  createdAt: string;
};

type ReserveMovement = {
  id: number;
  reserveId: number;
  type: MovementType;
  amount: number;
  date: string;
  description: string;
  createdAt: string;
};

const RESERVES_KEY = "nexo_reserves";
const MOVEMENTS_KEY = "nexo_reserve_movements";
const ACCOUNTS_KEY = "nexo_accounts";

const categories: ReserveCategory[] = [
  "Emergência",
  "Objetivo pessoal",
  "Moradia",
  "Viagem",
  "Investimentos",
  "Outros",
];

const movementTypes: MovementType[] = [
  "Aporte",
  "Resgate",
  "Rendimento",
  "Ajuste",
];

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const emptyReserveForm = {
  name: "",
  category: "Emergência" as ReserveCategory,
  description: "",
  targetAmount: "",
  initialBalance: "0",
  monthlyContribution: "0",
  startDate: getLocalDate(),
  targetDate: "",
  accountId: "",
  institution: "",
  status: "Ativa" as ReserveStatus,
};

const emptyMovementForm = {
  type: "Aporte" as MovementType,
  amount: "",
  date: getLocalDate(),
  description: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR");
}

function getReserveBalance(
  reserve: Reserve,
  movements: ReserveMovement[]
) {
  return movements
    .filter((movement) => movement.reserveId === reserve.id)
    .reduce((balance, movement) => {
      if (
        movement.type === "Aporte" ||
        movement.type === "Rendimento" ||
        movement.type === "Ajuste"
      ) {
        return balance + movement.amount;
      }

      if (movement.type === "Resgate") {
        return balance - movement.amount;
      }

      return balance;
    }, reserve.initialBalance);
}

function getMovementColor(type: MovementType) {
  if (type === "Resgate") return "negative";
  if (type === "Aporte" || type === "Rendimento") return "positive";
  return "neutral";
}

export default function ReservasFinanceirasPage() {
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [movements, setMovements] = useState<ReserveMovement[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [showReserveForm, setShowReserveForm] = useState(false);
  const [editingReserveId, setEditingReserveId] = useState<number | null>(null);
  const [reserveForm, setReserveForm] = useState(emptyReserveForm);

  const [selectedReserveId, setSelectedReserveId] = useState<number | null>(null);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [showMovementForm, setShowMovementForm] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    try {
      const storedReserves = localStorage.getItem(RESERVES_KEY);
      const storedMovements = localStorage.getItem(MOVEMENTS_KEY);
      const storedAccounts = localStorage.getItem(ACCOUNTS_KEY);

      if (storedReserves) {
        const parsed = JSON.parse(storedReserves);
        if (Array.isArray(parsed)) setReserves(parsed);
      }

      if (storedMovements) {
        const parsed = JSON.parse(storedMovements);
        if (Array.isArray(parsed)) setMovements(parsed);
      }

      if (storedAccounts) {
        const parsed = JSON.parse(storedAccounts);

        if (Array.isArray(parsed)) {
          setAccounts(
            parsed.map((account: Account) => ({
              id: Number(account.id),
              name: account.name || "Conta sem nome",
              institution: account.institution || "",
              active: account.active !== false,
            }))
          );
        }
      }
    } catch (error) {
      console.error("Erro ao carregar reservas financeiras:", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;

    try {
      localStorage.setItem(RESERVES_KEY, JSON.stringify(reserves));
      localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements));
    } catch (error) {
      console.error("Erro ao salvar reservas financeiras:", error);
      setFeedback("Não foi possível salvar os dados no navegador.");
    }
  }, [reserves, movements, loaded]);

  const selectedReserve = useMemo(
    () => reserves.find((reserve) => reserve.id === selectedReserveId) || null,
    [reserves, selectedReserveId]
  );

  const reserveBalances = useMemo(
    () =>
      reserves.map((reserve) => ({
        reserve,
        balance: getReserveBalance(reserve, movements),
      })),
    [reserves, movements]
  );

  const totalBalance = reserveBalances.reduce(
    (total, item) => total + item.balance,
    0
  );

  const totalGoals = reserves.reduce(
    (total, reserve) => total + reserve.targetAmount,
    0
  );

  const totalRemaining = reserveBalances.reduce(
    (total, item) =>
      total + Math.max(item.reserve.targetAmount - item.balance, 0),
    0
  );

  const totalMonthlyContribution = reserves
    .filter((reserve) => reserve.status === "Ativa")
    .reduce((total, reserve) => total + reserve.monthlyContribution, 0);

  const completedGoals = reserveBalances.filter(
    (item) =>
      item.reserve.targetAmount > 0 &&
      item.balance >= item.reserve.targetAmount
  ).length;

  const totalContributions = movements
    .filter((movement) => movement.type === "Aporte")
    .reduce((total, movement) => total + movement.amount, 0);

  const totalWithdrawals = movements
    .filter((movement) => movement.type === "Resgate")
    .reduce((total, movement) => total + movement.amount, 0);

  const totalEarnings = movements
    .filter((movement) => movement.type === "Rendimento")
    .reduce((total, movement) => total + movement.amount, 0);

  const filteredReserves = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return reserveBalances.filter(({ reserve }) => {
      const matchesSearch =
        reserve.name.toLowerCase().includes(normalizedSearch) ||
        reserve.description.toLowerCase().includes(normalizedSearch) ||
        reserve.institution.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "Todas" || reserve.category === categoryFilter;

      const matchesStatus =
        statusFilter === "Todos" || reserve.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [reserveBalances, search, categoryFilter, statusFilter]);

  const selectedMovements = useMemo(() => {
    if (selectedReserveId === null) return [];

    return movements
      .filter((movement) => movement.reserveId === selectedReserveId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [movements, selectedReserveId]);

  function updateReserveField(
    field: keyof typeof emptyReserveForm,
    value: string
  ) {
    setReserveForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetReserveForm() {
    setReserveForm({
      ...emptyReserveForm,
      startDate: getLocalDate(),
    });
    setEditingReserveId(null);
    setShowReserveForm(false);
  }

  function handleReserveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const targetAmount = Number(reserveForm.targetAmount);
    const initialBalance = Number(reserveForm.initialBalance || 0);
    const monthlyContribution = Number(
      reserveForm.monthlyContribution || 0
    );

    if (!reserveForm.name.trim()) {
      setFeedback("Informe o nome da reserva.");
      return;
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setFeedback("Informe uma meta financeira válida.");
      return;
    }

    if (
      initialBalance < 0 ||
      monthlyContribution < 0 ||
      !Number.isFinite(initialBalance) ||
      !Number.isFinite(monthlyContribution)
    ) {
      setFeedback("Informe valores válidos para o saldo e o aporte mensal.");
      return;
    }

    const accountId = reserveForm.accountId
      ? Number(reserveForm.accountId)
      : null;

    const account = accounts.find((item) => item.id === accountId);

    if (editingReserveId !== null) {
      setReserves((current) =>
        current.map((reserve) =>
          reserve.id === editingReserveId
            ? {
                ...reserve,
                name: reserveForm.name.trim(),
                category: reserveForm.category,
                description: reserveForm.description.trim(),
                targetAmount,
                monthlyContribution,
                startDate: reserveForm.startDate,
                targetDate: reserveForm.targetDate,
                accountId,
                institution:
                  reserveForm.institution.trim() ||
                  account?.institution ||
                  "",
                status: reserveForm.status,
              }
            : reserve
        )
      );

      setFeedback("Reserva atualizada com sucesso.");
    } else {
      const newReserve: Reserve = {
        id: Date.now(),
        name: reserveForm.name.trim(),
        category: reserveForm.category,
        description: reserveForm.description.trim(),
        targetAmount,
        initialBalance,
        monthlyContribution,
        startDate: reserveForm.startDate,
        targetDate: reserveForm.targetDate,
        accountId,
        institution:
          reserveForm.institution.trim() || account?.institution || "",
        status: reserveForm.status,
        createdAt: new Date().toISOString(),
      };

      setReserves((current) => [newReserve, ...current]);
      setFeedback("Reserva cadastrada com sucesso.");
    }

    resetReserveForm();
  }

  function handleEditReserve(reserve: Reserve) {
    setEditingReserveId(reserve.id);

    setReserveForm({
      name: reserve.name,
      category: reserve.category,
      description: reserve.description,
      targetAmount: String(reserve.targetAmount),
      initialBalance: String(reserve.initialBalance),
      monthlyContribution: String(reserve.monthlyContribution),
      startDate: reserve.startDate,
      targetDate: reserve.targetDate,
      accountId:
        reserve.accountId !== null ? String(reserve.accountId) : "",
      institution: reserve.institution,
      status: reserve.status,
    });

    setShowReserveForm(true);
    setShowMovementForm(false);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDeleteReserve(reserve: Reserve) {
    const confirmed = window.confirm(
      `Deseja realmente excluir a reserva "${reserve.name}" e todo o seu histórico de movimentações?`
    );

    if (!confirmed) return;

    setReserves((current) =>
      current.filter((item) => item.id !== reserve.id)
    );

    setMovements((current) =>
      current.filter((item) => item.reserveId !== reserve.id)
    );

    if (selectedReserveId === reserve.id) {
      setSelectedReserveId(null);
    }

    setFeedback("Reserva excluída.");
  }

  function openMovementForm(reserveId: number) {
    setSelectedReserveId(reserveId);
    setMovementForm({
      ...emptyMovementForm,
      date: getLocalDate(),
    });
    setShowMovementForm(true);
    setShowReserveForm(false);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleMovementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedReserve) {
      setFeedback("Selecione uma reserva.");
      return;
    }

    const amount = Number(movementForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setFeedback("Informe um valor de movimentação válido.");
      return;
    }

    const currentBalance = getReserveBalance(selectedReserve, movements);

    if (movementForm.type === "Resgate" && amount > currentBalance) {
      setFeedback(
        `Saldo insuficiente. Disponível: ${formatCurrency(currentBalance)}.`
      );
      return;
    }

    if (
      movementForm.type === "Ajuste" &&
      currentBalance - amount < 0
    ) {
      setFeedback("O ajuste não pode deixar o saldo da reserva negativo.");
      return;
    }

    const newMovement: ReserveMovement = {
      id: Date.now(),
      reserveId: selectedReserve.id,
      type: movementForm.type,
      amount,
      date: movementForm.date,
      description: movementForm.description.trim(),
      createdAt: new Date().toISOString(),
    };

    setMovements((current) => [newMovement, ...current]);
    setShowMovementForm(false);
    setMovementForm({
      ...emptyMovementForm,
      date: getLocalDate(),
    });

    setFeedback(`${movementForm.type} registrado com sucesso.`);
  }

  function handleDeleteMovement(movement: ReserveMovement) {
    const confirmed = window.confirm(
      "Deseja excluir esta movimentação?"
    );

    if (!confirmed) return;

    setMovements((current) =>
      current.filter((item) => item.id !== movement.id)
    );

    setFeedback("Movimentação excluída.");
  }

  function getAccountName(accountId: number | null) {
    if (accountId === null) return "Não vinculada";

    return (
      accounts.find((account) => account.id === accountId)?.name ||
      "Conta não encontrada"
    );
  }

  function getProgress(balance: number, target: number) {
    if (target <= 0) return 0;

    return Math.min(Math.max((balance / target) * 100, 0), 100);
  }

  function getEstimatedMonths(balance: number, reserve: Reserve) {
    const remaining = reserve.targetAmount - balance;

    if (remaining <= 0) return 0;
    if (reserve.monthlyContribution <= 0) return null;

    return Math.ceil(remaining / reserve.monthlyContribution);
  }

  const activeReserves = reserves.filter(
    (reserve) => reserve.status === "Ativa"
  ).length;

  return (
    <div className="content reserves-content">
      <div className="page-description">
        Organize suas reservas, acompanhe suas metas e controle seus aportes e
        resgates.
      </div>

      {!loaded ? (
        <div className="loading-state">
          Carregando reservas financeiras...
        </div>
      ) : (
        <>
          {feedback && (
            <div className="feedback-message" role="status">
              <span>{feedback}</span>
              <button
                type="button"
                onClick={() => setFeedback("")}
                aria-label="Fechar mensagem"
              >
                ×
              </button>
            </div>
          )}

          <section className="summary-grid">
            <article className="summary-card main-summary">
              <div className="summary-top">
                <span>Patrimônio reservado</span>
                <span className="summary-icon">◈</span>
              </div>
              <strong>{formatCurrency(totalBalance)}</strong>
              <small>Saldo atual de todas as reservas</small>
            </article>

            <article className="summary-card">
              <div className="summary-top">
                <span>Meta total</span>
                <span className="summary-icon">◎</span>
              </div>
              <strong>{formatCurrency(totalGoals)}</strong>
              <small>{reserves.length} reserva(s) cadastrada(s)</small>
            </article>

            <article className="summary-card">
              <div className="summary-top">
                <span>Valor para alcançar as metas</span>
                <span className="summary-icon">↗</span>
              </div>
              <strong>{formatCurrency(totalRemaining)}</strong>
              <small>Saldo que falta acumular</small>
            </article>

            <article className="summary-card">
              <div className="summary-top">
                <span>Aporte mensal planejado</span>
                <span className="summary-icon">▤</span>
              </div>
              <strong>{formatCurrency(totalMonthlyContribution)}</strong>
              <small>Considerando reservas ativas</small>
            </article>
          </section>

          <section className="secondary-summary">
            <div className="secondary-item">
              <span>Reservas ativas</span>
              <strong>{activeReserves}</strong>
            </div>

            <div className="secondary-item">
              <span>Metas alcançadas</span>
              <strong>{completedGoals}</strong>
            </div>

            <div className="secondary-item">
              <span>Total aportado</span>
              <strong className="positive">
                {formatCurrency(totalContributions)}
              </strong>
            </div>

            <div className="secondary-item">
              <span>Total resgatado</span>
              <strong className="negative">
                {formatCurrency(totalWithdrawals)}
              </strong>
            </div>

            <div className="secondary-item">
              <span>Rendimentos registrados</span>
              <strong className="positive">
                {formatCurrency(totalEarnings)}
              </strong>
            </div>
          </section>

          <section className="content-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">CONTROLE DE METAS</span>
                <h2>Minhas reservas</h2>
                <p>
                  Acompanhe o saldo e a evolução de cada objetivo financeiro.
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (showReserveForm) {
                    resetReserveForm();
                  } else {
                    setEditingReserveId(null);
                    setReserveForm({
                      ...emptyReserveForm,
                      startDate: getLocalDate(),
                    });
                    setShowReserveForm(true);
                    setShowMovementForm(false);
                  }
                }}
              >
                <span>＋</span>
                Nova reserva
              </button>
            </div>

            {showReserveForm && (
              <form className="form-card" onSubmit={handleReserveSubmit}>
                <div className="form-heading">
                  <div>
                    <h3>
                      {editingReserveId !== null
                        ? "Editar reserva"
                        : "Cadastrar reserva"}
                    </h3>
                    <p>Preencha os dados do seu objetivo financeiro.</p>
                  </div>

                  <button
                    type="button"
                    className="close-button"
                    onClick={resetReserveForm}
                    aria-label="Fechar formulário"
                  >
                    ×
                  </button>
                </div>

                <div className="form-grid">
                  <div className="field field-wide">
                    <label htmlFor="reserve-name">Nome da reserva *</label>
                    <input
                      id="reserve-name"
                      type="text"
                      value={reserveForm.name}
                      onChange={(event) =>
                        updateReserveField("name", event.target.value)
                      }
                      placeholder="Ex.: Reserva de emergência"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="reserve-category">Categoria *</label>
                    <select
                      id="reserve-category"
                      value={reserveForm.category}
                      onChange={(event) =>
                        updateReserveField("category", event.target.value)
                      }
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="reserve-status">Status</label>
                    <select
                      id="reserve-status"
                      value={reserveForm.status}
                      onChange={(event) =>
                        updateReserveField("status", event.target.value)
                      }
                    >
                      <option value="Ativa">Ativa</option>
                      <option value="Pausada">Pausada</option>
                      <option value="Concluída">Concluída</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="reserve-target">Valor da meta *</label>
                    <input
                      id="reserve-target"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={reserveForm.targetAmount}
                      onChange={(event) =>
                        updateReserveField("targetAmount", event.target.value)
                      }
                      placeholder="0,00"
                      required
                    />
                  </div>

                  {editingReserveId === null && (
                    <div className="field">
                      <label htmlFor="reserve-initial">Saldo inicial</label>
                      <input
                        id="reserve-initial"
                        type="number"
                        min="0"
                        step="0.01"
                        value={reserveForm.initialBalance}
                        onChange={(event) =>
                          updateReserveField(
                            "initialBalance",
                            event.target.value
                          )
                        }
                        placeholder="0,00"
                      />
                    </div>
                  )}

                  <div className="field">
                    <label htmlFor="reserve-monthly">
                      Aporte mensal planejado
                    </label>
                    <input
                      id="reserve-monthly"
                      type="number"
                      min="0"
                      step="0.01"
                      value={reserveForm.monthlyContribution}
                      onChange={(event) =>
                        updateReserveField(
                          "monthlyContribution",
                          event.target.value
                        )
                      }
                      placeholder="0,00"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="reserve-start">Data de início</label>
                    <input
                      id="reserve-start"
                      type="date"
                      value={reserveForm.startDate}
                      onChange={(event) =>
                        updateReserveField("startDate", event.target.value)
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="reserve-target-date">Previsão da meta</label>
                    <input
                      id="reserve-target-date"
                      type="date"
                      value={reserveForm.targetDate}
                      onChange={(event) =>
                        updateReserveField("targetDate", event.target.value)
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="reserve-account">Conta vinculada</label>
                    <select
                      id="reserve-account"
                      value={reserveForm.accountId}
                      onChange={(event) =>
                        updateReserveField("accountId", event.target.value)
                      }
                    >
                      <option value="">Nenhuma conta vinculada</option>
                      {accounts
                        .filter((account) => account.active !== false)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>

                    {accounts.length === 0 && (
                      <small className="field-hint">
                        Cadastre contas no módulo Contas para vinculá-las aqui.
                      </small>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="reserve-institution">
                      Instituição financeira
                    </label>
                    <input
                      id="reserve-institution"
                      type="text"
                      value={reserveForm.institution}
                      onChange={(event) =>
                        updateReserveField("institution", event.target.value)
                      }
                      placeholder="Ex.: Banco Inter"
                    />
                  </div>

                  <div className="field field-full">
                    <label htmlFor="reserve-description">Descrição</label>
                    <textarea
                      id="reserve-description"
                      rows={3}
                      value={reserveForm.description}
                      onChange={(event) =>
                        updateReserveField("description", event.target.value)
                      }
                      placeholder="Descreva o objetivo desta reserva..."
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetReserveForm}
                  >
                    Cancelar
                  </button>

                  <button type="submit" className="primary-button">
                    {editingReserveId !== null
                      ? "Salvar alterações"
                      : "Cadastrar reserva"}
                  </button>
                </div>
              </form>
            )}

            {showMovementForm && selectedReserve && (
              <form
                className="form-card movement-form"
                onSubmit={handleMovementSubmit}
              >
                <div className="form-heading">
                  <div>
                    <span className="section-eyebrow">
                      MOVIMENTAÇÃO FINANCEIRA
                    </span>
                    <h3>{selectedReserve.name}</h3>
                    <p>
                      Saldo disponível:{" "}
                      <strong>
                        {formatCurrency(
                          getReserveBalance(selectedReserve, movements)
                        )}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    className="close-button"
                    onClick={() => setShowMovementForm(false)}
                    aria-label="Fechar formulário"
                  >
                    ×
                  </button>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="movement-type">
                      Tipo de movimentação *
                    </label>
                    <select
                      id="movement-type"
                      value={movementForm.type}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          type: event.target.value as MovementType,
                        }))
                      }
                    >
                      {movementTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="movement-amount">Valor *</label>
                    <input
                      id="movement-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={movementForm.amount}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))
                      }
                      placeholder="0,00"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="movement-date">Data *</label>
                    <input
                      id="movement-date"
                      type="date"
                      value={movementForm.date}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="movement-description">Descrição</label>
                    <input
                      id="movement-description"
                      type="text"
                      value={movementForm.description}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Ex.: Aporte referente ao mês"
                    />
                  </div>
                </div>

                <p className="form-note">
                  Esta movimentação será registrada no controle da reserva.
                  Ela ainda não altera automaticamente o saldo da conta
                  vinculada nem gera lançamento no histórico financeiro.
                </p>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowMovementForm(false)}
                  >
                    Cancelar
                  </button>

                  <button type="submit" className="primary-button">
                    Registrar movimentação
                  </button>
                </div>
              </form>
            )}

            <div className="filters-bar">
              <div className="search-field">
                <span>⌕</span>
                <input
                  type="search"
                  placeholder="Buscar reserva..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filtrar por categoria"
              >
                <option value="Todas">Todas as categorias</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar por status"
              >
                <option value="Todos">Todos os status</option>
                <option value="Ativa">Ativas</option>
                <option value="Pausada">Pausadas</option>
                <option value="Concluída">Concluídas</option>
              </select>
            </div>

            {filteredReserves.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◈</div>
                <h3>Nenhuma reserva encontrada</h3>
                <p>
                  Cadastre sua primeira reserva financeira para começar a
                  acompanhar suas metas.
                </p>
                {!showReserveForm && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setEditingReserveId(null);
                      setReserveForm({
                        ...emptyReserveForm,
                        startDate: getLocalDate(),
                      });
                      setShowReserveForm(true);
                      setShowMovementForm(false);
                    }}
                  >
                    Criar primeira reserva
                  </button>
                )}
              </div>
            ) : (
              <div className="reserve-grid">
                {filteredReserves.map(({ reserve, balance }) => {
                  const progress = getProgress(
                    balance,
                    reserve.targetAmount
                  );

                  const remaining = Math.max(
                    reserve.targetAmount - balance,
                    0
                  );

                  const estimatedMonths = getEstimatedMonths(
                    balance,
                    reserve
                  );

                  return (
                    <article className="reserve-card" key={reserve.id}>
                      <div className="reserve-card-header">
                        <div className="reserve-category-icon">◈</div>

                        <div className="reserve-card-title">
                          <span>{reserve.category}</span>
                          <h3>{reserve.name}</h3>
                        </div>

                        <span
                          className={`status-badge ${reserve.status.toLowerCase()}`}
                        >
                          {reserve.status}
                        </span>
                      </div>

                      {reserve.description && (
                        <p className="reserve-description">
                          {reserve.description}
                        </p>
                      )}

                      <div className="reserve-balance">
                        <span>Saldo acumulado</span>
                        <strong>{formatCurrency(balance)}</strong>
                      </div>

                      <div className="progress-info">
                        <span>Progresso da meta</span>
                        <strong>{progress.toFixed(1)}%</strong>
                      </div>

                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="reserve-values">
                        <div>
                          <span>Meta</span>
                          <strong>{formatCurrency(reserve.targetAmount)}</strong>
                        </div>

                        <div>
                          <span>Falta acumular</span>
                          <strong>{formatCurrency(remaining)}</strong>
                        </div>
                      </div>

                      <div className="reserve-details">
                        <div>
                          <span>Aporte mensal</span>
                          <strong>
                            {formatCurrency(reserve.monthlyContribution)}
                          </strong>
                        </div>

                        <div>
                          <span>Previsão</span>
                          <strong>
                            {reserve.targetDate
                              ? formatDate(reserve.targetDate)
                              : estimatedMonths === null
                                ? "Não definida"
                                : estimatedMonths === 0
                                  ? "Meta alcançada"
                                  : `Em ${estimatedMonths} mês(es)`}
                          </strong>
                        </div>

                        <div>
                          <span>Conta vinculada</span>
                          <strong>{getAccountName(reserve.accountId)}</strong>
                        </div>

                        <div>
                          <span>Instituição</span>
                          <strong>{reserve.institution || "—"}</strong>
                        </div>
                      </div>

                      <div className="reserve-actions">
                        <button
                          type="button"
                          className="action-button highlight"
                          onClick={() => openMovementForm(reserve.id)}
                        >
                          ＋ Movimentar
                        </button>

                        <button
                          type="button"
                          className="action-button"
                          onClick={() => {
                            setSelectedReserveId(reserve.id);
                            setShowMovementForm(false);
                            setShowReserveForm(false);
                          }}
                        >
                          Histórico
                        </button>

                        <button
                          type="button"
                          className="action-button"
                          onClick={() => handleEditReserve(reserve)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="action-button delete-action"
                          onClick={() => handleDeleteReserve(reserve)}
                          aria-label={`Excluir ${reserve.name}`}
                        >
                          Excluir
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {selectedReserve && !showMovementForm && (
            <section className="content-section history-section">
              <div className="section-heading">
                <div>
                  <span className="section-eyebrow">
                    EXTRATO DA RESERVA
                  </span>
                  <h2>{selectedReserve.name}</h2>
                  <p>
                    Histórico de aportes, resgates e rendimentos registrados.
                  </p>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSelectedReserveId(null)}
                >
                  Fechar histórico
                </button>
              </div>

              <div className="history-summary">
                <div>
                  <span>Saldo atual</span>
                  <strong>
                    {formatCurrency(
                      getReserveBalance(selectedReserve, movements)
                    )}
                  </strong>
                </div>

                <div>
                  <span>Movimentações</span>
                  <strong>{selectedMovements.length}</strong>
                </div>
              </div>

              {selectedMovements.length === 0 ? (
                <div className="empty-history">
                  Nenhuma movimentação registrada para esta reserva.
                </div>
              ) : (
                <div className="table-container">
                  <table className="movements-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Tipo</th>
                        <th>Valor</th>
                        <th>Ação</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedMovements.map((movement) => (
                        <tr key={movement.id}>
                          <td>{formatDate(movement.date)}</td>
                          <td>{movement.description || movement.type}</td>
                          <td>
                            <span
                              className={`movement-badge ${getMovementColor(
                                movement.type
                              )}`}
                            >
                              {movement.type}
                            </span>
                          </td>
                          <td
                            className={`movement-value ${getMovementColor(
                              movement.type
                            )}`}
                          >
                            {movement.type === "Resgate" ? "− " : "+ "}
                            {formatCurrency(movement.amount)}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="table-delete"
                              onClick={() => handleDeleteMovement(movement)}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <section className="information-section">
            <div className="information-icon">i</div>
            <div>
              <h3>Como funciona o controle de reservas?</h3>
              <p>
                Os aportes aumentam o saldo reservado, os resgates reduzem o
                saldo e os rendimentos são registrados separadamente. O saldo
                inicial é considerado no cálculo da reserva.
              </p>
              <p>
                As movimentações desta página são independentes dos
                lançamentos de receitas e despesas. Assim, você evita
                contabilizar um aporte como uma nova receita ou um resgate
                como uma nova despesa.
              </p>
            </div>
          </section>
        </>
      )}

      <footer className="routine-footer">
        <span>© 2026 NEXO — GESTÃO PESSOAL</span>
        <span>PLANEJE. ORGANIZE. CONQUISTE.</span>
      </footer>

      <style jsx global>{`
        .reserves-content {
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
          min-width: 0;
        }

        .page-description {
          margin-top: -8px;
          color: #92929b;
          font-size: 12px;
          line-height: 1.6;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 220px;
          color: #92929b;
          background: #19191c;
          border: 1px solid #2b2b30;
          border-radius: 9px;
          font-size: 12px;
        }

        .feedback-message {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 15px;
          color: #d8d8dd;
          background: #222226;
          border: 1px solid #414149;
          border-radius: 7px;
          font-size: 12px;
        }

        .feedback-message button {
          color: #aaaab2;
          background: none;
          border: 0;
          font-size: 20px;
          cursor: pointer;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .summary-card {
          min-width: 0;
          padding: 19px;
          background: #19191c;
          border: 1px solid #2b2b30;
          border-radius: 9px;
        }

        .main-summary {
          background: #1d1d21;
          border-color: #414149;
        }

        .summary-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          color: #a4a4ad;
          font-size: 11px;
        }

        .summary-icon {
          color: #bdbdc5;
          font-size: 19px;
        }

        .summary-card strong {
          display: block;
          overflow: hidden;
          margin-top: 17px;
          color: #f4f4f5;
          font-size: 23px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .summary-card small {
          display: block;
          margin-top: 7px;
          color: #777780;
          font-size: 10px;
        }

        .secondary-summary {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          padding: 14px;
          background: #171719;
          border: 1px solid #29292e;
          border-radius: 9px;
        }

        .secondary-item {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
          padding: 3px 10px;
          border-right: 1px solid #303036;
        }

        .secondary-item:last-child {
          border-right: 0;
        }

        .secondary-item span {
          color: #85858e;
          font-size: 10px;
        }

        .secondary-item strong {
          overflow: hidden;
          color: #e9e9ec;
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .positive {
          color: #83c99c !important;
        }

        .negative {
          color: #e18a8a !important;
        }

        .content-section {
          min-width: 0;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 18px;
        }

        .section-eyebrow {
          display: block;
          margin-bottom: 9px;
          color: #85858e;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.6px;
        }

        .section-heading h2 {
          margin: 0;
          color: #f0f0f2;
          font-size: 20px;
          font-weight: 650;
        }

        .section-heading p {
          margin: 7px 0 0;
          color: #85858e;
          font-size: 11px;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 38px;
          padding: 0 15px;
          border: 1px solid #55555e;
          border-radius: 6px;
          color: #fff;
          background: #34343a;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
          white-space: nowrap;
        }

        .primary-button:hover {
          background: #484850;
          border-color: #777780;
        }

        .secondary-button {
          color: #c2c2ca;
          background: #202024;
          border-color: #38383e;
        }

        .secondary-button:hover {
          color: #fff;
          background: #303035;
        }

        .form-card {
          margin-bottom: 22px;
          padding: 22px;
          background: #19191c;
          border: 1px solid #36363d;
          border-radius: 9px;
        }

        .form-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 22px;
        }

        .form-heading h3 {
          margin: 0;
          color: #f0f0f2;
          font-size: 16px;
        }

        .form-heading p {
          margin: 6px 0 0;
          color: #85858e;
          font-size: 11px;
        }

        .form-heading p strong {
          color: #e9e9ec;
        }

        .close-button {
          width: 30px;
          height: 30px;
          color: #aaaab2;
          background: #252529;
          border: 1px solid #39393f;
          border-radius: 5px;
          font-size: 19px;
          cursor: pointer;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 17px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        .field-wide {
          grid-column: span 2;
        }

        .field-full {
          grid-column: 1 / -1;
        }

        .field label {
          color: #bdbdc5;
          font-size: 11px;
          font-weight: 600;
        }

        .field input,
        .field select,
        .field textarea,
        .filters-bar select,
        .search-field input {
          width: 100%;
          min-width: 0;
          min-height: 39px;
          padding: 9px 11px;
          color: #e9e9ec;
          background: #111113;
          border: 1px solid #35353b;
          border-radius: 6px;
          outline: none;
          font-family: inherit;
          font-size: 11px;
          box-sizing: border-box;
          color-scheme: dark;
        }

        .field textarea {
          resize: vertical;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus,
        .filters-bar select:focus,
        .search-field input:focus {
          border-color: #777780;
        }

        .field input::placeholder,
        .field textarea::placeholder,
        .search-field input::placeholder {
          color: #66666f;
        }

        .field-hint {
          color: #777780;
          font-size: 10px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 22px;
          padding-top: 17px;
          border-top: 1px solid #303036;
        }

        .form-note {
          margin: 15px 0 0;
          padding: 11px 13px;
          color: #a3a3ad;
          background: #222226;
          border: 1px solid #34343a;
          border-radius: 6px;
          font-size: 10px;
          line-height: 1.6;
        }

        .filters-bar {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) 190px 160px;
          gap: 10px;
          margin-bottom: 17px;
        }

        .search-field {
          position: relative;
        }

        .search-field span {
          position: absolute;
          top: 8px;
          left: 12px;
          color: #888891;
          font-size: 18px;
        }

        .search-field input {
          padding-left: 37px;
        }

        .reserve-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .reserve-card {
          min-width: 0;
          padding: 19px;
          background: #19191c;
          border: 1px solid #2e2e34;
          border-radius: 9px;
          transition: border-color 0.2s;
        }

        .reserve-card:hover {
          border-color: #515159;
        }

        .reserve-card-header {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .reserve-category-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 37px;
          height: 37px;
          color: #d0d0d7;
          background: #29292f;
          border: 1px solid #3c3c43;
          border-radius: 7px;
          font-size: 18px;
        }

        .reserve-card-title {
          flex: 1;
          min-width: 0;
        }

        .reserve-card-title span {
          color: #888891;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .reserve-card-title h3 {
          overflow: hidden;
          margin: 4px 0 0;
          color: #f0f0f2;
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status-badge {
          flex-shrink: 0;
          padding: 5px 8px;
          border: 1px solid #414149;
          border-radius: 4px;
          color: #c2c2ca;
          background: #28282d;
          font-size: 9px;
        }

        .status-badge.concluída {
          color: #91cba5;
          border-color: #345442;
          background: #1c2b22;
        }

        .status-badge.pausada {
          color: #d5bd8b;
          border-color: #5a4b2e;
          background: #30291d;
        }

        .reserve-description {
          margin: 13px 0 0;
          color: #898992;
          font-size: 10px;
          line-height: 1.5;
        }

        .reserve-balance {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-top: 20px;
        }

        .reserve-balance span,
        .progress-info span,
        .reserve-values span,
        .reserve-details span {
          color: #898992;
          font-size: 10px;
        }

        .reserve-balance strong {
          color: #f4f4f5;
          font-size: 23px;
          font-weight: 700;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 20px;
          margin-bottom: 8px;
        }

        .progress-info strong {
          color: #d9d9df;
          font-size: 11px;
        }

        .progress-track {
          width: 100%;
          height: 7px;
          overflow: hidden;
          background: #303036;
          border-radius: 20px;
        }

        .progress-fill {
          height: 100%;
          background: #8a8a94;
          border-radius: 20px;
          transition: width 0.3s ease;
        }

        .reserve-values,
        .reserve-details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 17px;
        }

        .reserve-values div,
        .reserve-details div {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .reserve-values strong,
        .reserve-details strong {
          overflow: hidden;
          color: #d9d9df;
          font-size: 11px;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .reserve-details {
          padding-top: 15px;
          border-top: 1px solid #303036;
        }

        .reserve-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 18px;
          padding-top: 15px;
          border-top: 1px solid #303036;
        }

        .action-button {
          min-height: 31px;
          padding: 0 9px;
          color: #bdbdc5;
          background: #242428;
          border: 1px solid #3b3b42;
          border-radius: 5px;
          font-size: 10px;
          cursor: pointer;
          transition: 0.2s;
        }

        .action-button:hover {
          color: #fff;
          border-color: #707078;
        }

        .action-button.highlight {
          color: #f0f0f2;
          background: #34343a;
          border-color: #55555e;
        }

        .action-button.delete-action {
          margin-left: auto;
          color: #d68a8a;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 260px;
          padding: 35px 20px;
          text-align: center;
          background: #19191c;
          border: 1px dashed #3a3a41;
          border-radius: 9px;
        }

        .empty-icon {
          color: #aaaab2;
          font-size: 35px;
        }

        .empty-state h3 {
          margin: 13px 0 0;
          color: #e5e5e9;
          font-size: 15px;
        }

        .empty-state p {
          max-width: 380px;
          margin: 8px 0 17px;
          color: #85858e;
          font-size: 11px;
          line-height: 1.6;
        }

        .history-section {
          padding: 21px;
          background: #19191c;
          border: 1px solid #303036;
          border-radius: 9px;
        }

        .history-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 35px;
          margin-bottom: 18px;
          padding: 14px;
          background: #222226;
          border-radius: 6px;
        }

        .history-summary div {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .history-summary span {
          color: #898992;
          font-size: 10px;
        }

        .history-summary strong {
          color: #f0f0f2;
          font-size: 15px;
        }

        .table-container {
          width: 100%;
          overflow-x: auto;
        }

        .movements-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          white-space: nowrap;
        }

        .movements-table th {
          padding: 12px;
          color: #898992;
          background: #222226;
          font-size: 10px;
          font-weight: 600;
        }

        .movements-table td {
          padding: 13px 12px;
          color: #c7c7ce;
          border-bottom: 1px solid #303036;
          font-size: 10px;
        }

        .movement-badge {
          display: inline-block;
          padding: 5px 7px;
          border: 1px solid #414149;
          border-radius: 4px;
          color: #c7c7ce;
          background: #29292e;
          font-size: 9px;
        }

        .movement-badge.positive {
          color: #8cc8a0;
          border-color: #345442;
          background: #1c2b22;
        }

        .movement-badge.negative {
          color: #df9999;
          border-color: #5a3434;
          background: #302020;
        }

        .movement-value {
          font-weight: 600;
        }

        .table-delete {
          padding: 5px 8px;
          color: #d68a8a;
          background: transparent;
          border: 1px solid #543737;
          border-radius: 4px;
          font-size: 9px;
          cursor: pointer;
        }

        .empty-history {
          padding: 30px 15px;
          color: #85858e;
          text-align: center;
          font-size: 11px;
          border: 1px dashed #39393f;
          border-radius: 6px;
        }

        .information-section {
          display: flex;
          gap: 13px;
          padding: 18px;
          background: #19191c;
          border: 1px solid #2e2e34;
          border-radius: 8px;
        }

        .information-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 25px;
          height: 25px;
          color: #c4c4cc;
          background: #303036;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 700;
        }

        .information-section h3 {
          margin: 2px 0 8px;
          color: #e5e5e9;
          font-size: 12px;
        }

        .information-section p {
          margin: 5px 0;
          color: #898992;
          font-size: 10px;
          line-height: 1.7;
        }

        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .secondary-summary {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .secondary-item:nth-child(3) {
            border-right: 0;
          }
        }

        @media (max-width: 760px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .summary-card {
            padding: 14px;
          }

          .summary-card strong {
            font-size: 18px;
          }

          .secondary-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 13px;
          }

          .secondary-item {
            border-right: 0;
            border-bottom: 1px solid #303036;
            padding: 5px 7px 10px;
          }

          .section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .field-wide {
            grid-column: 1 / -1;
          }

          .filters-bar {
            grid-template-columns: 1fr 1fr;
          }

          .search-field {
            grid-column: 1 / -1;
          }

          .reserve-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 450px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .field-wide,
          .field-full {
            grid-column: auto;
          }

          .filters-bar {
            grid-template-columns: 1fr;
          }

          .search-field {
            grid-column: auto;
          }

          .reserve-card {
            padding: 15px;
          }

          .reserve-card-header {
            flex-wrap: wrap;
          }

          .reserve-actions {
            gap: 6px;
          }

          .action-button {
            flex: 1;
          }

          .action-button.delete-action {
            margin-left: 0;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .form-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
