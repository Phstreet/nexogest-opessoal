"use client";

import { useNexoConfirm } from "@/contexts/NexoConfirmProvider";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { Account, Transaction } from "@/lib/finance/types";
import { categoriesByType, subcategories } from "@/lib/finance/categories";
import { expandRecurringTransactions } from "@/lib/finance/recurrence-utils";
import {
  fetchRemoteCollections,
  saveRemoteCollection,
} from "@/lib/supabase/client";



type FormMovementType =
  | "Receita"
  | "Despesa"
  | "Transferência"
  | "Investimento";

type MovementType = FormMovementType | "Aplicação" | "Reserva";

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
    return Number(
      normalized.replace(/\./g, "").replace(",", ".")
    );
  }

  if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    return Number(normalized.replace(/\./g, ""));
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

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  helper?: string;
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
      {helper && <small className="finance-field-helper">{helper}</small>}
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
  const isInvestment =
    item.type === "Investimento" || item.type === "Aplicação";

  if (!isInvestment || item.status === "Cancelada") {
    return false;
  }

  return item.status === "Aplicado" || !item.status;
}

function isValidTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const item = value as Record<string, unknown>;

  const validTypes: MovementType[] = [
    "Receita",
    "Despesa",
    "Transferência",
    "Investimento",
    "Aplicação",
    "Reserva",
  ];

  if (
    typeof item.id !== "number" ||
    !Number.isFinite(item.id) ||
    typeof item.description !== "string" ||
    !item.description.trim() ||
    !validTypes.includes(item.type as MovementType) ||
    typeof item.amount !== "number" ||
    !Number.isFinite(item.amount) ||
    item.amount <= 0
  ) {
    return false;
  }

  if (
    item.settledAmount !== undefined &&
    (
      typeof item.settledAmount !== "number" ||
      !Number.isFinite(item.settledAmount) ||
      item.settledAmount < 0 ||
      item.settledAmount > item.amount
    )
  ) {
    return false;
  }

  if (
    item.date !== undefined &&
    (
      typeof item.date !== "string" ||
      !isValidDate(item.date)
    )
  ) {
    return false;
  }

  const optionalStringFields = [
    "category",
    "subcategory",
    "account",
    "destinationAccount",
    "paymentMethod",
    "status",
    "recurrence",
    "recurrenceGroupId",
    "reserveType",
    "investment",
    "institution",
    "createdAt",
    "updatedAt",
  ];

  for (const field of optionalStringFields) {
    if (
      item[field] !== undefined &&
      typeof item[field] !== "string"
    ) {
      return false;
    }
  }

  return true;
}

function getSettledAmount(item: Transaction) {
  if (item.status === "Cancelada") {
    return 0;
  }

  if (item.type === "Receita") {
    if (item.status === "Recebida") {
      return item.amount;
    }

    if (item.status === "Recebida parcialmente") {
      return Math.min(
        Number(item.settledAmount || 0),
        item.amount
      );
    }

    return item.status ? 0 : item.amount;
  }

  if (item.type === "Despesa") {
    if (item.status === "Pago") {
      return item.amount;
    }

    if (item.status === "Paga parcialmente") {
      return Math.min(
        Number(item.settledAmount || 0),
        item.amount
      );
    }

    return item.status ? 0 : item.amount;
  }

  return isInvestmentApplied(item) ? item.amount : 0;
}


