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


## Implementação da interface (PR em validação)

A primeira camada de interface foi adicionada à branch de integração:
- `/entrar`: login por e-mail e senha.
- `/cadastro`: criação de conta.
- `/recuperar-senha`: solicitação de link de recuperação.
- `/redefinir-senha`: atualização de senha a partir do link enviado por e-mail.
- `/configuracoes/conta`: estado da conta e saída.
- Indicador de conta e painel de sincronização nas telas do sistema.

As sessões são gerenciadas por rotas do servidor (`/api/auth`) e armazenadas em cookies `HttpOnly`, `Secure` em produção e `SameSite=Lax`. Os tokens não são gravados no `localStorage` nem expostos aos componentes do navegador. As rotas de sincronização (`/api/sync`) usam o token da sessão e continuam sujeitas às políticas RLS; não utilizam service role.

## Migração e conflitos

No primeiro acesso autenticado:
- Se só houver dados locais, a interface solicita backup e confirmação antes do envio.
- Se só houver dados remotos, eles são restaurados no armazenamento local.
- Se houver versões diferentes nos dois lados, a aplicação bloqueia a sobrescrita automática e permite escolher a versão local ou a da nuvem.
- Após a inicialização, alterações locais são enviadas com controle de revisão. A aplicação consulta a nuvem periodicamente para identificar atualizações feitas em outros dispositivos.

O backup pré-migração é baixado pelo navegador. A aplicação não remove as chaves locais após o envio. Dados com JSON ou formato de coleção inválido bloqueiam a migração.

## Configuração necessária por ambiente

O arquivo `.env.example` contém a URL e a chave publishable do projeto NEXO-DEV para desenvolvimento. A chave publishable é pública e não substitui uma chave secreta. Em produção, configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente do host; o código não usa o projeto de desenvolvimento como fallback em produção.

No painel Supabase, a URL base do aplicativo e os caminhos de redirecionamento devem incluir os domínios efetivos de Preview e Production:
- `https://SEU-DOMINIO/entrar`
- `https://SEU-DOMINIO/redefinir-senha`

A configuração desses domínios depende do endereço definitivo da implantação e precisa ser conferida antes de liberar o cadastro em produção.

## Limitações até a validação final

A autenticação e as rotas de sincronização estão implementadas na branch, mas ainda dependem de:
1. Execução bem-sucedida de lint, build e testes E2E na CI.
2. Configuração das variáveis de ambiente no host de produção.
3. Inclusão dos domínios reais na allowlist de redirecionamento do Supabase Auth.
4. Teste prático de cadastro/confirmação de e-mail, recuperação de senha e sincronização em dois navegadores.
5. Revisão dos conflitos e da restauração antes de mesclar a PR.

Até concluir esses itens, o sistema mantém o modo local disponível e a PR não deve ser tratada como liberação de produção.


## Isolamento local entre contas

O navegador mantém um identificador de proprietário para as coleções locais. Quando uma conta diferente entra no mesmo navegador, os dados ativos da conta anterior são arquivados sob um identificador separado, as coleções ativas são limpas e, se existir, o arquivo local da nova conta é restaurado. A tela é recarregada para limpar estados React em memória. Se não for possível preservar o arquivo anterior, a troca é bloqueada.

Ao resolver um conflito, a versão que será substituída também é preservada em uma chave de backup local por conta e coleção. Esses arquivos podem ser incluídos na exportação de backup da conta correspondente; os arquivos arquivados de outras contas são excluídos da exportação comum.
