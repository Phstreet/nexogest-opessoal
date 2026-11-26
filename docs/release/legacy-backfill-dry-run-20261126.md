# NEXO — Dry-run do backfill JSONB → relacional

**Ambiente:** NEXO-DEV  
**Data:** 26/11/2026  
**Snapshot:** `nexo_private_backup.nexo_user_data_snapshot_20261126_181600`

## Integridade antes da migração

- Registros legados: 8
- Registros no snapshot: 8
- Correspondências exatas por `user_id, data_key, payload, revision, updated_at`: 8
- Proprietários: 1
- Linhas legadas alteradas pelo dry-run: 0

## Contagem e validação das coleções

| Coleção JSONB | Itens | Validação |
|---|---:|---|
| `nexo_accounts` | 3 | 3 IDs, nomes e saldos válidos |
| `nexo_transactions` | 57 | 57 valores positivos, datas ISO, tipos/status reconhecidos e contas correspondentes |
| Categorias derivadas das transações | 7 | 57/57 transações com categoria/conta mapeável |
| `nexo_tasks` | 4 | 4 IDs, descrições, datas e horários válidos |
| `nexo_habits` | 4 | 4 IDs, nomes e arrays de conclusão válidos |
| `nexo_reserves` | 1 | ID, nome, saldos e datas válidos |
| `nexo_reserve_movements` | 0 | Nenhum item para migrar |
| `nexo_profile` | 1 | Data de nascimento válida; renda legada é string em formato monetário BR |
| `nexo_preferences` | 1 | Objeto com as três chaves esperadas |

Um tipo de conta será normalizado para `other`; o objeto original completo será preservado em `legacy_payload`. Os campos de recorrência e valores liquidados também serão preservados sem perda no payload legado.

## Destino previsto

| Tabela relacional | Linhas previstas |
|---|---:|
| `nexo_profiles` | 1 |
| `nexo_accounts` | 3 |
| `nexo_categories` | 7 |
| `nexo_transactions_relational` | 57 |
| `nexo_goals_relational` | 0 |
| `nexo_routine_items` | 8 |
| `nexo_reserves_relational` | 1 |
| `nexo_reserve_movements_relational` | 0 |
| `nexo_preferences` | 1 |

## Regras de segurança e idempotência

- Backfill ainda não executado neste dry-run.
- A migração de extensão verifica o snapshot antes de alterar o schema e aborta se a origem mudar.
- IDs legados e chaves de origem terão índices únicos por proprietário.
- O script de backfill usará `ON CONFLICT` para reexecução sem duplicação.
- Cada linha migrada manterá o JSONB original em `legacy_payload`.
- RLS de proprietário será aplicado também às novas tabelas.
- Nenhum dado JSONB legado será removido nesta etapa.
