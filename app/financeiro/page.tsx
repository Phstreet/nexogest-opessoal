"use client";

import "./financeiro.css";

import { useNexoConfirm } from "@/contexts/NexoConfirmProvider";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { Account, Transaction } from "@/lib/finance/types";
import { categoriesByType, subcategories } from "@/lib/finance/categories";
import SelectField from "./SelectField";
import FinanceSummaryCards from "./FinanceSummaryCards";
import FinanceMovementList from "./FinanceMovementList";
import type { FormMovementType } from "@/lib/finance/finance-utils";
import {
  getDefaultCategory,
  getDefaultSubcategory,
  getNextTransactionId,
  getSettledAmount,
  isInvestmentApplied,
  isValidDate,
  isValidTransaction,
  localDate,
  money,
  movementClass,
  movementIcon,
  movementValue,
  parseAmount,
} from "@/lib/finance/finance-utils";
import { expandRecurringTransactions } from "@/lib/finance/recurrence-utils";
import {
  fetchRemoteCollections,
  saveRemoteCollection,
} from "@/lib/supabase/client";



const STORAGE_KEY = "nexo_transactions";

const investmentOptions = [
  "CDB",
  "LCI",
  "LCA",
  "Tesouro Direto",
  "Ações",
  "Fundos imobiliários (FIIs)",
  "Fundos de investimento",
  "Renda fixa",
  "Renda variável",
  "Criptomoedas",
  "Previdência privada",
  "Outros",
];

const institutions = [
  "Nubank",
  "Banco Inter",
  "Itaú",
  "Bradesco",
  "Banco do Brasil",
  "Caixa Econômica Federal",
  "Santander",
  "C6 Bank",
  "BTG Pactual",
  "XP Investimentos",
  "Rico",
  "Clear",
  "Mercado Pago",
  "PicPay",
  "Outra instituição",
];

const movementTypes: FormMovementType[] = [
  "Receita",
  "Despesa",
  "Transferência",
  "Investimento",
];

const legacyAccounts = [
  "Conta Corrente",
  "Poupança",
  "Dinheiro em Espécie",
  "Carteira Digital",
];

const paymentMethods = [
  "Dinheiro",
  "Débito",
  "Crédito",
  "PIX",
  "Transferência",
  "Boleto",
];

const recurrences = [
  "Nenhuma",
  "Semanal",
  "Quinzenal",
  "Mensal",
  "Bimestral",
  "Trimestral",
  "Semestral",
  "Anual",
];

