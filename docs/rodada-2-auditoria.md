# Rodada 2 — Auditoria estática (Etapa 1)

Base: `2fc7af6580cbf27ae406621dea96ad935c4effa5` (Rodada 1).
Branch: `integracao/rodada-2-financeiro-dailycenter`.
Backup: `backup/pre-rodada-2` criado e apontado para a base.

## Mapa dos consumidores inspecionados

| Arquivo | Responsabilidade observada |
|---|---|
| `app/financeiro/contas-a-pagar/page.tsx` | Transações, contas e persistência via `useCloudFinanceCollections`; categorias e `expandRecurringTransactions`; cálculos locais de valores pagos, abertos, atrasados e cancelados; editor, baixa parcial e total. |
| `components/dashboard/DailyCenter.tsx` | Recebe `transactions`, `income`, `expenses`, `balance` por props; calcula localmente liquidação/status, contas próximas/atrasadas e indicadores diários; importa tipo central `Transaction`. |
| `app/financeiro/useFinanceTransactions.ts` | Importa `Transaction` e `FormMovementType`; criação/edição, settlement editor, remoção e recorrência. |
| `app/hooks/finance/useFinanceDashboard.ts` | Importa `Transaction`, saldo de contas de `accounts.ts` e saldo de reservas; mantém cálculos locais mensais, projeções, liquidação, parsing, cancelamento e formatação. |
| `lib/finance/calculations.ts` | Núcleo: `getFinancialSummary`, `getMonthlySummary`, totais por categoria e saldo inicial de contas; usa helpers de `accounts.ts`. |
| `lib/finance/accounts.ts` | Núcleo: normalização/cancelamento, `getSettledTransactionAmount`, saldo individual e agregado de contas. |

## Duplicações de Contas a pagar

| Página duplica | Equivalente no núcleo |
|---|---|
| Tipo local `Transaction` | `Transaction` em `lib/finance/types.ts`, exportado pelo barrel. |
| Formatação monetária `formatCurrency` | Não confirmado no núcleo; `lib/utils/currency.ts` existe, assinatura será validada antes da integração. |
| Formatação de data `formatDate` | `lib/utils/dates.ts` existe; assinatura/compatibilidade será validada. |
| Data local `getToday` | Utilitário de datas existe; compatibilidade com date-input será validada. |
| Parsing monetário `parseCurrencyInput` | Equivalente no núcleo não identificado. |
| `isPaid` | Normalização e `getSettledTransactionAmount` em `accounts.ts`. |
| `getSettledAmount` | `getSettledTransactionAmount` em `accounts.ts`. |
| `getOpenAmount` | Helper público não identificado; saldo é total menos liquidação. |
| Parcial `isPartiallyPaid`/status | Núcleo reconhece valor parcial, mas não foi identificada operação comum de estado/atualização. |
| Cancelamento `isCancelled` | `isCancelledTransaction` em `accounts.ts`. |
| Atraso `isOverdue` | Helper central não identificado. |
| `getStatus` | Helper central de status de contas a pagar não identificado. |

## Checklist de não regressão

- [ ] KPIs: em aberto, pago, atrasado, cancelado.
- [ ] Busca por descrição, categoria e subcategoria.
- [ ] Filtros Todas, Em aberto, Pagas, Atrasadas e Canceladas.
- [ ] Ordenação por vencimento.
- [ ] Cadastro/edição e validações (descrição, valor, conta ativa e liquidado).
- [ ] Categoria, subcategoria, conta principal sugerida.
- [ ] Forma de pagamento e status.
- [ ] Recorrência: Nenhuma, semanal, quinzenal, mensal, bimestral, trimestral, semestral, anual.
- [ ] Pagamento parcial respeitando saldo aberto.
- [ ] Quitação restante; reabertura.
- [ ] Cancelamento e confirmação.
- [ ] Persistência/sync na coleção existente; baixa não cria novo lançamento.
- [ ] Estados carregando, vazio e erro.
- [ ] Interface responsiva e ações da tabela.

## Limitação de abrangência

Foram lidos os seis arquivos solicitados e seus imports diretos. A busca de código pelo conector não retornou resultados úteis para varredura global de imports; este mapa não afirma ser um inventário global de consumidores. Nenhum comportamento foi alterado nesta etapa.
