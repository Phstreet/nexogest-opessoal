"use client";

import "./financeiro.css";

import { useNexoConfirm } from "@/contexts/NexoConfirmProvider";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Transaction } from "@/lib/finance/types";
import { categoriesByType, subcategories } from "@/lib/finance/categories";
import FinanceSummaryCards from "./FinanceSummaryCards";
import FinanceMovementList from "./FinanceMovementList";
import FinanceTransactionForm from "./FinanceTransactionForm";
import { useFinanceCloudSync } from "./useFinanceCloudSync";
import { useFinanceTransactions } from "./useFinanceTransactions";
import type { FormMovementType } from "@/lib/finance/finance-utils";
import {
  calculateFinanceTotals,
  getMovementFilterOptions,
  getDefaultCategory,
  getDefaultSubcategory,
} from "@/lib/finance/finance-utils";


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
    invalidCount,
    storageError,
    syncStatus,
    setStorageError,
    setSyncStatus,
    remoteReadyRef,
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


  const {
    addTransaction,
    startEditingTransaction,
    cancelEditingTransaction,
    openSettlementEditor,
    saveSettlement,
    removeTransaction,
  } = useFinanceTransactions({
    transactions,
    setTransactions,
    form: {
      description,
      amount,
      settledAmount,
      type,
      category,
      subcategory,
      date,
      account,
      destinationAccount,
      paymentMethod,
      status,
      recurrence,
      institution,
    },
    formSetters: {
      setDescription,
      setAmount,
      setSettledAmount,
      setType,
      setCategory,
      setSubcategory,
      setDate,
      setAccount,
      setPaymentMethod,
      setStatus,
      setRecurrence,
    },
    editingTransactionId,
    setEditingTransactionId,
    settlementInput,
    setSettlementInput,
    setSettlementEditingId,
    sessionUserId: session?.user.id ?? null,
    safeToSave,
    remoteReadyRef,
    sessionUserIdRef,
    setStorageError,
    setSyncStatus,
    confirm,
  });

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
          <section className="finance-storage-warning" role="alert">
            <strong>{invalidCount} registro(s) inválido(s) detectado(s)</strong>
            <p>
              A gravação foi bloqueada para proteger os dados existentes no Supabase.
              Nenhum desses registros foi alterado automaticamente.
            </p>
          </section>
        )}

        <p className="finance-sync-status" role="status" aria-live="polite">
          {syncStatus}
        </p>

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