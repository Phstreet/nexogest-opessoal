# NEXO — preparação para sincronização multi-dispositivo

## Objetivo

Permitir que a mesma conta NEXO acesse seus dados em diferentes dispositivos, mantendo autenticação, isolamento por usuário e proteção contra gravações concorrentes.

A implementação será incremental. O armazenamento local atual continua sendo a fonte ativa até que a autenticação, a sincronização e a migração sejam testadas. Não apagar chaves `nexo_*` nem executar uma migração automática sem backup e confirmação.

## Serviço escolhido

Supabase:
- Supabase Auth para identidade e sessões.
- PostgreSQL para armazenamento persistente.
- Row Level Security (RLS) para garantir que cada usuário leia e altere somente seus próprios registros.
- Controle de revisão para detectar quando outro dispositivo alterou o mesmo conjunto de dados.

A aplicação Next.js 16 deverá usar `@supabase/ssr` com sessões em cookies, clientes separados para navegador e servidor e `proxy.ts` para renovação da sessão. A chave secreta/service role nunca poderá ser incluída no navegador ou em variáveis `NEXT_PUBLIC_*`.

## Dados contemplados na primeira versão

| Chave local existente | Conteúdo |
| --- | --- |
| `nexo_transactions` | Movimentações financeiras e registros de investimento |
| `nexo_accounts` | Contas financeiras |
| `nexo_reserves` | Reservas e objetivos |
| `nexo_reserve_movements` | Aportes, resgates e rendimentos |
| `nexo_tasks` | Tarefas e agenda |
| `nexo_habits` | Hábitos e conclusões |
| `nexo_preferences` | Preferências do usuário |
| `nexo_profile` | Perfil de exibição |

Backups locais, dados temporários e chaves internas não serão sincronizados como se fossem dados de negócio.

## Modelo de armazenamento

A migration `supabase/migrations/202611170001_nexo_user_data.sql` cria uma tabela por usuário e chave de coleção. O campo `payload` mantém o formato JSON atual para reduzir o risco de migração. Cada registro tem uma revisão crescente.

A função `save_nexo_user_data` implementa compare-and-swap:
- revisão esperada `0`: cria uma coleção que ainda não existe;
- revisão esperada igual à revisão atual: atualiza e incrementa a revisão;
- revisão diferente: não grava e informa a revisão atual para que a aplicação trate o conflito.

As políticas RLS e a função usam a identidade autenticada. O acesso anônimo é revogado.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` no ambiente de desenvolvimento e preencha os valores no painel do Supabase. Configure as mesmas variáveis no ambiente Preview e Production da Vercel.

Nunca coloque senha de banco, service role key ou secret key em variáveis públicas. Não envie segredos pelo chat nem os comite no Git.

## Plano de implementação

1. Criar o projeto Supabase e aplicar a migration em ambiente de teste.
2. Integrar autenticação por e-mail e sessão SSR, mantendo o acesso local até o usuário entrar.
3. Criar o adaptador remoto com leitura, gravação por revisão e tratamento de conflitos.
4. Fazer migração local → nuvem com prévia, backup exportável, validação e confirmação explícita.
5. Migrar primeiro tarefas e hábitos; depois preferências/perfil; por fim os dados financeiros.
6. Testar dois navegadores/dispositivos, sessões expiradas, falha de rede, conflitos, logout e recuperação.
7. Só habilitar sincronização como padrão depois dos testes e da aprovação da PR.

## Critérios mínimos de aceite

- Usuário A não consegue ler, alterar ou excluir dados do usuário B.
- Nenhuma chave service role/secret aparece no bundle do navegador.
- Uma falha de rede não apaga nem substitui os dados locais.
- Um conflito entre dispositivos é detectado; nunca é sobrescrito silenciosamente.
- A migração é idempotente ou bloqueia uma segunda execução, e oferece backup antes de gravar.
- O modo local atual continua funcional enquanto a nuvem não estiver configurada.
