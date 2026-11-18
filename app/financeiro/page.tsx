"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";

import type { Account, Transaction } from "@/lib/finance/types";
import {
  fetchRemoteCollections,
  getCurrentSession,
  saveRemoteCollection,
} from "@/lib/supabase/client";

import {
  FINANCE_STORAGE_KEYS,
  getAccounts,
  loadTransactionsSafely,
} from "@/lib/finance/storage";

type FormMovementType =
  | "Receita"
  | "Despesa"
  | "Transferência"
  | "Investimento";

type MovementType = FormMovementType | "Aplicação" | "Reserva";

const STORAGE_KEY = FINANCE_STORAGE_KEYS.transactions;
const BACKUP_KEY = "nexo_transactions_backup";
const INVALID_KEY = "nexo_transactions_invalid";

const categoriesByType: Record<FormMovementType, string[]> = {
  Receita: [
    "Salário",
    "13º Salário",
    "Adiantamento Salarial",
    "Horas Extras",
    "Comissões",
    "Trabalhos Extras",
    "Reembolsos",
    "Receitas Eventuais",
    "Rendimentos",
    "Outros",
  ],
  Despesa: [
    "Moradia",
    "Alimentação",
    "Transporte",
    "Saúde",
    "Educação",
    "Lazer",
    "Serviços",
    "Assinaturas",
    "Religião",
    "Impostos",
    "Dívidas",
    "Outros",
  ],
  Transferência: ["Transferência"],
  Investimento: ["Investimento"],
};

const subcategories: Record<string, string[]> = {
  Salário: ["Salário mensal", "Adiantamento", "Outros"],
  "13º Salário": [
    "Primeira parcela",
    "Segunda parcela",
    "Integral",
    "Outros",
  ],
  "Adiantamento Salarial": ["Adiantamento", "Outros"],
  "Horas Extras": ["Horas extras", "DSR", "Outros"],
  Comissões: ["Comissão", "Outros"],
  "Trabalhos Extras": ["Serviços extras", "Freelance", "Outros"],
  Reembolsos: ["Reembolso de despesas", "Outros"],
  "Receitas Eventuais": ["Venda", "Presente", "Outros"],
  Rendimentos: [
    "Rendimento de conta",
    "Rendimento financeiro",
    "Outros",
  ],
  Moradia: [
    "Aluguel",
    "Condomínio",
    "Energia",
    "Água",
    "Internet",
    "Gás",
    "Manutenção",
    "Móveis",
    "Casa",
    "Outros",
  ],
  Alimentação: [
    "Mercado",
    "Restaurante",
    "iFood",
    "Keeta",
    "99 Food",
    "Lanches",
    "Outros",
  ],
  Transporte: [
    "Combustível",
    "Transporte público",
    "Aplicativos",
    "Estacionamento",
    "Manutenção do veículo",
    "Carro",
    "Outros",
  ],
  Saúde: [
    "Plano de saúde",
    "Consulta",
    "Exames",
    "Medicamentos",
    "Odontologia",
    "Outros",
  ],
  Educação: [
    "Cursos",
    "Material escolar",
    "Livros",
    "Notebook",
    "Outros",
  ],
  Lazer: [
    "Viagem",
    "Cinema",
    "Passeios",
    "Eventos",
    "Televisão",
    "Outros",
  ],
  Serviços: [
    "Telefonia",
    "Internet",
    "Manutenção",
    "Serviços domésticos",
    "Outros",
  ],
  Assinaturas: ["Streaming", "Telefonia", "Aplicativos", "Outros"],
  Religião: ["Dízimo", "Oferta", "Doação", "Caixinha", "Outros"],
  Impostos: ["IPVA", "IPTU", "Imposto de renda", "Multas", "Outros"],
  Dívidas: [
    "Empréstimo",
    "Cartão de crédito",
    "Financiamento",
    "Parcelamento",
    "Outros",
  ],
  Outros: ["Notebook", "Televisão", "Carro", "Casa", "Viagem", "Outros"],
  Transferência: ["Entre contas"],
};

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

