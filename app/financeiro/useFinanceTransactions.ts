"use client";

import type { Dispatch, FormEvent, SetStateAction, MutableRefObject } from "react";
import type { Transaction } from "@/lib/finance/types";
import type { FormMovementType } from "@/lib/finance/finance-utils";
import {
  getDefaultCategory,
  getDefaultSubcategory,
  getNextTransactionId,
  isValidDate,
  localDate,
  parseAmount,
} from "@/lib/finance/finance-utils";
import { expandRecurringTransactions } from "@/lib/finance/recurrence-utils";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type FinanceFormState = {
  description: string;
  amount: string;
  settledAmount: string;
  type: FormMovementType;
  category: string;
  subcategory: string;
  date: string;
  account: string;
  destinationAccount: string;
  paymentMethod: string;
  status: string;
  recurrence: string;
  institution: string;
};

type FinanceFormSetters = {
  setDescription: Dispatch<SetStateAction<string>>;
  setAmount: Dispatch<SetStateAction<string>>;
  setSettledAmount: Dispatch<SetStateAction<string>>;
  setType: Dispatch<SetStateAction<FormMovementType>>;
  setCategory: Dispatch<SetStateAction<string>>;
  setSubcategory: Dispatch<SetStateAction<string>>;
  setDate: Dispatch<SetStateAction<string>>;
  setAccount: Dispatch<SetStateAction<string>>;
  setPaymentMethod: Dispatch<SetStateAction<string>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setRecurrence: Dispatch<SetStateAction<string>>;
};