export default function Page() {
  const confirm = useNexoConfirm();
  const { session, loading: authLoading } = useNexoAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [registeredAccounts, setRegisteredAccounts] = useState<Account[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [settledAmount, setSettledAmount] = useState("");
  const [type, setType] = useState<FormMovementType>("Despesa");
  const [category, setCategory] = useState("Moradia");
  const [subcategory, setSubcategory] = useState("Aluguel");
  const [date, setDate] = useState("");
  const [account, setAccount] = useState("Conta Corrente");
  const [destinationAccount, setDestinationAccount] = useState("Poupança");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [status, setStatus] = useState("Pendente");
  const [recurrence, setRecurrence] = useState("Nenhuma");
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [settlementEditingId, setSettlementEditingId] = useState<number | null>(null);
  const [settlementInput, setSettlementInput] = useState("");
  const [institution, setInstitution] = useState("Nubank");
  const [filter, setFilter] = useState("Todos");
  const [loaded, setLoaded] = useState(false);
  const [safeToSave, setSafeToSave] = useState(false);
  const [invalidCount, setInvalidCount] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [, setSyncStatus] = useState("Conectando ao banco de dados...");
  const revisionRef = useRef(0);
  const remoteReadyRef = useRef(false);
  const lastSavedPayloadRef = useRef("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const transactionFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (editingTransactionId === null) return;

    const form = transactionFormRef.current;
    if (!form) return;

    form.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstInput = form.querySelector<HTMLInputElement>("input");
    firstInput?.focus({ preventScroll: true });
  }, [editingTransactionId]);

  useEffect(() => {
    let active = true;

    async function initializeFinanceData() {
      if (authLoading) return;
      setLoaded(false);
      remoteReadyRef.current = false;
      setSafeToSave(false);
      setStorageError(null);

      if (!session) {
        setTransactions([]);
        setRegisteredAccounts([]);
        setInvalidCount(0);
        setSyncStatus("Aguardando autenticação");
        setLoaded(true);
        return;
      }

      setDate(localDate());
      try {
        const collections = await fetchRemoteCollections();
        if (!active) return;

        const transactionRow = collections.find((item) => item.data_key === STORAGE_KEY);
        const accountRow = collections.find((item) => item.data_key === "nexo_accounts");
        const cloudTransactions = transactionRow?.payload ?? [];
        const cloudAccounts = accountRow?.payload ?? [];

        if (!Array.isArray(cloudTransactions)) {
          throw new Error("Os lançamentos do Supabase estão em formato inválido. Nenhuma alteração foi feita.");
        }
        if (!Array.isArray(cloudAccounts) || !cloudAccounts.every((item) =>
          item && typeof item === "object" &&
          typeof (item as Record<string, unknown>).id === "number" &&
          typeof (item as Record<string, unknown>).name === "string"
        )) {
          throw new Error("As contas do Supabase estão em formato inválido. Nenhuma alteração foi feita.");
        }

        const invalidRecords = cloudTransactions.filter((item) => !isValidTransaction(item));
        if (invalidRecords.length > 0) {
          throw new Error(`Existem ${invalidRecords.length} lançamento(s) inválido(s) no Supabase. A gravação foi bloqueada para evitar perda de dados.`);
        }

        const validTransactions = cloudTransactions as Transaction[];
        const synchronized = expandRecurringTransactions(validTransactions);
        revisionRef.current = Number(transactionRow?.revision) || 0;
        lastSavedPayloadRef.current = JSON.stringify(validTransactions);
        setTransactions(synchronized);
        setRegisteredAccounts(cloudAccounts as Account[]);
        setInvalidCount(0);
        setSafeToSave(true);
        setStorageError(null);
        setSyncStatus("Dados carregados diretamente do Supabase");
        remoteReadyRef.current = true;
        setLoaded(true);
      } catch (error) {
        if (!active) return;
        console.error("Falha ao carregar os dados financeiros do Supabase:", error);
        setTransactions([]);
        setRegisteredAccounts([]);
        setInvalidCount(0);
        setSafeToSave(false);
        setStorageError(error instanceof Error ? error.message : "Não foi possível carregar os dados financeiros da nuvem.");
        setSyncStatus("Falha ao acessar o Supabase");
        setLoaded(true);
      }
    }

    void initializeFinanceData();
    return () => { active = false; };
  }, [authLoading, session]);

  useEffect(() => {
    if (!loaded || !safeToSave || !remoteReadyRef.current) return;
    const serializedPayload = JSON.stringify(transactions);
    if (serializedPayload === lastSavedPayloadRef.current) return;

    saveQueueRef.current = saveQueueRef.current.then(async () => {
      if (!remoteReadyRef.current) return;
      try {
        const result = await saveRemoteCollection(STORAGE_KEY, transactions, revisionRef.current);
        if (!result.saved) {
          setSafeToSave(false);
          remoteReadyRef.current = false;
          setStorageError("Os lançamentos foram alterados em outro dispositivo. A gravação foi pausada para evitar sobrescrever dados. Atualize a tela para carregar a versão mais recente.");
          setSyncStatus("Conflito de sincronização");
          return;
        }
        revisionRef.current = result.current_revision ?? revisionRef.current + 1;
        lastSavedPayloadRef.current = serializedPayload;
        setStorageError(null);
        setSyncStatus("Sincronizado com o Supabase");
      } catch (error) {
        console.error("Não foi possível salvar os lançamentos no Supabase:", error);
        setSafeToSave(false);
        remoteReadyRef.current = false;
        setStorageError(error instanceof Error ? error.message + " A gravação foi pausada para proteger os dados." : "Falha ao salvar no banco de dados. A gravação foi pausada.");
        setSyncStatus("Erro ao salvar na nuvem");
      }
    });
  }, [transactions, loaded, safeToSave]);

  const accountOptions = useMemo(() => {
    const registeredNames = new Set(
      registeredAccounts.map((item) => item.name)
    );

    const activeNames = registeredAccounts
      .filter((item) => item.active)
      .sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)))
      .map((item) => item.name);

    // Mantém acessíveis as contas antigas usadas em lançamentos,
    // sem oferecer contas cadastradas que estejam inativas.
    const legacyNames = transactions
      .flatMap((item) =>
        item.type === "Transferência"
          ? [item.account, item.destinationAccount]
          : [item.account]
      )
      .filter(
        (name): name is string =>
          Boolean(name) && !registeredNames.has(name as string)
      );

    const available = Array.from(
      new Set([...activeNames, ...legacyNames])
    );

    return available.length > 0 ? available : legacyAccounts;
  }, [registeredAccounts, transactions]);

  useEffect(() => {
    if (accountOptions.length === 0) return;

    setAccount((current) =>
      accountOptions.includes(current) ? current : accountOptions[0]
    );

    setDestinationAccount((current) =>
      accountOptions.includes(current)
        ? current
        : accountOptions[1] ?? accountOptions[0]
    );
  }, [accountOptions]);

  const availableCategories = categoriesByType[type];

  const availableSubcategories =
    type === "Investimento"
      ? investmentOptions
      : subcategories[category] || ["Outros"];

  function changeType(value: string) {
    const newType = value as FormMovementType;
    const newCategory = getDefaultCategory(newType);

    if (newType === "Receita") {
      const primaryAccount = registeredAccounts.find((item) => item.active && item.isPrimary)
        ?? registeredAccounts.find((item) => item.active);
      if (primaryAccount) setAccount(primaryAccount.name);
    }

    setType(newType);
    setCategory(newCategory);
    setSettledAmount("");

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

    const salaryCategories = ["Salário", "13º Salário", "Adiantamento Salarial"];
    if (type === "Receita" && salaryCategories.includes(value)) {
      const primaryAccount = registeredAccounts.find((item) => item.active && item.isPrimary)
        ?? registeredAccounts.find((item) => item.active);
      if (primaryAccount) setAccount(primaryAccount.name);
    }
  }

  const totals = useMemo(() => {
    const active = transactions.filter(
      (item) => item.status !== "Cancelada"
    );

    const receitas = active
      .filter((item) => item.type === "Receita")
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    const despesas = active
      .filter((item) => item.type === "Despesa")
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    const receitasRealizadas = active
      .filter((item) => item.type === "Receita")
      .reduce(
        (sum, item) => sum + getSettledAmount(item),
        0
      );

    const despesasRealizadas = active
      .filter((item) => item.type === "Despesa")
      .reduce(
        (sum, item) => sum + getSettledAmount(item),
        0
      );

    const investimentosAplicados = active
      .filter(isInvestmentApplied)
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    return {
      receitas,
      despesas,
      receitasRealizadas,
      despesasRealizadas,
      investimentosAplicados,
      resultado:
        receitasRealizadas -
        despesasRealizadas -
        investimentosAplicados,
    };
  }, [transactions]);

  const filterOptions = useMemo(() => {
    const existingTypes = transactions
      .map((item) => item.type)
      .filter(
        (item) =>
          item === "Aplicação" || item === "Reserva"
      );

    return [
      ...movementTypes,
      ...Array.from(new Set(existingTypes)),
    ];
  }, [transactions]);

  const filtered = transactions.filter(
    (item) => filter === "Todos" || item.type === filter
  );

  function startEditingTransaction(item: Transaction) {
    if (item.type !== "Receita" && item.type !== "Despesa") return;

    setEditingTransactionId(item.id);
    setDescription(item.description);
    setAmount(String(item.amount).replace(".", ","));
    setSettledAmount(
      item.settledAmount === undefined
        ? ""
        : String(item.settledAmount).replace(".", ",")
    );
    setType(item.type);
    setCategory(item.category || getDefaultCategory(item.type));
    setSubcategory(
      item.subcategory ||
        getDefaultSubcategory(item.category || getDefaultCategory(item.type))
    );
    setDate(item.date || localDate());
    setAccount(item.account || "Conta Corrente");
    setPaymentMethod(item.paymentMethod || "PIX");
    setStatus(item.status || "Pendente");
    setRecurrence(item.recurrence || "Nenhuma");
  }

  function cancelEditingTransaction() {
    setEditingTransactionId(null);
    setDescription("");
    setAmount("");
    setSettledAmount("");
    setType("Despesa");
    setCategory("Moradia");
    setSubcategory("Aluguel");
    setStatus("Pendente");
    setRecurrence("Nenhuma");
    setDate(localDate());
  }

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!safeToSave) {
      window.alert(
        "O armazenamento está protegido contra gravações porque há um problema com os dados existentes. Faça a recuperação ou verifique o backup antes de continuar."
      );
      return;
    }

    const parsedAmount = parseAmount(amount);

    if (
      !description.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      window.alert(
        "Preencha a descrição e informe um valor válido."
      );
      return;
    }

    if (!isValidDate(date)) {
      window.alert("Informe uma data válida.");
      return;
    }

    const isPartialStatus =
      status === "Recebida parcialmente" ||
      status === "Paga parcialmente";

    const parsedSettledAmount = isPartialStatus
      ? parseAmount(settledAmount)
      : undefined;

    if (
      isPartialStatus &&
      (
        !Number.isFinite(parsedSettledAmount) ||
        Number(parsedSettledAmount) <= 0 ||
        Number(parsedSettledAmount) >= parsedAmount
      )
    ) {
      window.alert(
        "Informe um valor parcial maior que zero e menor que o valor total."
      );
      return;
    }

    if (
      type === "Receita" &&
      status === "Paga parcialmente"
    ) {
      window.alert(
        "Para receitas, selecione 'Recebida parcialmente'."
      );
      return;
    }

    if (
      type === "Despesa" &&
      status === "Recebida parcialmente"
    ) {
      window.alert(
        "Para despesas, selecione 'Paga parcialmente'."
      );
      return;
    }

    if (
      type === "Transferência" &&
      account === destinationAccount
    ) {
      window.alert(
        "Escolha contas diferentes para origem e destino."
      );
      return;
    }

    if (type === "Investimento" && !institution.trim()) {
      window.alert(
        "Selecione a instituição financeira do investimento."
      );
      return;
    }

    const investmentDestination =
      type === "Investimento"
        ? `Investimento: ${subcategory} - ${institution}`
        : undefined;

    const editingTransaction = editingTransactionId === null
      ? undefined
      : transactions.find((item) => item.id === editingTransactionId);

    const newTransaction: Transaction = {
      id: editingTransaction?.id ?? getNextTransactionId(transactions),
      description: description.trim(),
      type,
      amount: parsedAmount,
      settledAmount: parsedSettledAmount,
      date,
      category:
        type === "Transferência" || type === "Investimento"
          ? type
          : category,
      subcategory:
        type === "Transferência"
          ? "Entre contas"
          : subcategory,
      account,
      destinationAccount:
        type === "Transferência"
          ? destinationAccount
          : investmentDestination,
      paymentMethod,
      status,
      recurrence,
      investment:
        type === "Investimento" ? subcategory : undefined,
      institution:
        type === "Investimento" ? institution : undefined,
    };

    if (editingTransactionId !== null) {
      setTransactions((current) =>
        current.map((item) =>
          item.id === editingTransactionId
            ? {
                ...item,
                ...newTransaction,
                id: item.id,
                recurrenceGroupId: item.recurrenceGroupId,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
    } else if (
      recurrence !== "Nenhuma" &&
      (type === "Receita" || type === "Despesa")
    ) {
      const expanded = expandRecurringTransactions([...transactions, newTransaction]);
      setTransactions(expanded);
    } else {
      setTransactions((current) => [
        newTransaction,
        ...current,
      ]);
    }

    setEditingTransactionId(null);
    setDescription("");
    setAmount("");
    setSettledAmount("");
    setType("Despesa");
    setCategory("Moradia");
    setSubcategory("Aluguel");
    setStatus("Pendente");
    setRecurrence("Nenhuma");
    setDate(localDate());
  }

  function openSettlementEditor(item: Transaction) {
    if (
      (item.type !== "Receita" && item.type !== "Despesa") ||
      (!["Pendente", "Recebida parcialmente", "Paga parcialmente", "Prevista", "Atrasada", ""].includes(item.status || ""))
    ) return;

    setSettlementEditingId(item.id);
    setSettlementInput(
      String(item.settledAmount ?? item.amount).replace(".", ",")
    );
  }

  async function saveSettlement(item: Transaction) {
    const isIncome = item.type === "Receita";
    const isExpense = item.type === "Despesa";

    if (
      (!isIncome && !isExpense) ||
      (!["Pendente", "Recebida parcialmente", "Paga parcialmente", "Prevista", "Atrasada", ""].includes(item.status || ""))
    ) return;

    if (!safeToSave || !remoteReadyRef.current) {
      setSyncStatus("Aguardando sincronização para alterar o lançamento");
      return;
    }

    const effectiveAmount = parseAmount(settlementInput);
    if (
      !Number.isFinite(effectiveAmount) ||
      effectiveAmount <= 0 ||
      effectiveAmount > item.amount
    ) {
      setSyncStatus("Informe um valor maior que zero e igual ou inferior ao valor do lançamento");
      return;
    }

    const isFullySettled = effectiveAmount >= item.amount;
    const nextStatus = isIncome
      ? isFullySettled ? "Recebida" : "Recebida parcialmente"
      : isFullySettled ? "Pago" : "Paga parcialmente";

    try {
      await saveQueueRef.current;
      const updated = transactions.map((current) =>
        current.id === item.id
          ? {
              ...current,
              status: nextStatus,
              settledAmount: effectiveAmount,
              updatedAt: new Date().toISOString(),
            }
          : current
      );

      const result = await saveRemoteCollection(
        STORAGE_KEY,
        updated,
        revisionRef.current
      );

      if (!result.saved) {
        setSafeToSave(false);
        setSyncStatus("Conflito de sincronização — atualize a tela");
        return;
      }

      revisionRef.current =
        result.current_revision ?? revisionRef.current + 1;
      lastSavedPayloadRef.current = JSON.stringify(updated);
      setTransactions(updated);
      setSettlementEditingId(null);
      setSettlementInput("");
      setSyncStatus(
        nextStatus === "Recebida parcialmente" || nextStatus === "Paga parcialmente"
          ? "Valor parcial registrado e sincronizado"
          : "Lançamento confirmado e sincronizado"
      );
    } catch (error) {
      console.error("Erro ao registrar valor efetivo:", error);
      setSyncStatus("Não foi possível atualizar o lançamento");
    }
  }

  async function removeTransaction(id: number) {
    if (!safeToSave || !remoteReadyRef.current) {
      setStorageError(
        "A exclusão está temporariamente bloqueada porque os dados ainda não foram sincronizados. Atualize a tela para carregar a versão mais recente."
      );
      setSyncStatus("Aguardando sincronização");
      return;
    }

    const transactionToRemove = transactions.find((item) => item.id === id);
    if (!transactionToRemove) return;

    const accepted = await confirm({
      title: "Excluir lançamento",
      message: `Deseja excluir o lançamento "${transactionToRemove.description}"? Esta ação não poderá ser desfeita.`,
      confirmLabel: "Excluir",
      destructive: true,
    });

    if (!accepted) return;

    try {
      // Aguarda qualquer gravação anterior para usar a revisão mais recente.
      await saveQueueRef.current;

      const latestTransactions = transactions.filter((item) => item.id !== id);
      const result = await saveRemoteCollection(
        STORAGE_KEY,
        latestTransactions,
        revisionRef.current
      );

      if (!result.saved) {
        setSafeToSave(false);
        setStorageError(
          "O banco identificou uma alteração feita em outra sessão. Nenhum lançamento foi excluído. Atualize a página e tente novamente."
        );
        setSyncStatus("Conflito de sincronização");
        return;
      }

      revisionRef.current =
        result.current_revision ?? revisionRef.current + 1;
      lastSavedPayloadRef.current = JSON.stringify(latestTransactions);
      setTransactions(latestTransactions);
      setStorageError(null);
      setSyncStatus("Lançamento excluído e sincronizado");
    } catch (error) {
      console.error("Não foi possível excluir o lançamento:", error);
      setStorageError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o lançamento no banco de dados. Tente novamente."
      );
      setSyncStatus("Falha ao excluir lançamento");
    }
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

        {storageError && <section className="finance-storage-warning" role="alert"><strong>Sincronização pausada</strong><p>{storageError}</p></section>}

        {invalidCount > 0 && (
          <section className="finance-storage-warning">
            <strong>
              {invalidCount} registro(s) precisam de verificação
            </strong>
            <p>
              Esses registros foram preservados em uma área separada
              e não foram incluídos nos cálculos. O backup original
              também foi protegido.
            </p>
          </section>
        )}

        <FinanceSummaryCards totals={totals} />

        <form
          ref={transactionFormRef}
          className="finance-form finance-form-compact"
          onSubmit={addTransaction}
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
                onClick={cancelEditingTransaction}
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

        <FinanceMovementList
          filtered={filtered}
          filter={filter}
          filterOptions={filterOptions}
          safeToSave={safeToSave}
          settlementEditingId={settlementEditingId}
          settlementInput={settlementInput}
          onFilterChange={setFilter}
          onSettlementInputChange={setSettlementInput}
          onSaveSettlement={saveSettlement}
          onCancelSettlement={() => {
            setSettlementEditingId(null);
            setSettlementInput("");
          }}
          onOpenSettlementEditor={openSettlementEditor}
          onStartEditingTransaction={startEditingTransaction}
          onRemoveTransaction={removeTransaction}
        />

        <footer className="routine-footer">
          <span>© 2026 NEXO — GESTÃO PESSOAL</span>
          <span>PLANEJE. ORGANIZE. CONQUISTE.</span>
        </footer>
      </div>

      
    </>
  );
}