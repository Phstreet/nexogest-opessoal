"use client";

import "./financeiro.css";

import { useNexoConfirm } from "@/contexts/NexoConfirmProvider";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { Transaction } from "@/lib/finance/types";
import { categoriesByType, subcategories } from "@/lib/finance/categories";
import FinanceSummaryCards from "./FinanceSummaryCards";
import FinanceMovementList from "./FinanceMovementList";
import FinanceTransactionForm from "./FinanceTransactionForm";
import { useFinanceCloudSync } from "./useFinanceCloudSync";
import type { FormMovementType } from "@/lib/finance/finance-utils";
import {
  calculateFinanceTotals,
  getMovementFilterOptions,
  getDefaultCategory,
  getDefaultSubcategory,
  getNextTransactionId,
  isValidDate,
  localDate,
  parseAmount,
} from "@/lib/finance/finance-utils";
import { expandRecurringTransactions } from "@/lib/finance/recurrence-utils";
import {
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
  const transactionFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (editingTransactionId === null) return;

    const form = transactionFormRef.current;
    if (!form) return;

    form.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstInput = form.querySelector<HTMLInputElement>("input");
    firstInput?.focus({ preventScroll: true });
  }, [editingTransactionId]);

  const {
    registeredAccounts,
    safeToSave,
    setSafeToSave,
    invalidCount,
    storageError,
    setStorageError,
    setSyncStatus,
    revisionRef,
    remoteReadyRef,
    lastSavedPayloadRef,
    saveQueueRef,
    sessionUserIdRef,
  } = useFinanceCloudSync({
    session,
    authLoading,
    transactions,
    setTransactions,
    setDate,
  });

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

  const totals = useMemo(() => calculateFinanceTotals(transactions), [transactions]);

  const filterOptions = useMemo(
    () => getMovementFilterOptions(transactions, movementTypes),
    [transactions]
  );

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

    if (!safeToSave || !remoteReadyRef.current || !session?.user.id) {
      window.alert(
        "O armazenamento está protegido até que os dados da conta atual sejam carregados e sincronizados. Aguarde ou atualize a tela antes de continuar."
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
    const requestedUserId = session?.user.id;
    if (!requestedUserId) return;

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
      if (sessionUserIdRef.current !== requestedUserId || !remoteReadyRef.current) return;

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

      if (sessionUserIdRef.current !== requestedUserId) return;

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
      if (sessionUserIdRef.current !== requestedUserId) return;
      console.error("Erro ao registrar valor efetivo:", error);
      setSyncStatus("Não foi possível atualizar o lançamento");
    }
  }

  async function removeTransaction(id: number) {
    const requestedUserId = session?.user.id;
    if (!requestedUserId) return;

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

    if (!accepted || sessionUserIdRef.current !== requestedUserId) return;

    try {
      // Aguarda qualquer gravação anterior para usar a revisão mais recente.
      await saveQueueRef.current;
      if (sessionUserIdRef.current !== requestedUserId || !remoteReadyRef.current) return;

      const latestTransactions = transactions.filter((item) => item.id !== id);
      const result = await saveRemoteCollection(
        STORAGE_KEY,
        latestTransactions,
        revisionRef.current
      );

      if (sessionUserIdRef.current !== requestedUserId) return;

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
      if (sessionUserIdRef.current !== requestedUserId) return;
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

        <FinanceTransactionForm
          formRef={transactionFormRef}
          onSubmit={addTransaction}
          editingTransactionId={editingTransactionId}
          description={description}
          setDescription={setDescription}
          amount={amount}
          setAmount={setAmount}
          type={type}
          changeType={changeType}
          movementTypes={movementTypes}
          category={category}
          changeCategory={changeCategory}
          availableCategories={availableCategories}
          subcategory={subcategory}
          setSubcategory={setSubcategory}
          availableSubcategories={availableSubcategories}
          investmentOptions={investmentOptions}
          institution={institution}
          setInstitution={setInstitution}
          institutions={institutions}
          paymentMethods={paymentMethods}
          date={date}
          setDate={setDate}
          account={account}
          setAccount={setAccount}
          accountOptions={accountOptions}
          destinationAccount={destinationAccount}
          setDestinationAccount={setDestinationAccount}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          status={status}
          setStatus={setStatus}
          settledAmount={settledAmount}
          setSettledAmount={setSettledAmount}
          recurrence={recurrence}
          setRecurrence={setRecurrence}
          recurrences={recurrences}
          safeToSave={safeToSave}
          onCancelEditing={cancelEditingTransaction}
        />

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