type UseFinanceTransactionsParams = {
  transactions: Transaction[];
  setTransactions: Dispatch<SetStateAction<Transaction[]>>;
  form: FinanceFormState;
  formSetters: FinanceFormSetters;
  editingTransactionId: number | null;
  setEditingTransactionId: Dispatch<SetStateAction<number | null>>;
  settlementInput: string;
  setSettlementInput: Dispatch<SetStateAction<string>>;
  setSettlementEditingId: Dispatch<SetStateAction<number | null>>;
  sessionUserId: string | null;
  safeToSave: boolean;
  remoteReadyRef: MutableRefObject<boolean>;
  sessionUserIdRef: MutableRefObject<string | null>;
  setStorageError: Dispatch<SetStateAction<string | null>>;
  setSyncStatus: Dispatch<SetStateAction<string>>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const SETTLEMENT_EDITABLE_STATUSES = [
  "Pendente",
  "Recebida parcialmente",
  "Paga parcialmente",
  "Prevista",
  "Atrasada",
  "",
];

export function useFinanceTransactions({
  transactions,
  setTransactions,
  form,
  formSetters,
  editingTransactionId,
  setEditingTransactionId,
  settlementInput,
  setSettlementInput,
  setSettlementEditingId,
  sessionUserId,
  safeToSave,
  remoteReadyRef,
  sessionUserIdRef,
  setStorageError,
  setSyncStatus,
  confirm,
}: UseFinanceTransactionsParams) {
  const resetForm = () => {
    formSetters.setDescription("");
    formSetters.setAmount("");
    formSetters.setSettledAmount("");
    formSetters.setType("Despesa");
    formSetters.setCategory("Moradia");
    formSetters.setSubcategory("Aluguel");
    formSetters.setStatus("Pendente");
    formSetters.setRecurrence("Nenhuma");
    formSetters.setDate(localDate());
  };

  function startEditingTransaction(item: Transaction) {
    if (item.type !== "Receita" && item.type !== "Despesa") return;

    setEditingTransactionId(item.id);
    formSetters.setDescription(item.description);
    formSetters.setAmount(String(item.amount).replace(".", ","));
    formSetters.setSettledAmount(
      item.settledAmount === undefined
        ? ""
        : String(item.settledAmount).replace(".", ",")
    );
    formSetters.setType(item.type);
    formSetters.setCategory(item.category || getDefaultCategory(item.type));
    formSetters.setSubcategory(
      item.subcategory ||
        getDefaultSubcategory(item.category || getDefaultCategory(item.type))
    );
    formSetters.setDate(item.date || localDate());
    formSetters.setAccount(item.account || "Conta Corrente");
    formSetters.setPaymentMethod(item.paymentMethod || "PIX");
    formSetters.setStatus(item.status || "Pendente");
    formSetters.setRecurrence(item.recurrence || "Nenhuma");
  }

  function cancelEditingTransaction() {
    setEditingTransactionId(null);
    resetForm();
  }

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const requestedUserId = sessionUserId;
    if (
      !requestedUserId ||
      sessionUserIdRef.current !== requestedUserId ||
      !safeToSave ||
      !remoteReadyRef.current
    ) {
      window.alert(
        "O armazenamento está protegido até que os dados da conta atual sejam carregados e sincronizados. Aguarde ou atualize a tela antes de continuar."
      );
      return;
    }

    const {
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
    } = form;

    const parsedAmount = parseAmount(amount);
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      window.alert("Preencha a descrição e informe um valor válido.");
      return;
    }

    if (!isValidDate(date)) {
      window.alert("Informe uma data válida.");
      return;
    }

    const isPartialStatus =
      status === "Recebida parcialmente" || status === "Paga parcialmente";
    const parsedSettledAmount = isPartialStatus ? parseAmount(settledAmount) : undefined;

    if (
      isPartialStatus &&
      (!Number.isFinite(parsedSettledAmount) ||
        Number(parsedSettledAmount) <= 0 ||
        Number(parsedSettledAmount) >= parsedAmount)
    ) {
      window.alert("Informe um valor parcial maior que zero e menor que o valor total.");
      return;
    }

    if (type === "Receita" && status === "Paga parcialmente") {
      window.alert("Para receitas, selecione 'Recebida parcialmente'.");
      return;
    }

    if (type === "Despesa" && status === "Recebida parcialmente") {
      window.alert("Para despesas, selecione 'Paga parcialmente'.");
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

    const transactionToSave: Transaction = {
      id: editingTransactionId ?? getNextTransactionId(transactions),
      description: description.trim(),
      type,
      amount: parsedAmount,
      settledAmount: parsedSettledAmount,
      date,
      category:
        type === "Transferência" || type === "Investimento" ? type : category,
      subcategory: type === "Transferência" ? "Entre contas" : subcategory,
      account,
      destinationAccount:
        type === "Transferência" ? destinationAccount : investmentDestination,
      paymentMethod,
      status,
      recurrence,
      investment: type === "Investimento" ? subcategory : undefined,
      institution: type === "Investimento" ? institution : undefined,
    };

    setTransactions((current) => {
      if (sessionUserIdRef.current !== requestedUserId) return current;

      if (editingTransactionId !== null) {
        return current.map((item) =>
          item.id === editingTransactionId
            ? {
                ...item,
                ...transactionToSave,
                id: item.id,
                recurrenceGroupId: item.recurrenceGroupId,
                updatedAt: new Date().toISOString(),
              }
            : item
        );
      }

      const newTransaction = {
        ...transactionToSave,
        id: getNextTransactionId(current),
      };

      if (
        recurrence !== "Nenhuma" &&
        (type === "Receita" || type === "Despesa")
      ) {
        return expandRecurringTransactions([...current, newTransaction]);
      }

      return [newTransaction, ...current];
    });

    setEditingTransactionId(null);
    resetForm();
  }

  function openSettlementEditor(item: Transaction) {
    if (
      (item.type !== "Receita" && item.type !== "Despesa") ||
      !SETTLEMENT_EDITABLE_STATUSES.includes(item.status || "")
    ) {
      return;
    }

    setSettlementEditingId(item.id);
    setSettlementInput(
      String(item.settledAmount ?? item.amount).replace(".", ",")
    );
  }

  function saveSettlement(item: Transaction) {
    const requestedUserId = sessionUserId;
    if (
      !requestedUserId ||
      sessionUserIdRef.current !== requestedUserId ||
      !safeToSave ||
      !remoteReadyRef.current
    ) {
      setSyncStatus("Aguardando sincronização para alterar o lançamento");
      return;
    }

    const isIncome = item.type === "Receita";
    const isExpense = item.type === "Despesa";
    if (
      (!isIncome && !isExpense) ||
      !SETTLEMENT_EDITABLE_STATUSES.includes(item.status || "")
    ) {
      return;
    }

    const effectiveAmount = parseAmount(settlementInput);
    if (
      !Number.isFinite(effectiveAmount) ||
      effectiveAmount <= 0 ||
      effectiveAmount > item.amount
    ) {
      setSyncStatus(
        "Informe um valor maior que zero e igual ou inferior ao valor do lançamento"
      );
      return;
    }

    const isFullySettled = effectiveAmount >= item.amount;
    const nextStatus = isIncome
      ? isFullySettled ? "Recebida" : "Recebida parcialmente"
      : isFullySettled ? "Pago" : "Paga parcialmente";

    setTransactions((current) => {
      if (sessionUserIdRef.current !== requestedUserId) return current;
      return current.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              status: nextStatus,
              settledAmount: effectiveAmount,
              updatedAt: new Date().toISOString(),
            }
          : currentItem
      );
    });

    setSettlementEditingId(null);
    setSettlementInput("");
    setSyncStatus(
      nextStatus === "Recebida parcialmente" || nextStatus === "Paga parcialmente"
        ? "Valor parcial registrado; sincronizando"
        : "Lançamento confirmado; sincronizando"
    );
  }

  async function removeTransaction(id: number) {
    const requestedUserId = sessionUserId;
    if (
      !requestedUserId ||
      sessionUserIdRef.current !== requestedUserId ||
      !safeToSave ||
      !remoteReadyRef.current
    ) {
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

    if (
      !accepted ||
      sessionUserIdRef.current !== requestedUserId ||
      !remoteReadyRef.current
    ) {
      return;
    }

    setTransactions((current) => {
      if (sessionUserIdRef.current !== requestedUserId) return current;
      return current.filter((item) => item.id !== id);
    });
    setStorageError(null);
    setSyncStatus("Lançamento excluído; sincronizando");
  }

  return {
    addTransaction,
    startEditingTransaction,
    cancelEditingTransaction,
    openSettlementEditor,
    saveSettlement,
    removeTransaction,
  };
}
