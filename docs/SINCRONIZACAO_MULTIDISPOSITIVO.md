# NEXO — autenticação, armazenamento e sincronização

## Arquitetura atual

O NEXO usa Supabase Auth para autenticação e PostgreSQL para sincronizar coleções entre dispositivos. As chamadas passam pelas rotas servidoras Next.js `/api/auth` e `/api/sync`. Os tokens ficam em cookies `HttpOnly`; o navegador recebe apenas os dados públicos da sessão.

A API usa a chave publishable e o JWT da sessão. Não utiliza `service_role`. A tabela `public.nexo_user_data` deve manter RLS habilitado e políticas que comparem `user_id` com `auth.uid()`. A função `save_nexo_user_data` usa `SECURITY INVOKER`, `search_path` vazio e revisão otimista.

## Coleções sincronizadas

A lista de chaves permitidas pela aplicação está centralizada em `lib/supabase/sync-keys.ts`:
- `nexo_transactions`
- `nexo_accounts`
- `nexo_reserves`
- `nexo_reserve_movements`
- `nexo_tasks`
- `nexo_habits`
- `nexo_preferences`
- `nexo_profile`
- `nexo_planning_budgets`
- `nexo_planning_goals`
- `nexo_personal_goals`
- `nexo_task_backups`

A restrição SQL correspondente é mantida nas migrations do Supabase. Ao adicionar uma coleção, atualize a lista compartilhada e crie uma migration compatível com a restrição do banco.

## Leitura e gravação

- `GET /api/sync` lê todas as coleções permitidas, respeitando o RLS.
- `GET /api/sync?keys=nexo_profile,nexo_preferences` lê somente as coleções solicitadas.
- `POST /api/sync` valida a origem, a chave, a revisão, o formato esperado e limita o corpo a 1 MB.
- A leitura não envia `user_id` como filtro: o isolamento é responsabilidade das políticas RLS aplicadas ao JWT autenticado.

Os hooks financeiros validam os campos essenciais dos registros antes de usá-los. Valores `settledAmount: null` são normalizados como ausentes para preservar a compatibilidade com dados JSON antigos.

## Proteção dos dados locais

**O NEXO não deve apagar automaticamente chaves `nexo_*` do navegador.** O componente antigo `LegacyLocalDataCleanup` foi removido porque uma resposta bem-sucedida da API, mesmo vazia, não comprova que os dados locais foram migrados ou existem na nuvem.

Antes de qualquer migração ou limpeza de dados locais:
1. gerar um backup exportável;
2. validar o conteúdo do backup;
3. comparar cada coleção local com a coleção remota correspondente;
4. pedir confirmação explícita;
5. preservar o backup até confirmar a restauração em outro dispositivo.

Falha de rede, resposta vazia ou coleção inválida nunca autorizam apagar dados locais.

## Conflitos entre dispositivos

A função SQL usa compare-and-swap:
- revisão esperada `0`: cria uma coleção inexistente;
- revisão igual à atual: grava e incrementa a revisão;
- revisão diferente: não grava e informa o conflito.

Os hooks não devem substituir silenciosamente a edição que acabou de ser feita. Na ocorrência de conflito, a edição permanece na tela e a interface informa que ela ainda não foi enviada. O usuário deve preservar ou comparar a edição antes de recarregar a coleção. Uma resolução automática por mesclagem ainda não está implementada.

## Migrations

- `supabase/migrations/20261117173354_nexo_user_data.sql`: cria a tabela, RLS, políticas e função de gravação.
- `supabase/migrations/20261117173356_restrict_rls_event_trigger.sql`: restringe a execução direta da função opcional de event trigger; agora verifica se ela existe antes de aplicar o revoke.
- `supabase/migrations/20261119131206_expand_nexo_personal_objectives_sync_keys.sql`: amplia a whitelist de coleções e atualiza a função RPC.

A migration de event trigger não deve pressupor que `public.rls_auto_enable()` exista em todo banco novo.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e informe as credenciais publishable do projeto Supabase que deseja usar. O exemplo contém somente campos vazios para evitar que desenvolvimento e testes apontem automaticamente para um projeto real.

Variáveis aceitas:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- aliases de servidor: `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`

Nunca use `service_role` no navegador, em variáveis `NEXT_PUBLIC_*` ou nos testes E2E.

## Segurança e operação

- As rotas POST verificam o cabeçalho `Origin`.
- A API de sincronização rejeita payloads maiores que 1 MB e formatos incompatíveis.
- As respostas de autenticação não repassam mensagens internas brutas do Supabase.
- O servidor valida comprimento mínimo de senha no cadastro e na redefinição.
- O tempo de expiração informado na sessão de recuperação é validado.
- Cabeçalhos CSP, anti-iframe, MIME sniffing, política de referência e permissões estão configurados no Next.js.

Rate limiting e CAPTCHA precisam ser configurados e verificados no painel Supabase Auth ou por um serviço externo apropriado. Um limitador em memória no Next.js serverless não garante proteção consistente entre instâncias.

## Verificações antes de produção

1. Executar `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build` e `npm run test:e2e`.
2. Verificar as migrations aplicadas no projeto Supabase correto.
3. Confirmar RLS, grants, políticas e função RPC.
4. Testar cadastro, confirmação de e-mail, recuperação de senha e logout.
5. Testar duas sessões/dispositivos e conflito de revisão.
6. Verificar as variáveis de ambiente e os redirecionamentos no Supabase e na Vercel.
7. Confirmar a política de privacidade e o tratamento dos dados conforme a LGPD.

A publicação só deve ser considerada validada depois de CI e testes práticos concluídos.
