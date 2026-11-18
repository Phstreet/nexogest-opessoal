
"use client";

import { useNexoConfirm } from "@/contexts/NexoConfirmProvider";

import { useMemo, useState, type FormEvent } from "react";
import { useCloudFinanceCollections } from "@/hooks/useCloudFinanceCollections";
import { categoriesByType, subcategories } from "@/lib/finance/categories";
import { expandRecurringTransactions } from "@/lib/finance/recurrence-utils";

type Transaction = {
  id: number;
  description: string;
  type: "Receita" | "Despesa" | "Transferência" | "Investimento" | "Aplicação" | "Reserva";
  amount: number;
  settledAmount?: number;
  date?: string;
  category?: string;
  subcategory?: string;
  account?: string;
  destinationAccount?: string;
  paymentMethod?: string;
  status?: string;
  recurrence?: string;
};

type FilterType =
  | "Todas"
  | "Em aberto"
  | "Recebidas"
  | "Atrasadas"
  | "Canceladas";


function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "Sem data";

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "Sem data";

  return date.toLocaleDateString("pt-BR");
}

function getToday() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseCurrencyInput(value: string): number {
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return NaN;
  return Number(normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized);
}

function isReceived(status?: string) {
  return status === "Recebida";
}

function getSettledAmount(transaction: Transaction) {
  const amount = Math.max(0, Number(transaction.amount) || 0);
  if (transaction.settledAmount !== undefined) return Math.min(amount, Math.max(0, Number(transaction.settledAmount) || 0));
  return isReceived(transaction.status) ? amount : 0;
}
function getOpenAmount(transaction: Transaction) { return Math.max(0, Number(transaction.amount || 0) - getSettledAmount(transaction)); }
function isPartiallyReceived(transaction: Transaction) { return getSettledAmount(transaction) > 0 && getOpenAmount(transaction) > 0; }

function isCancelled(status?: string) {
  return status === "Cancelada";
}

function isOverdue(transaction: Transaction) {
  if (
    !transaction.date ||
    getOpenAmount(transaction) <= 0 ||
    isCancelled(transaction.status)
  ) {
    return false;
  }

  return transaction.date.slice(0, 10) < getToday();
}

function getStatus(transaction: Transaction) {
  if (isCancelled(transaction.status)) return "Cancelada";
  if (isReceived(transaction.status)) return "Recebida";
  if (isOverdue(transaction)) return "Atrasada";
  if (isPartiallyReceived(transaction)) return "Recebida parcialmente";

  return transaction.status || "Pendente";
}

