# NEXO — produção, segurança e recuperação

## Variáveis de ambiente

Configure no ambiente local por meio de `.env.local` e na Vercel em **Project → Settings → Environment Variables**:

| Variável | Escopo | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL do projeto Supabase usado pelo navegador e pelas rotas servidoras |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública | Chave publishable do Supabase; não concede acesso administrativo por si só |
| `SUPABASE_URL` | Somente servidor, opcional | Alias de `NEXT_PUBLIC_SUPABASE_URL` para ambientes que preferem separar configuração server-side |
| `SUPABASE_PUBLISHABLE_KEY` | Somente servidor, opcional | Alias server-side da chave publishable |
| `NEXT_PUBLIC_APP_URL` | Pública | URL canônica usada nos metadados absolutos |

Nunca configure `service_role`, secret key ou credenciais administrativas em variáveis `NEXT_PUBLIC_*`. O arquivo `.env` e suas variantes locais estão ignorados pelo Git; mantenha somente valores vazios/de exemplo em `.env.example`.

## Vercel

1. Abra o projeto NEXO na Vercel e confirme que o repositório conectado é `Phstreet/nexogest-opessoal`.
2. Em **Settings → Git**, confirme `main` como Production Branch.
3. Cadastre as variáveis da tabela acima nos ambientes Production e Preview, usando o projeto Supabase correspondente a cada ambiente. Não aponte Preview para dados pessoais de produção sem necessidade.
4. Em **Settings → Domains**, confirme o domínio de produção e o HTTPS automático.
5. Faça deploy de branches de trabalho em Preview; somente alterações aprovadas e integradas à `main` devem alimentar Production.
6. Após o deploy, abra cada rota principal, valide login, gravação, leitura, backup e responsividade. Confirme os headers com DevTools → Network ou `curl -I https://SEU-DOMINIO`.

## Segurança do Supabase

- Mantenha RLS habilitado em `public.nexo_user_data`.
- As políticas devem restringir cada linha a `auth.uid() = user_id`.
- A função `save_nexo_user_data` deve permanecer `SECURITY INVOKER`, com `search_path` vazio e execução concedida somente a `authenticated`.
- Habilite **Leaked Password Protection** no painel Supabase Auth → Security/Password Security. A auditoria de 24/11/2026 encontrou essa proteção desativada.
- Configure limites de tentativa e CAPTCHA no Supabase Auth se o cadastro/login ficar exposto publicamente. Não use rate limit em memória de função serverless como controle único.

## Backup e restauração

1. Em NEXO → Configurações → Dados e backups, use **Exportar backup completo**.
2. Guarde o JSON fora do dispositivo, em local criptografado e com acesso restrito. O arquivo contém dados pessoais e financeiros.
3. Antes de importar, valide o arquivo e confirme que a versão e as coleções pertencem ao NEXO.
4. A importação substitui as coleções correspondentes. Faça uma exportação imediatamente antes de restaurar.
5. Após importar, recarregue o NEXO e confira contas, lançamentos, reservas, tarefas, hábitos e metas.
6. Faça um teste de restauração periódico em um projeto Supabase separado, nunca sobre a produção como primeiro teste.

O backup da interface é um arquivo JSON exportado pelo usuário; não substitui os backups gerenciados pelo provedor nem garante restauração transacional de todas as coleções se a rede cair no meio de uma importação.

## Rollback

1. Identifique a última implantação Vercel saudável.
2. Use **Deployments → Promote to Production** para promover a implantação anterior, ou reverta o commit no GitHub e aguarde o novo deploy.
3. Não reverta migrations que tenham dados gravados sem avaliar compatibilidade. Prefira migrations aditivas e compatíveis para frente.
4. Depois do rollback, valide autenticação, leitura/gravação e os dados financeiros antes de liberar o uso.

## Monitoramento

O projeto já inclui Vercel Analytics no layout raiz. Ainda não há SDK de monitoramento de exceções como Sentry configurado. Para ativá-lo, crie um projeto Sentry, configure o DSN nos ambientes Vercel sem expor chaves administrativas, instale o SDK oficial compatível com a versão atual do Next.js, adicione os arquivos de configuração de client/server/edge e valide um evento de teste antes de habilitar em produção. Não registrar payloads financeiros, tokens, e-mails ou conteúdo de backup nos eventos.

## Estado da auditoria de produção — 24/11/2026

- GitHub Actions: último fluxo consultado executou lint, typecheck, build, npm audit e Playwright com sucesso.
- A Vercel reportou falha de deployment `build-rate-limit` para o commit de produção consultado. O limite é externo ao código; confirmar a franquia/limite no painel Vercel antes de considerar a versão publicada.
- A proteção de senhas vazadas no Supabase estava desativada na última leitura de advisors e precisa ser habilitada no painel.