function createBackup(rawData: string) {
  const backup = {
    version: 1,
    createdAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    rawData,
  };

  window.localStorage.setItem(
    BACKUP_KEY,
    JSON.stringify(backup)
  );
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

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function Page() {
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
  const [institution, setInstitution] = useState("Nubank");
  const [filter, setFilter] = useState("Todos");
  const [loaded, setLoaded] = useState(false);
  const [safeToSave, setSafeToSave] = useState(false);
  const [invalidCount, setInvalidCount] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [backupAvailable, setBackupAvailable] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Conectando ao banco de dados...");
  const revisionRef = useRef(0);
  const remoteReadyRef = useRef(false);
  const lastSavedPayloadRef = useRef("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;

    async function initializeFinanceData() {
      setDate(localDate());

      const localResult = loadTransactionsSafely();
      const localRaw = window.localStorage.getItem(STORAGE_KEY);

      setRegisteredAccounts(getAccounts());
      setInvalidCount(localResult.invalidRecords.length);
      setBackupAvailable(Boolean(window.localStorage.getItem(BACKUP_KEY)));

      try {
        const session = await getCurrentSession();

        if (!active) return;

        if (!session) {
          setTransactions(localResult.transactions);
          setSafeToSave(false);
          setStorageError(
            "Entre na sua conta NEXO para carregar e salvar os lançamentos no banco de dados. Os dados antigos deste navegador foram preservados."
          );
          setSyncStatus("Aguardando autenticação");
          setLoaded(true);
          return;
        }

        const collections = await fetchRemoteCollections();
        if (!active) return;

        const remoteTransactions = collections.find(
          (item) => item.data_key === STORAGE_KEY
        );

        if (remoteTransactions) {
          if (!Array.isArray(remoteTransactions.payload)) {
            throw new Error(
              "Os lançamentos encontrados no banco estão em um formato inválido. Nenhum dado foi sobrescrito."
            );
          }

          const cloudRecords = remoteTransactions.payload.filter(isValidTransaction);
          const invalidCloudRecords = remoteTransactions.payload.filter(
            (item) => !isValidTransaction(item)
          );

          if (
            localRaw !== null &&
            JSON.stringify(localResult.transactions) !== JSON.stringify(cloudRecords)
          ) {
            createBackup(localRaw);
            setBackupAvailable(true);
          }

          revisionRef.current = remoteTransactions.revision;
          lastSavedPayloadRef.current = JSON.stringify(cloudRecords);
          setTransactions(cloudRecords);
          setInvalidCount(invalidCloudRecords.length);
          setSafeToSave(invalidCloudRecords.length === 0);
          setStorageError(
            invalidCloudRecords.length > 0
              ? "Existem registros inválidos no banco de dados. A gravação foi bloqueada para evitar perda dessas informações."
              : null
          );
          setSyncStatus(
            invalidCloudRecords.length > 0
              ? "Verificação necessária"
              : "Dados carregados do Supabase"
          );
        } else {
          if (localRaw !== null) {
            createBackup(localRaw);
            setBackupAvailable(true);
          }

          const legacyRecords = localResult.transactions;

          if (!localResult.safeToSave) {
            setTransactions(legacyRecords);
            setSafeToSave(false);
            setStorageError(
              localResult.error ||
                "Os dados locais precisam ser verificados antes da migração. Nenhuma informação foi enviada ou removida."
            );
            setSyncStatus("Migração pausada por segurança");
            setLoaded(true);
            return;
          }

          const migration = await saveRemoteCollection(
            STORAGE_KEY,
            legacyRecords,
            0
          );

          if (!active) return;

          if (!migration.saved) {
            const refreshedCollections = await fetchRemoteCollections();
            const refreshed = refreshedCollections.find(
              (item) => item.data_key === STORAGE_KEY
            );

            if (!refreshed || !Array.isArray(refreshed.payload)) {
              throw new Error(
                "Não foi possível concluir a migração com segurança. Os dados locais continuam preservados."
              );
            }

            const refreshedRecords = refreshed.payload.filter(isValidTransaction);
            const refreshedInvalid = refreshed.payload.filter(
              (item) => !isValidTransaction(item)
            );

            revisionRef.current = refreshed.revision;
            lastSavedPayloadRef.current = JSON.stringify(refreshedRecords);
            setTransactions(refreshedRecords);
            setInvalidCount(refreshedInvalid.length);
            setSafeToSave(refreshedInvalid.length === 0);
            setStorageError(
              refreshedInvalid.length > 0
                ? "Existem registros inválidos no banco. A gravação foi bloqueada."
                : null
            );
            setSyncStatus("Dados atualizados do Supabase");
          } else {
            revisionRef.current = migration.current_revision ?? 1;
            lastSavedPayloadRef.current = JSON.stringify(legacyRecords);
            setTransactions(legacyRecords);
            setSafeToSave(true);
            setStorageError(null);
            setSyncStatus(
              "Migração concluída: " + legacyRecords.length +
                " lançamento(s) enviados ao Supabase"
            );
          }
        }

        remoteReadyRef.current = true;
        setLoaded(true);
      } catch (error) {
        if (!active) return;

        console.error("Falha ao carregar os lançamentos do Supabase:", error);
        setTransactions(localResult.transactions);
        setSafeToSave(false);
        setStorageError(
          error instanceof Error
            ? error.message + " Os dados locais foram preservados e nenhuma gravação foi realizada."
            : "Não foi possível acessar o banco de dados. Os dados locais foram preservados."
        );
        setSyncStatus("Falha na conexão com o Supabase");
        setLoaded(true);
      }
    }

    initializeFinanceData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !safeToSave || !remoteReadyRef.current) return;

    const serializedPayload = JSON.stringify(transactions);
    if (serializedPayload === lastSavedPayloadRef.current) return;

    saveQueueRef.current = saveQueueRef.current.then(async () => {
      if (!remoteReadyRef.current) return;

      try {
        const result = await saveRemoteCollection(
          STORAGE_KEY,
          transactions,
          revisionRef.current
        );

        if (!result.saved) {
          setSafeToSave(false);
          setStorageError(
            "O banco informou que os dados foram alterados em outra sessão. Para evitar sobrescrever informações, a gravação foi pausada. Atualize a página para carregar a versão mais recente."
          );
          setSyncStatus("Conflito de sincronização");
          return;
        }

        revisionRef.current =
          result.current_revision ?? revisionRef.current + 1;
        lastSavedPayloadRef.current = serializedPayload;
        setStorageError(null);
        setSyncStatus("Sincronizado com o Supabase");
      } catch (error) {
        console.error("Não foi possível salvar os lançamentos no Supabase:", error);
        setSafeToSave(false);
        setStorageError(
          error instanceof Error
            ? error.message + " A gravação foi pausada para proteger os dados."
            : "Falha ao salvar no banco de dados. A gravação foi pausada para proteger os dados."
        );
        setSyncStatus("Erro ao sincronizar");
      }
    });
  }, [transactions, loaded, safeToSave]);

  const accountOptions = useMemo(() => {
    const registeredNames = new Set(
      registeredAccounts.map((item) => item.name)
    );

    const activeNames = registeredAccounts
      .filter((item) => item.active)
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

    const newTransaction: Transaction = {
      id: getNextTransactionId(transactions),
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

    setTransactions((current) => [
      newTransaction,
      ...current,
    ]);

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

  function removeTransaction(id: number) {
    if (!safeToSave) {
      window.alert(
        "A exclusão está bloqueada enquanto o armazenamento estiver em modo de proteção."
      );
      return;
    }

    if (!window.confirm("Deseja excluir este lançamento?")) {
      return;
    }

    setTransactions((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  function exportBackup() {
    try {
      const invalidData =
        window.localStorage.getItem(INVALID_KEY);

      const backup = {
        application: "NEXO — Gestão Pessoal",
        version: 1,
        exportedAt: new Date().toISOString(),
        storageKey: STORAGE_KEY,
        source: "Supabase",
        transactions,
        invalidRecords: invalidData
          ? JSON.parse(invalidData)
          : null,
      };

      downloadJson(
        `nexo-backup-financeiro-${localDate()}.json`,
        JSON.stringify(backup, null, 2)
      );
    } catch (error) {
      console.error("Erro ao exportar backup:", error);
      window.alert(
        "Não foi possível exportar os dados financeiros."
      );
    }
  }

  function restoreLocalBackup() {
    const savedBackup =
      window.localStorage.getItem(BACKUP_KEY);

    if (!savedBackup) {
      window.alert("Nenhum backup local foi encontrado.");
      return;
    }

    if (
      !window.confirm(
        "Deseja restaurar o último backup? Os lançamentos atuais serão substituídos pela versão salva no backup."
      )
    ) {
      return;
    }

    try {
      const parsedBackup: unknown = JSON.parse(savedBackup);

      if (
        !parsedBackup ||
        typeof parsedBackup !== "object" ||
        !("rawData" in parsedBackup) ||
        typeof parsedBackup.rawData !== "string"
      ) {
        throw new Error("Formato de backup inválido.");
      }

      const parsedData: unknown = JSON.parse(
        parsedBackup.rawData
      );

      if (!Array.isArray(parsedData)) {
        throw new Error("O backup não contém uma lista válida.");
      }

      const validRecords = parsedData.filter(isValidTransaction);
      const invalidRecords = parsedData.filter(
        (item) => !isValidTransaction(item)
      );

      // Mantém o backup disponível até a restauração terminar.
      window.localStorage.setItem(
        STORAGE_KEY,
        parsedBackup.rawData
      );

      if (invalidRecords.length > 0) {
        window.localStorage.setItem(
          INVALID_KEY,
          JSON.stringify({
            createdAt: new Date().toISOString(),
            records: invalidRecords,
          })
        );
      }

      setTransactions(validRecords);
      setInvalidCount(invalidRecords.length);
      setSafeToSave(true);
      setStorageError(null);

      window.alert(
        `Backup restaurado. ${validRecords.length} lançamento(s) válido(s) recuperado(s).`
      );
    } catch (error) {
      console.error("Erro ao restaurar backup:", error);
      window.alert(
        "Não foi possível restaurar o backup. Os dados atuais foram mantidos."
      );
    }
  }

  function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!safeToSave) {
      window.alert(
        "A importação está bloqueada enquanto o armazenamento estiver em modo de proteção."
      );
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const content = String(reader.result || "");
        const parsed: unknown = JSON.parse(content);

        let records: unknown;

        if (Array.isArray(parsed)) {
          records = parsed;
        } else if (
          parsed &&
          typeof parsed === "object" &&
          "transactions" in parsed
        ) {
          records = parsed.transactions;
        }

        if (!Array.isArray(records)) {
          throw new Error("Formato de arquivo não reconhecido.");
        }

        const validRecords = records.filter(isValidTransaction);
        const invalidRecords = records.filter(
          (item) => !isValidTransaction(item)
        );

        if (validRecords.length === 0 && records.length > 0) {
          throw new Error(
            "Nenhum lançamento válido foi encontrado no arquivo."
          );
        }

        if (
          !window.confirm(
            `Foram encontrados ${validRecords.length} lançamento(s) válido(s) e ${invalidRecords.length} registro(s) inválido(s). Deseja substituir os dados atuais?`
          )
        ) {
          return;
        }

        const currentData =
          window.localStorage.getItem(STORAGE_KEY) ?? "[]";

        createBackup(currentData);

        if (invalidRecords.length > 0) {
          window.localStorage.setItem(
            INVALID_KEY,
            JSON.stringify({
              createdAt: new Date().toISOString(),
              records: invalidRecords,
            })
          );
        }

        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(validRecords)
        );

        setTransactions(validRecords);
        setInvalidCount(invalidRecords.length);
        setStorageError(null);
        setBackupAvailable(true);

        window.alert(
          `Importação concluída. ${validRecords.length} lançamento(s) recuperado(s).`
        );
      } catch (error) {
        console.error("Erro ao importar backup:", error);
        window.alert(
          "Não foi possível importar o arquivo. Os dados atuais foram preservados."
        );
      } finally {
        event.target.value = "";
      }
    };

    reader.onerror = () => {
      window.alert("Não foi possível ler o arquivo selecionado.");
      event.target.value = "";
    };

    reader.readAsText(file);
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

        {storageError && (
          <section className="finance-storage-alert" role="alert">
            <strong>Proteção dos dados ativada</strong>
            <p>{storageError}</p>
            <span>
              Não atualize nem limpe os dados do navegador antes de
              verificar as opções de recuperação.
            </span>

            <div className="finance-storage-actions">
              <button type="button" onClick={exportBackup}>
                Exportar dados atuais
              </button>

              {backupAvailable && (
                <button
                  type="button"
                  onClick={restoreLocalBackup}
                >
                  Restaurar último backup
                </button>
              )}
            </div>
          </section>
        )}

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

        <section className="finance-backup-panel">
          <div>
            <strong>Banco de dados e segurança</strong>
            <span>
              {syncStatus}. Os lançamentos são armazenados na nuvem por usuário.
              O backup local antigo continua disponível para recuperação.
            </span>
          </div>

          <div className="finance-backup-actions">
            <button
              type="button"
              onClick={exportBackup}
            >
              Exportar backup
            </button>

            <label className="finance-import-button">
              Importar backup
              <input
                type="file"
                accept=".json,application/json"
                onChange={importBackup}
              />
            </label>

            <button
              type="button"
              onClick={restoreLocalBackup}
              disabled={!backupAvailable}
            >
              Restaurar último backup
            </button>
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
                type === "Transferência" ||
                type === "Investimento"
                  ? "Conta de origem"
                  : "Conta financeira"
              }
              value={account}
              onChange={setAccount}
              options={accountOptions}
            />

            {type === "Transferência" && (
              <SelectField
                label="Conta de destino"
                value={destinationAccount}
                onChange={setDestinationAccount}
                options={accountOptions}
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
            <button type="submit" disabled={!safeToSave}>
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

                  <button
                    type="button"
                    className="finance-delete"
                    onClick={() => removeTransaction(item.id)}
                    aria-label={`Excluir ${item.description}`}
                    disabled={!safeToSave}
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
      `}</style>
    </>
  );
}