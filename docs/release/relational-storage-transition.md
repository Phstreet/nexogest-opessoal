# NEXO — Transição do repositório JSONB para relacional

## Feature flag

A aplicação reconhece a variável **server-only** `NEXO_RELATIONAL_STORAGE_ENABLED`.

- Ausente ou diferente de `true`: mantém o repositório JSONB atual (`save_nexo_user_data` e leitura direta de `nexo_user_data`).
- `true`: GET usa `get_nexo_user_data_compat`; POST usa `save_nexo_user_data_relational`.
- A flag não usa prefixo `NEXT_PUBLIC_` e não é exposta ao navegador.

## Compatibilidade e fallback

- O RPC de leitura monta as coleções a partir de `legacy_payload`, respeitando `legacy_position`.
- Cada coleção só é lida do relacional quando o marcador existe e sua revisão coincide com a revisão JSONB.
- Sem marcador ou com revisão divergente, o RPC retorna o payload JSONB.
- Se o RPC relacional de leitura falhar, `app/api/sync` tenta novamente a leitura JSONB.
- O RPC de escrita chama `save_nexo_user_data` e grava as tabelas relacionais na mesma transação. Uma falha relacional provoca rollback completo, sem gravar apenas metade da operação.

## Reversão

Para reverter imediatamente, definir/remover `NEXO_RELATIONAL_STORAGE_ENABLED` no ambiente de preview para um valor diferente de `true` e redeployar. A aplicação volta a ler e gravar JSONB; o JSONB continua sincronizado enquanto a flag está ativa.

## Estado atual

- Código e RPCs publicados na branch de hardening.
- Flag permanece **desativada** em DEV/preview; o fluxo em uso continua JSONB até a homologação de autenticação/RLS.
- Leitura relacional comparada com as oito coleções legadas: 8/8 payloads reconstruídos exatamente, inclusive ordem dos arrays.
- Escrita relacional protegida por RLS e controle de revisão otimista.
- Nenhum dado JSONB foi removido.
