# NEXO — Resultado do backfill legado (DEV)

**Data:** 26/11/2026  
**Projeto:** NEXO-DEV `mmwkpwspyjvxsennvhic`  
**Snapshot validado:** `nexo_private_backup.nexo_user_data_snapshot_20261126_181600`

## Resultado

| Destino | Linhas verificadas |
|---|---:|
| `nexo_profiles` | 1 |
| `nexo_accounts` | 3 |
| `nexo_categories` | 7 |
| `nexo_transactions_relational` | 57 |
| `nexo_goals_relational` | 0 |
| `nexo_routine_items` — tarefas | 4 |
| `nexo_routine_items` — hábitos | 4 |
| `nexo_reserves_relational` | 1 |
| `nexo_reserve_movements_relational` | 0 |
| `nexo_preferences` | 1 |

## Integridade e compatibilidade

- 8/8 registros JSONB continuam presentes na origem.
- 8/8 registros da origem correspondem exatamente ao snapshot.
- Payload legado completo conferido: contas 3/3, transações 57/57, tarefas 4/4, hábitos 4/4, reservas 1/1, perfil 1/1 e preferências 1/1.
- 57/57 transações possuem vínculo com conta e categoria.
- 1/1 reserva possui vínculo com conta.
- Os valores monetários foram convertidos para centavos inteiros.
- O campo `legacy_payload` preserva cada objeto original sem perda de campos não normalizados.

## Idempotência

O mesmo conjunto de upserts foi executado novamente após a migração. A segunda execução terminou sem erro e as contagens permaneceram idênticas; as chaves únicas por proprietário e ID legado impediram duplicações.

## Segurança e armazenamento

- RLS habilitado nas 9 tabelas relacionais, com 36 políticas de proprietário.
- O backfill foi executado apenas no NEXO-DEV.
- Nenhuma linha foi removida de `nexo_user_data`.
- O snapshot permanece no schema privado `nexo_private_backup`.
- O repositório da aplicação ainda não foi trocado para leitura/escrita relacional; isso depende da etapa de feature flag e fallback.