export default function ContasAReceberPage() {
  const confirm = useNexoConfirm();
  const { transactions, accounts, loaded: cloudLoaded, error: cloudError, saveTransactions } = useCloudFinanceCollections();
  const registeredAccounts = useMemo(() => accounts.filter((account) => account.active).sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))), [accounts]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("Todas");
  const loading = !cloudLoaded;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ description: "", amount: "", settledAmount: "0", date: getToday(), category: "", subcategory: "", account: "", paymentMethod: "PIX", status: "Pendente", recurrence: "Nenhuma" });


  const revenues = useMemo(() => {
    return transactions.filter((item) => item.type === "Receita");
  }, [transactions]);

  const categoryOptions = categoriesByType.Receita;
  const subcategoryOptions = subcategories[draft.category] || ["Outros"];
  const accountOptions = Array.from(new Set([
    ...registeredAccounts.map((account) => account.name),
    draft.account,
  ].filter(Boolean)));

  const activeRevenues = useMemo(
    () => revenues.filter((item) => !isCancelled(item.status)),
    [revenues]
  );

  const totalOpen = useMemo(
    () =>
      activeRevenues
        .reduce((total, item) => total + getOpenAmount(item), 0),
    [activeRevenues]
  );

  const totalReceived = useMemo(
    () =>
      activeRevenues
        .reduce((total, item) => total + getSettledAmount(item), 0),
    [activeRevenues]
  );

  const totalOverdue = useMemo(
    () =>
      activeRevenues
        .filter((item) => isOverdue(item))
        .reduce((total, item) => total + getOpenAmount(item), 0),
    [activeRevenues]
  );

  const totalCancelled = useMemo(
    () =>
      revenues
        .filter((item) => isCancelled(item.status))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [revenues]
  );

  const filteredRevenues = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return revenues
      .filter((item) => {
        const matchesSearch =
          item.description.toLowerCase().includes(normalizedSearch) ||
          (item.category || "").toLowerCase().includes(normalizedSearch) ||
          (item.subcategory || "").toLowerCase().includes(normalizedSearch);

        const status = getStatus(item);

        let matchesFilter = true;

        if (filter === "Em aberto") {
          matchesFilter =
            getOpenAmount(item) > 0 && !isCancelled(item.status);
        }

        if (filter === "Recebidas") {
          matchesFilter = isReceived(item.status);
        }

        if (filter === "Atrasadas") {
          matchesFilter = isOverdue(item);
        }

        if (filter === "Canceladas") {
          matchesFilter = status === "Cancelada";
        }

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const dateA = a.date || "9999-12-31";
        const dateB = b.date || "9999-12-31";

        return dateA.localeCompare(dateB);
      });
  }, [revenues, search, filter]);

  async function updateStatus(id: number, newStatus: string) {
    const updatedTransactions = transactions.map((item) =>
      item.id === id ? { ...item, status: newStatus, settledAmount: newStatus === "Pendente" ? 0 : newStatus === "Recebida" ? Number(item.amount || 0) : item.settledAmount } : item
    );

    try { await saveTransactions(updatedTransactions); }
    catch (error) { alert(error instanceof Error ? error.message : "Não foi possível salvar a alteração na nuvem."); }
  }

  async function markAsReceived(item: Transaction) {
    const confirmed = await confirm({ title: "Confirmar recebimento", message: `Confirma o recebimento do saldo restante de "${item.description}" no valor de ${formatCurrency(getOpenAmount(item))}?`, confirmLabel: "Confirmar" });

    if (confirmed) {
      updateStatus(item.id, "Recebida");
    }
  }

  async function reopenRevenue(item: Transaction) {
    const confirmed = await confirm({ title: "Reabrir receita", message: `Deseja reabrir a receita "${item.description}"?`, confirmLabel: "Reabrir" });

    if (confirmed) {
      updateStatus(item.id, "Pendente");
    }
  }

  function openRevenueEditor(item?: Transaction) {
    const defaultCategory = item?.category || categoryOptions[0];
    const primaryAccount = registeredAccounts.find((account) => account.isPrimary) || registeredAccounts[0];
    setEditingId(item?.id ?? null);
    setDraft({
      description: item?.description ?? "",
      amount: item ? String(item.amount).replace(".", ",") : "",
      settledAmount: item ? String(getSettledAmount(item)).replace(".", ",") : "0",
      date: item?.date || getToday(),
      category: defaultCategory,
      subcategory: item?.subcategory || subcategories[defaultCategory]?.[0] || "Outros",
      account: item?.account || primaryAccount?.name || "",
      paymentMethod: item?.paymentMethod || "PIX",
      status: item?.status || "Pendente",
      recurrence: item?.recurrence || "Nenhuma",
    });
    setEditorOpen(true);
  }

  async function saveRevenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseCurrencyInput(draft.amount);
    const settledAmount = draft.settledAmount.trim() ? parseCurrencyInput(draft.settledAmount) : 0;
    if (!draft.description.trim() || !Number.isFinite(amount) || amount <= 0) { alert("Informe uma descrição e um valor válido."); return; }
    if (!draft.account || !registeredAccounts.some((account) => account.name === draft.account)) { alert("Selecione uma conta ativa cadastrada em Financeiro > Contas."); return; }
    if (!Number.isFinite(settledAmount) || settledAmount < 0 || settledAmount > amount) { alert("O valor recebido não pode ser negativo nem ultrapassar o valor total."); return; }
    const effectiveSettledAmount = draft.status === "Recebida" ? amount : settledAmount;
    const status = effectiveSettledAmount >= amount ? "Recebida" : effectiveSettledAmount > 0 ? "Recebida parcialmente" : draft.status === "Recebida parcialmente" ? "Pendente" : draft.status;
    const entry: Transaction = { id: editingId ?? Math.max(Date.now(), ...transactions.map((item) => item.id + 1), 1), description: draft.description.trim(), type: "Receita", amount, settledAmount: effectiveSettledAmount, date: draft.date, category: draft.category.trim(), subcategory: draft.subcategory.trim(), account: draft.account.trim(), paymentMethod: draft.paymentMethod, status, recurrence: draft.recurrence };
    const updated = editingId === null
      ? expandRecurringTransactions([...transactions, entry])
      : transactions.map((item) => item.id === editingId ? { ...item, ...entry, id: item.id } : item);
    try { await saveTransactions(updated); setEditorOpen(false); setEditingId(null); }
    catch (error) { alert(error instanceof Error ? error.message : "Não foi possível salvar na nuvem."); }
  }
  async function registerPartialReceipt(item: Transaction) {
    const openAmount = getOpenAmount(item);
    const entered = window.prompt(
      `Informe quanto foi recebido agora. Saldo restante: ${formatCurrency(openAmount)}`,
      ""
    );
    if (entered === null) return;
    const receipt = parseCurrencyInput(entered);
    if (!Number.isFinite(receipt) || receipt <= 0 || receipt > openAmount) {
      alert("Informe um valor maior que zero e menor ou igual ao saldo pendente.");
      return;
    }
    const settledAmount = getSettledAmount(item) + receipt;
    const nextStatus = settledAmount >= Number(item.amount || 0) ? "Recebida" : "Recebida parcialmente";
    const updatedTransactions = transactions.map((transaction) =>
      transaction.id === item.id ? { ...transaction, settledAmount, status: nextStatus } : transaction
    );
    try { await saveTransactions(updatedTransactions); }
    catch (error) { alert(error instanceof Error ? error.message : "Não foi possível registrar o recebimento na nuvem."); }
  }

  return (
    <div className="content receivable-content-page">
      {cloudError && <div role="alert" className="finance-cloud-error">{cloudError}</div>}
      <div className="receivable-intro">
        <div>
          <p>
            Acompanhe suas receitas, recebimentos e valores pendentes.
          </p>
        </div>

        
      </div>

      <section className="receivable-summary">
        <article className="receivable-card">
          <div className="receivable-card-top">
            <span>Receitas em aberto</span>
            <span className="receivable-icon">◷</span>
          </div>

          <strong>{formatCurrency(totalOpen)}</strong>
          <small>Valores ainda não recebidos</small>
        </article>

        <article className="receivable-card">
          <div className="receivable-card-top">
            <span>Total recebido</span>
            <span className="receivable-icon">✓</span>
          </div>

          <strong>{formatCurrency(totalReceived)}</strong>
          <small>Receitas já confirmadas</small>
        </article>

        <article className="receivable-card overdue-card">
          <div className="receivable-card-top">
            <span>Receitas atrasadas</span>
            <span className="receivable-icon">!</span>
          </div>

          <strong>{formatCurrency(totalOverdue)}</strong>
          <small>Receitas com data vencida</small>
        </article>

        <article className="receivable-card">
          <div className="receivable-card-top">
            <span>Receitas canceladas</span>
            <span className="receivable-icon">×</span>
          </div>

          <strong>{formatCurrency(totalCancelled)}</strong>
          <small>Valores cancelados</small>
        </article>
      </section>

      {editorOpen && (
        <section className="receivable-editor-panel">
          <div className="receivable-heading"><div><span className="receivable-editor-eyebrow">CADASTRO DE RECEITA</span><h2>{editingId === null ? "Nova receita" : "Editar receita"}</h2><p>Formulário exclusivo de contas a receber.</p></div></div>
          <form className="receivable-editor-form" onSubmit={saveRevenue}>
            <label>Descrição<input required value={draft.description} onChange={(e) => setDraft({...draft, description:e.target.value})} /></label>
            <label>Valor total<input required inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({...draft, amount:e.target.value})} /></label>
            <label>Valor já recebido<input inputMode="decimal" value={draft.settledAmount} onChange={(e) => setDraft({...draft, settledAmount:e.target.value})} /></label>
            <label>Data prevista<input type="date" value={draft.date} onChange={(e) => setDraft({...draft, date:e.target.value})} /></label>
            <label>Categoria<select required value={draft.category} onChange={(e) => { const category = e.target.value; setDraft({...draft, category, subcategory: subcategories[category]?.[0] || "Outros"}); }}>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label>Subcategoria<select required value={draft.subcategory} onChange={(e) => setDraft({...draft, subcategory:e.target.value})}>{subcategoryOptions.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}</select></label>
            <label>Conta de recebimento<select required value={draft.account} onChange={(e) => setDraft({...draft, account:e.target.value})}><option value="">Selecione uma conta cadastrada</option>{accountOptions.map((account) => <option key={account} value={account}>{account}{registeredAccounts.find((item) => item.name === account)?.isPrimary ? " · Principal" : ""}</option>)}</select>{registeredAccounts.length === 0 && <small>Você ainda não possui contas ativas. <a href="/financeiro/contas">Cadastrar conta</a>.</small>}</label>
            <label>Forma de recebimento<select value={draft.paymentMethod} onChange={(e) => setDraft({...draft, paymentMethod:e.target.value})}><option>PIX</option><option>Dinheiro</option><option>Débito</option><option>Crédito</option><option>Boleto</option><option>Transferência</option><option>Outro</option></select></label>
            <label>Status<select value={draft.status} onChange={(e) => setDraft({...draft, status:e.target.value})}><option value="Pendente">Pendente</option><option value="Recebida parcialmente">Recebida parcialmente</option><option value="Recebida">Recebida</option><option value="Cancelada">Cancelada</option></select></label>
            <label>Recorrência<select value={draft.recurrence} onChange={(e) => setDraft({...draft, recurrence:e.target.value})}><option>Nenhuma</option><option>Semanal</option><option>Quinzenal</option><option>Mensal</option><option>Bimestral</option><option>Trimestral</option><option>Semestral</option><option>Anual</option></select></label>
            <div className="receivable-editor-actions"><button type="button" onClick={() => {setEditorOpen(false);setEditingId(null);}}>Cancelar</button><button type="submit">{editingId === null ? "Cadastrar receita" : "Salvar alterações"}</button></div>
          </form>
        </section>
      )}
      <section className="receivable-content">
        <div className="receivable-heading">
          <div>
            <h2>Histórico de recebimentos</h2>
            <p>
              Consulte e acompanhe todas as receitas cadastradas.
            </p>
          </div>

          <button type="button" className="receivable-new-button" onClick={() => openRevenueEditor()}>
            + Nova receita
          </button>
        </div>

        <div className="receivable-filters">
          <div className="receivable-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Buscar por descrição ou categoria..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar receitas"
            />
          </div>

          <select
            aria-label="Filtrar receitas por situação"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as FilterType)
            }
          >
            <option value="Todas">Todas as receitas</option>
            <option value="Em aberto">Em aberto</option>
            <option value="Recebidas">Recebidas</option>
            <option value="Atrasadas">Atrasadas</option>
            <option value="Canceladas">Canceladas</option>
          </select>
        </div>

        <div className="receivable-table-wrapper">
          <table className="receivable-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Data prevista</th>
                <th>Conta</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="receivable-empty">
                    Carregando receitas...
                  </td>
                </tr>
              ) : filteredRevenues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="receivable-empty">
                    <div className="receivable-empty-icon">▤</div>

                    <strong>Nenhuma receita encontrada</strong>

                    <span>
                      Use o botão “Nova receita” para cadastrar diretamente nesta aba.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredRevenues.map((item) => {
                  const status = getStatus(item);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="receivable-description">
                          <strong>{item.description}</strong>
                          <small>
                            {item.subcategory || "Sem subcategoria"}
                          </small>
                        </div>
                      </td>

                      <td>{item.category || "Não informada"}</td>

                      <td>
                        <span
                          className={
                            isOverdue(item)
                              ? "receivable-date date-overdue"
                              : "receivable-date"
                          }
                        >
                          {formatDate(item.date)}
                        </span>
                      </td>

                      <td>{item.account || "Não informada"}</td>

                      <td className="receivable-amount">
                        <span>{formatCurrency(Number(item.amount || 0))}</span>
                        {isPartiallyReceived(item) && <small style={{ display: "block", color: "#a8c7b3", marginTop: 4 }}>Recebido: {formatCurrency(getSettledAmount(item))} · Pendente: {formatCurrency(getOpenAmount(item))}</small>}
                      </td>

                      <td>
                        <span
                          className={`receivable-status ${
                            status === "Recebida"
                              ? "status-received"
                              : status === "Atrasada"
                                ? "status-overdue"
                                : status === "Cancelada"
                                  ? "status-cancelled"
                                  : "status-pending"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td>
                        <div className="receivable-row-actions"><button type="button" className="receivable-edit-button" onClick={() => openRevenueEditor(item)}>Editar</button>
                        {getOpenAmount(item) > 0 &&
                        !isCancelled(item.status) ? (
                          <>
                          <button
                            type="button"
                            className="receive-button"
                            onClick={() => registerPartialReceipt(item)}
                          >
                            Registrar recebimento parcial
                          </button>
<button
                            type="button"
                            className="receive-button"
                            onClick={() => markAsReceived(item)}
                          >
                            Marcar recebida
                          </button>
                          </>
                        ) : isReceived(item.status) ? (
                          <button
                            type="button"
                            className="reopen-button"
                            onClick={() => reopenRevenue(item)}
                          >
                            Reabrir
                          </button>
                        ) : (
                          <span className="no-action">—</span>
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="receivable-footer-table">
          <span>
            Exibindo <strong>{filteredRevenues.length}</strong> de{" "}
            <strong>{revenues.length}</strong> receitas
          </span>

          <span>
            Total listado:{" "}
            <strong>
              {formatCurrency(
                filteredRevenues.reduce((total, item) => total + getOpenAmount(item), 0)
              )}
            </strong>
          </span>
        </div>
      </section>

      <footer className="routine-footer">
        NEXO · Planeje. Organize. Conquiste.
      </footer>

      <style jsx global>{`
        .receivable-content-page {
          display: flex;
          flex-direction: column;
          gap: 22px;
          min-width: 0;
        }

        .receivable-intro {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .receivable-intro p {
          margin: 0;
          color: #89898f;
          font-size: 13px;
        }

        .receivable-back,
        .receivable-new-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 15px;
          border: 1px solid #303034;
          border-radius: 9px;
          color: #e5e5e7;
          background: #151517;
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
          transition: 0.2s;
          white-space: nowrap;
        }

        .receivable-back:hover,
        .receivable-new-button:hover {
          border-color: #777d87;
          background: #1b1b1e;
        }

        .receivable-editor-panel { border:1px solid #34343a; border-radius:13px; background:#111113; overflow:hidden; }
        .receivable-editor-eyebrow { color:#9298a2; font-size:9px; font-weight:700; letter-spacing:1.5px; }
        .receivable-editor-form { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; padding:18px 23px 22px; }
        .receivable-editor-form label { display:flex; flex-direction:column; gap:6px; color:#b9bac1; font-size:11px; }
        .receivable-editor-form input,.receivable-editor-form select { width:100%; min-width:0; height:38px; padding:0 10px; border:1px solid #37373d; border-radius:7px; color:#f3f3f5; background:#151517; color-scheme:dark; font:inherit; box-sizing:border-box; }
        .receivable-editor-actions,.receivable-row-actions { display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
        .receivable-editor-actions { grid-column:1/-1; justify-content:flex-end; }
        .receivable-editor-actions button,.receivable-edit-button { min-height:31px; padding:0 11px; border:1px solid #414149; border-radius:6px; color:#e5e5e7; background:#222226; font:inherit; font-size:10px; cursor:pointer; }
        .receivable-editor-actions button[type="submit"] { background:#d7d9de; color:#151517; font-weight:700; }
        @media(max-width:700px){.receivable-editor-form{grid-template-columns:repeat(2,minmax(0,1fr));}}
        @media(max-width:380px){.receivable-editor-form{grid-template-columns:1fr;padding:14px;}}
        .receivable-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
        }

        .receivable-card {
          min-width: 0;
          padding: 20px;
          border: 1px solid #29292d;
          border-radius: 13px;
          background: #151517;
        }

        .receivable-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #99999f;
          font-size: 12px;
        }

        .receivable-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 29px;
          height: 29px;
          border: 1px solid #303034;
          border-radius: 8px;
          color: #c3c7ce;
          background: #1b1b1e;
          font-size: 15px;
        }

        .receivable-card > strong {
          display: block;
          margin-top: 17px;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 23px;
          font-weight: 700;
          letter-spacing: -0.7px;
          overflow-wrap: anywhere;
        }

        .receivable-card > small {
          display: block;
          margin-top: 7px;
          color: #77777e;
          font-size: 11px;
        }

        .overdue-card {
          border-color: #493033;
        }

        .overdue-card .receivable-icon {
          border-color: #493033;
          color: #d18c8c;
        }

        .overdue-card > strong {
          color: #d18c8c;
        }

        .receivable-content {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #29292d;
          border-radius: 13px;
          background: #111113;
        }

        .receivable-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 22px 23px;
          border-bottom: 1px solid #29292d;
        }

        .receivable-heading h2 {
          margin: 0;
          color: #f5f5f6;
          font-family: "Manrope", sans-serif;
          font-size: 16px;
          font-weight: 700;
        }

        .receivable-heading p {
          margin: 6px 0 0;
          color: #85858b;
          font-size: 12px;
        }

        .receivable-filters {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 17px 23px;
          border-bottom: 1px solid #29292d;
        }

        .receivable-search {
          display: flex;
          align-items: center;
          flex: 1;
          gap: 10px;
          min-width: 180px;
          height: 40px;
          padding: 0 12px;
          border: 1px solid #303034;
          border-radius: 8px;
          background: #151517;
        }

        .receivable-search > span {
          color: #85858b;
          font-size: 21px;
        }

        .receivable-search input {
          width: 100%;
          border: 0;
          outline: none;
          color: #f5f5f6;
          background: transparent;
          font: inherit;
          font-size: 12px;
        }

        .receivable-search input::placeholder {
          color: #707077;
        }

        .receivable-filters select {
          height: 40px;
          min-width: 155px;
          padding: 0 12px;
          border: 1px solid #303034;
          border-radius: 8px;
          outline: none;
          color: #e5e5e7;
          background: #151517;
          font: inherit;
          font-size: 12px;
        }

        .receivable-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .receivable-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          white-space: nowrap;
        }

        .receivable-table th {
          padding: 14px 16px;
          border-bottom: 1px solid #29292d;
          color: #85858b;
          background: #151517;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .receivable-table th:first-child,
        .receivable-table td:first-child {
          padding-left: 23px;
        }

        .receivable-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #242427;
          color: #c6c6ca;
          font-size: 12px;
        }

        .receivable-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .receivable-table tbody tr:hover {
          background: #171719;
        }

        .receivable-description {
          display: flex;
          flex-direction: column;
          gap: 5px;
          max-width: 220px;
          white-space: normal;
        }

        .receivable-description strong {
          color: #ededee;
          font-size: 12px;
          font-weight: 600;
        }

        .receivable-description small {
          color: #77777e;
          font-size: 10px;
        }

        .receivable-date {
          color: #c6c6ca;
        }

        .date-overdue {
          color: #d18c8c;
        }

        .receivable-amount {
          color: #f0f0f1 !important;
          font-weight: 700;
        }

        .receivable-status {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border: 1px solid #343438;
          border-radius: 20px;
          color: #c3c7ce;
          background: #1b1b1e;
          font-size: 10px;
          font-weight: 600;
        }

        .status-received {
          border-color: #35443b;
          color: #a8c7b3;
          background: #18201b;
        }

        .status-overdue {
          border-color: #543437;
          color: #d18c8c;
          background: #241719;
        }

        .status-cancelled {
          border-color: #39393d;
          color: #85858b;
          background: #1b1b1e;
        }

        .status-pending {
          border-color: #49433a;
          color: #c5b99e;
          background: #211e19;
        }

        .receive-button,
        .reopen-button {
          padding: 7px 10px;
          border: 1px solid #414148;
          border-radius: 7px;
          color: #e5e5e7;
          background: #202023;
          font: inherit;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }

        .receive-button:hover {
          border-color: #78917e;
          color: #b8d4c0;
          background: #1b2520;
        }

        .reopen-button:hover {
          border-color: #777d87;
          background: #29292d;
        }

        .no-action {
          color: #66666c;
        }

        .receivable-empty {
          height: 190px;
          text-align: center !important;
          white-space: normal;
        }

        .receivable-empty strong,
        .receivable-empty span {
          display: block;
        }

        .receivable-empty strong {
          margin: 8px 0 5px;
          color: #dedee0;
          font-size: 13px;
        }

        .receivable-empty span {
          color: #85858b;
          font-size: 11px;
        }

        .receivable-empty-icon {
          color: #777d87;
          font-size: 25px;
        }

        .receivable-footer-table {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 23px;
          border-top: 1px solid #29292d;
          color: #85858b;
          font-size: 11px;
        }

        .receivable-footer-table strong {
          color: #dedee0;
        }

        @media (max-width: 1050px) {
          .receivable-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .receivable-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          .receivable-heading {
            align-items: flex-start;
            flex-direction: column;
            padding: 18px;
          }

          .receivable-filters {
            align-items: stretch;
            flex-direction: column;
            padding: 15px;
          }

          .receivable-filters select {
            width: 100%;
          }

          .receivable-footer-table {
            align-items: flex-start;
            flex-direction: column;
            padding: 15px;
          }
        }

        @media (max-width: 380px) {
          .receivable-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