function getNextTransactionId(transactions: Transaction[]) {
  const usedIds = new Set(
    transactions.map((item) => item.id)
  );

  let id = Date.now();

  while (usedIds.has(id)) {
    id += 1;
  }

  return id;
}

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

  function movementIcon(item: Transaction) {
    if (item.type === "Receita") return "↗";
    if (item.type === "Despesa") return "↙";

    if (
      item.type === "Aplicação" ||
      item.type === "Investimento"
    ) {
      return "◈";
    }

    if (item.type === "Reserva") return "▣";

    return "⇄";
  }

  function movementValue(item: Transaction) {
    if (item.type === "Receita") return "+";
    if (item.type === "Despesa") return "-";

    if (
      (
        item.type === "Investimento" ||
        item.type === "Aplicação"
      ) &&
      isInvestmentApplied(item)
    ) {
      return "-";
    }

    return "";
  }

  function movementClass(item: Transaction) {
    if (item.type === "Receita") return "income";
    if (item.type === "Despesa") return "expense";

    if (
      item.type === "Aplicação" ||
      item.type === "Investimento"
    ) {
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
            <small>
              Recebido − pago − investimentos efetivamente aplicados
            </small>
          </article>
        </section>

        <section className="finance-investment-summary">
          <span>◈</span>

          <div>
            <strong>Total investido</strong>

            <p>
              {money(totals.investimentosAplicados)} efetivamente
              aplicados. Investimentos pendentes não reduzem o saldo
              disponível.
            </p>
          </div>
        </section>



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
                Cadastre uma receita, despesa, transferência ou
                investimento.
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
                      {item.subcategory
                        ? ` / ${item.subcategory}`
                        : ""}
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
                        {item.institution ||
                          "Instituição não informada"}
                      </span>
                    )}

                    {item.type === "Reserva" && (
                      <span>
                        Reserva: {item.reserveType || "Não especificada"}
                      </span>
                    )}

                    <span>
                      {item.date && isValidDate(item.date)
                        ? new Date(
                            `${item.date}T12:00:00`
                          ).toLocaleDateString("pt-BR")
                        : "Sem data"}
                      {" · "}
                      {item.status || "Pendente"}
                    </span>

                    {(item.status === "Recebida parcialmente" ||
                      item.status === "Paga parcialmente") && (
                      <span>
                        {item.status === "Recebida parcialmente"
                          ? "Recebido: "
                          : "Pago: "}
                        {money(Number(item.settledAmount || 0))}
                        {" de "}
                        {money(item.amount)}
                      </span>
                    )}
                  </div>

                  <strong className={movementClass(item)}>
                    {movementValue(item)}
                    {money(Number(item.amount || 0))}
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
                          onChange={(event) => setSettlementInput(event.target.value)}
                          placeholder="0,00"
                          aria-label={item.type === "Receita" ? "Valor recebido" : "Valor pago"}
                        />
                        <button
                          type="button"
                          className="finance-edit"
                          onClick={() => saveSettlement(item)}
                          disabled={!safeToSave}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="finance-cancel-edit"
                          onClick={() => {
                            setSettlementEditingId(null);
                            setSettlementInput("");
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                      <small>Valor previsto: {money(item.amount)}. Se informar um valor menor, o lançamento ficará parcialmente {item.type === "Receita" ? "recebido" : "pago"}.</small>
                    </div>
                  )}

                  <div className="finance-item-actions">
                    {(item.type === "Receita" || item.type === "Despesa") &&
                      (["Pendente", "Recebida parcialmente", "Paga parcialmente", "Prevista", "Atrasada", ""].includes(item.status || "")) && (
                        <button
                          type="button"
                          className="finance-edit"
                          onClick={() => openSettlementEditor(item)}
                          disabled={!safeToSave}
                          aria-label={item.type === "Receita" ? "Informar valor recebido" : "Informar valor pago"}
                        >
                          {item.status === "Recebida parcialmente" || item.status === "Paga parcialmente" ? "Atualizar valor" : item.type === "Receita" ? "Receber" : "Pagar"}
                        </button>
                      )}
                    {(item.type === "Receita" || item.type === "Despesa") && (
                      <button
                        type="button"
                        className="finance-edit"
                        onClick={() => startEditingTransaction(item)}
                        aria-label={"Editar " + item.description}
                        disabled={!safeToSave}
                      >
                        Editar
                      </button>
                    )}
                    <button
                      type="button"
                      className="finance-delete"
                      onClick={() => removeTransaction(item.id)}
                      aria-label={"Excluir " + item.description}
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
          background: linear-gradient(
            100deg,
            #222326 0%,
            #171719 60%,
            #101012 100%
          );
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

        .finance-storage-alert,
        .finance-storage-warning {
          padding: 14px 16px;
          border: 1px solid #765d42;
          border-radius: 8px;
          background: #211c17;
        }

        .finance-storage-alert strong,
        .finance-storage-warning strong {
          display: block;
          color: #e8c99f;
          font-size: 12px;
        }

        .finance-storage-alert p,
        .finance-storage-warning p {
          margin: 6px 0;
          color: #c5b49e;
          font-size: 11px;
          line-height: 1.5;
        }

        .finance-storage-alert > span {
          display: block;
          color: #b8a58e;
          font-size: 10px;
        }

        .finance-storage-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .finance-storage-actions button {
          min-height: 32px;
          padding: 0 12px;
          border: 1px solid #78654f;
          border-radius: 5px;
          background: #30271e;
          color: #ead8bd;
          font-size: 10px;
          cursor: pointer;
        }

        .finance-storage-warning {
          border-color: #5d5d65;
          background: #1c1c20;
        }

        .finance-storage-warning strong {
          color: #d5d7dd;
        }

        .finance-storage-warning p {
          margin-bottom: 0;
          color: #aeb1ba;
        }

        .finance-backup-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 12px 15px;
          border: 1px solid #303034;
          border-radius: 8px;
          background: #151517;
        }

        .finance-backup-panel > div:first-child {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .finance-backup-panel strong {
          color: #dedfe3;
          font-size: 11px;
        }

        .finance-backup-panel span {
          color: #92949c;
          font-size: 10px;
        }

        .finance-backup-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .finance-backup-actions button,
        .finance-import-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 31px;
          padding: 0 10px;
          border: 1px solid #414149;
          border-radius: 5px;
          background: #222226;
          color: #d8dae0;
          font-family: inherit;
          font-size: 10px;
          cursor: pointer;
        }

        .finance-backup-actions button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .finance-import-button input {
          display: none;
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

        .finance-fields-grid .finance-field .finance-field-helper {
          display: block;
          color: #858b95;
          font-size: 9px;
          line-height: 1.45;
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

        .finance-form-actions button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
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

        .finance-settlement-editor {
          display: flex;
          flex: 1 0 100%;
          flex-direction: column;
          gap: 6px;
          padding: 10px 12px;
          border: 1px solid #414149;
          border-radius: 6px;
          background: #101012;
        }

        .finance-settlement-editor label {
          color: #d8dae0;
          font-size: 10px;
          font-weight: 600;
        }

        .finance-settlement-controls {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }

        .finance-settlement-controls input {
          width: 150px;
          min-width: 110px;
          height: 29px;
          padding: 0 9px;
          border: 1px solid #414149;
          border-radius: 5px;
          outline: none;
          background: #1b1b1f;
          color: #f3f3f5;
          font: inherit;
          font-size: 11px;
        }

        .finance-settlement-editor small {
          color: #92949c;
          font-size: 9px;
          line-height: 1.45;
        }

        .finance-item-actions {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          gap: 5px;
        }

        .finance-edit,
        .finance-cancel-edit {
          min-height: 28px;
          padding: 0 9px;
          border: 1px solid #414149;
          border-radius: 5px;
          background: #222226;
          color: #cbd0d8;
          font-family: inherit;
          font-size: 10px;
          cursor: pointer;
          transition: var(--transition);
        }

        .finance-edit:hover,
        .finance-cancel-edit:hover {
          border-color: #858c98;
          background: #2b2d33;
          color: #fff;
        }

        .finance-edit:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .finance-cancel-edit {
          margin-right: 7px;
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

        .finance-delete:disabled {
          opacity: 0.4;
          cursor: not-allowed;
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

          .finance-backup-panel {
            align-items: flex-start;
            flex-direction: column;
          }

          .finance-backup-actions {
            width: 100%;
          }

          .finance-backup-actions button,
          .finance-import-button {
            flex: 1;
          }
        }

        
        /* Correção específica da lista financeira em telas touch */
        @media (max-width: 760px) {
          .finance-list {
            gap: 9px;
          }

          .finance-item {
            display: grid !important;
            grid-template-columns: 36px minmax(0, 1fr) !important;
            align-items: start !important;
            column-gap: 10px !important;
            row-gap: 7px !important;
            padding: 13px !important;
          }

          .finance-item-icon {
            grid-column: 1 !important;
            grid-row: 1 / span 3 !important;
            width: 36px;
            height: 36px;
          }

          .finance-item-info {
            grid-column: 2 !important;
            width: 100%;
            min-width: 0 !important;
            flex: none !important;
            gap: 4px !important;
          }

          .finance-item-info strong,
          .finance-item-info span {
            display: block;
            width: 100%;
            max-width: 100%;
            overflow: visible !important;
            white-space: normal !important;
            text-overflow: clip !important;
            overflow-wrap: anywhere;
            word-break: normal;
            font-size: 11px;
            line-height: 1.45;
          }

          .finance-item-info strong {
            font-size: 13px;
          }

          .finance-item > strong {
            grid-column: 2 !important;
            justify-self: start;
            margin: 0 !important;
            white-space: normal !important;
            overflow-wrap: anywhere;
            font-size: 14px !important;
          }

          .finance-item-actions {
            grid-column: 1 / -1 !important;
            display: flex !important;
            justify-content: flex-end !important;
            align-items: center;
            flex-wrap: wrap !important;
            width: 100%;
            gap: 7px !important;
            padding-top: 3px;
          }

          .finance-item-actions .finance-edit {
            flex: 1 1 88px;
            min-width: 0;
            min-height: 40px !important;
            padding-inline: 10px;
            font-size: 12px !important;
          }

          .finance-item-actions .finance-delete {
            flex: 0 0 40px;
            width: 40px !important;
            height: 40px !important;
          }

          .finance-settlement-editor {
            grid-column: 1 / -1 !important;
            min-width: 0;
          }

          .finance-settlement-controls {
            align-items: stretch;
          }

          .finance-settlement-controls input {
            flex: 1 1 130px;
            width: auto;
            min-height: 40px;
            font-size: 16px;
          }

          .finance-settlement-controls button {
            min-height: 40px;
          }

          .routine-footer {
            display: flex !important;
            align-items: flex-start !important;
            flex-direction: column !important;
            flex-wrap: wrap;
            gap: 5px 10px !important;
            line-height: 1.5 !important;
            overflow-wrap: anywhere;
          }

          .routine-footer span {
            display: block;
            max-width: 100%;
          }
        }

        @media (max-width: 380px) {
          .finance-item {
            padding: 11px !important;
            column-gap: 8px !important;
          }

          .finance-item-actions .finance-edit {
            flex-basis: 78px;
            font-size: 11px !important;
          }
        }

      `}</style>
    </>
  );
}