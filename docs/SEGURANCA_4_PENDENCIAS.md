# NEXO — Segurança: senhas, Sentry, CSP e GitHub

Este documento registra a implementação no código e os passos que exigem acesso aos painéis externos.

## 1. Autenticação e senhas vazadas

### Autenticação identificada

O NEXO usa **Supabase Auth**. O frontend chama `/api/auth`; a rota de servidor conversa com `/auth/v1/signup`, `/auth/v1/token`, `/auth/v1/recover` e `/auth/v1/user`. Os tokens de sessão ficam em cookies `HttpOnly`.

A política local está em `lib/auth/password-policy.ts` e é aplicada em `app/api/auth/route.ts` para:
- Cadastro (`signup`)
- Alteração autenticada (`change-password`)
- Redefinição após recuperação (usa a mesma ação autenticada `change-password`)

A consulta Pwned Passwords calcula SHA-1 no servidor e envia somente os cinco primeiros caracteres do hash ao endpoint `https://api.pwnedpasswords.com/range/{prefix}`. A senha e o hash completo nunca são enviados. Em erro de rede/timeout/HTTP, a política é **fail-open**, com log técnico sem senha, hash ou dados do usuário. A validação local Zod continua obrigatória.

Regras locais: 10–128 caracteres, maiúscula, minúscula, número, símbolo, bloqueio de senhas óbvias e de cinco caracteres repetidos em sequência.

### Configuração nativa do Supabase

1. Abra o projeto NEXO no Supabase Dashboard.
2. Acesse **Authentication → Sign In / Providers → Email** (a área de Password Security pode aparecer em Authentication → Settings, conforme a versão do Studio).
3. Em segurança de senha, defina mínimo de **10 caracteres**.
4. Ative a exigência de letras minúsculas, maiúsculas, números e símbolos.
5. Ative **Leaked password protection**.
6. Salve e teste um cadastro com uma senha sabidamente vazada em ambiente de teste.

**Plano:** Leaked Password Protection nativo está disponível no **Supabase Pro ou superior**. O projeto NEXO-DEV estava em Free na auditoria anterior; portanto, a opção nativa pode exigir upgrade. A proteção própria por Pwned Passwords já é independente do plano.

Referência: https://supabase.com/docs/guides/auth/password-security

## 2. Sentry

### Arquivos

- `sentry.client.config.ts` — inicialização no navegador.
- `sentry.server.config.ts` — runtime Node.
- `sentry.edge.config.ts` — runtime Edge.
- `instrumentation-client.ts` — carrega a configuração client.
- `instrumentation.ts` — carrega server/edge e registra `onRequestError`.
- `lib/observability/sentry-privacy.ts` — redação conservadora dos eventos.
- `app/global-error.tsx` e `app/error.tsx` — captura de exceções.
- `next.config.js` — integração de upload de source maps.

Não há Session Replay habilitado. `sendDefaultPii` está desativado. Identidade do usuário, body, headers, query string, extras, contexts, breadcrumbs com dados livres e mensagens/valores de exceções são removidos ou substituídos antes do envio. Somente tags allowlist são mantidas.

### Criar o projeto e obter as variáveis

1. Crie uma organização/projeto Next.js em https://sentry.io/.
2. Em **Project → Settings → Client Keys (DSN)**, copie o DSN para `NEXT_PUBLIC_SENTRY_DSN`.
3. Em **User Settings → Auth Tokens**, crie um token de build com permissões mínimas para leitura da organização e criação/upload de releases/source maps (`org:read`, `project:releases`).
4. Copie o slug da organização para `SENTRY_ORG`.
5. Copie o slug do projeto para `SENTRY_PROJECT`.
6. Guarde o token em `SENTRY_AUTH_TOKEN`. Nunca use prefixo `NEXT_PUBLIC_` para esse token.

### Vercel

1. Abra **Vercel → projeto NEXO → Settings → Environment Variables**.
2. Cadastre `NEXT_PUBLIC_SENTRY_DSN` em Development, Preview e Production.
3. Cadastre `SENTRY_ORG`, `SENTRY_PROJECT` e `SENTRY_AUTH_TOKEN` para Preview e Production (e Development apenas se for fazer build local com upload).
4. Crie `SENTRY_TEST_TOKEN` como segredo aleatório forte, somente durante o teste.
5. Faça redeploy para as variáveis serem aplicadas.

### Teste temporário

A rota `POST /api/sentry-test` exige `Authorization: Bearer <SENTRY_TEST_TOKEN>`. Execute:

```bash
curl -X POST https://SEU_DOMINIO/api/sentry-test \
  -H "Authorization: Bearer $SENTRY_TEST_TOKEN"
```

Confirme um evento de exceção com as tags `test_event=true` e `source=temporary-test-route` no Sentry (a mensagem é removida pela política de privacidade). Depois do teste, **remova** `app/api/sentry-test/route.ts` e a variável `SENTRY_TEST_TOKEN` da Vercel e faça novo deploy.

### Alertas recomendados

- **Novo erro:** Alerts → Create Alert → Issues → alerta para novo issue; notificar o responsável por e-mail.
- **Pico de erros:** alerta de métrica/issue count com janela de 5–15 minutos e limite acima do padrão do NEXO.
- **E-mail/push:** configure as notificações do membro em Sentry → User Settings → Notifications. Para push, use o aplicativo móvel do Sentry se disponível para a conta; alternativamente, conecte Slack/integração de incidentes e habilite notificações no dispositivo.

## 3. CSP com nonce

### Estado inicial

O Next.js do NEXO é 16.x e usa a convenção **`proxy.ts`** (não `middleware.ts`). A política é criada por requisição em `proxy.ts`, com nonce aleatório, `strict-dynamic`, `style-src` sem `unsafe-inline`, `style-src-attr 'none'`, `report-uri` e `report-to`.

O layout lê `x-nonce` com `headers()`, o que força renderização dinâmica. O Next.js lê o cabeçalho CSP encaminhado no request e aplica o nonce aos scripts e estilos inline gerados pelo framework. Blocos `styled-jsx` permanecem somente onde o Next.js injeta nonce. Estilos React via atributo `style={{...}}` foram substituídos por classes CSS pré-geradas nos componentes identificados; os estilos dos boundaries foram movidos para CSS Modules.

A política está inicialmente em **Content-Security-Policy-Report-Only**. Os relatórios são recebidos por `POST /api/csp-report`; somente diretiva/URI/documento sanitizados são registrados.

### Ativação do bloqueio

1. Faça deploy com Report-Only.
2. Abra as rotas e fluxos financeiros/rotina em desktop e mobile.
3. Execute `npm run test:e2e`; o teste `tests/csp.spec.ts` falha quando recebe `securitypolicyviolation`.
4. Inspecione os relatórios de `[NEXO][CSP-REPORT]` nos logs da Vercel.
5. Corrija toda violação legítima e repita a suíte.
6. Quando não houver violações legítimas por pelo menos um ciclo de uso, em `proxy.ts`, troque o cabeçalho de resposta `Content-Security-Policy-Report-Only` por `Content-Security-Policy`. Não mantenha as duas políticas se o objetivo for apenas o modo bloqueio.
7. Faça novo deploy e repita a suíte e os testes manuais.

**Impacto:** ler `headers()` torna o layout dinâmico. As páginas com nonce deixam de aproveitar a pré-renderização estática/ISR e passam a ser renderizadas por requisição, com maior custo de servidor e possível aumento de TTFB. O nonce não pode ser reutilizado em HTML cacheado. A política CSP em Report-Only não bloqueia recursos durante a observação.


### Inventário de estilos inline e injeção CSS

A varredura dos componentes TSX encontrou atributos React `style={{...}}` em relatórios, planejamento financeiro, rotina, produtividade, metas, gráficos do dashboard, métricas de tarefas e boundaries de erro. Eles foram substituídos por classes em `app/progress-utilities.css` e `lib/ui/progress-class.ts`; os boundaries usam `app/global-error.module.css`.

Os blocos `<style jsx>` restantes pertencem ao **styled-jsx integrado ao Next.js**, não a uma biblioteca externa adicional. Eles estão em:
- `app/page.tsx`
- `app/financeiro/dashboard/page.tsx`
- `app/financeiro/contas/page.tsx`
- `app/financeiro/historico/page.tsx`
- `app/financeiro/investimentos/page.tsx`
- `app/financeiro/reservas/page.tsx`
- `app/financeiro/contas-a-pagar/page.tsx`
- `app/financeiro/contas-a-receber/page.tsx`
- `app/perfil/page.tsx`
- `app/configuracoes/page.tsx`
- `app/rotina/page.tsx`
- `app/rotina/agenda/page.tsx`
- `app/rotina/habitos/page.tsx`
- `app/rotina/planejamento/page.tsx`
- `app/rotina/produtividade/page.tsx`
- `app/rotina/tarefas/page.tsx`
- `components/dashboard/DailyCenter.tsx`
- `components/layout/Header.tsx`
- `components/navigation/MainNavigation.tsx`

O Next.js aplica o nonce aos scripts/estilos inline que ele próprio gera quando recebe o cabeçalho CSP no request. A suíte Playwright verifica as violações em todas as rotas; essa validação ainda precisa ser executada no ambiente com dependências instaladas.

### Diretivas e terceiros

A política inclui Supabase (`*.supabase.co`, WebSocket), Vercel Analytics, Sentry ingest, Google Fonts e assets HTTPS. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`, HSTS em produção, X-Content-Type-Options, Referrer-Policy e Permissions-Policy estão incluídos.

## 4. GitHub: visibilidade, histórico e proteções

### Recomendação

Recomendo tornar `Phstreet/nexogest-opessoal` **privado**, pois contém a implementação de um sistema financeiro pessoal. A visibilidade atual foi verificada como **public**. Não alterei a visibilidade nesta implementação: essa mudança é feita no painel e tem efeitos sobre forks, recursos e permissões.

### Varredura completa do histórico

Execute a partir de um clone espelho para cobrir branches e tags:

```bash
git clone --mirror git@github.com:Phstreet/nexogest-opessoal.git /tmp/nexo-mirror.git
gitleaks git -v --redact --log-opts="--all" /tmp/nexo-mirror.git
trufflehog git file:///tmp/nexo-mirror.git --bare
```

Para o clone de trabalho local, também execute:

```bash
gitleaks git -v --redact --log-opts="--all" .
trufflehog git file://$(pwd)
```

Se algum segredo for encontrado:
1. **Revogue/rotacione primeiro** no provedor original (Supabase, Sentry, Vercel ou outro). Apagar o arquivo não invalida uma chave exposta.
2. Atualize o segredo nas variáveis da Vercel e em qualquer ambiente de desenvolvimento.
3. Faça redeploy e invalide sessões/tokens afetados quando aplicável.
4. Só depois avalie limpar o histórico. Para remover um arquivo inteiro do histórico:
   ```bash
   git filter-repo --path .env --invert-paths
   git push --force --all
   git push --force --tags
   ```
   Para substituir um valor em commits antigos, crie um arquivo de substituições **fora do repositório** e rode `git filter-repo --replace-text /caminho/seguro/replacements.txt`; depois faça force-push de branches/tags. Isso exige coordenação com todos os clones/forks. Uma reescrita de histórico não substitui a rotação.

### Tornar privado e manter Vercel

1. GitHub → repositório → **Settings → Danger Zone → Change repository visibility → Make private**.
2. Revise a confirmação de consequências e confirme o nome do repositório.
3. Vercel → **Project → Settings → Git**. Confirme que o repositório continua conectado.
4. GitHub → Settings → Applications → Installed GitHub Apps → Vercel → Configure. Garanta que a instalação Vercel tenha acesso ao repositório privado.
5. Na Vercel, faça um deploy de teste a partir de um novo commit e confirme Preview e Production.
6. Em conta pessoal Hobby, o autor do commit deve ser o proprietário da equipe Hobby para deploy de repositório privado pessoal. Para repositório de organização, a política Hobby pode bloquear deploy privado; nesse caso, use repositório pessoal autorizado ou equipe Pro.

### Proteções recomendadas

- **main:** GitHub → Settings → Branches → Add branch protection rule → pattern `main`. Marque Require a pull request before merging, Require status checks to pass before merging, Require branches to be up to date, Require conversation resolution e Block force pushes. Depois selecione o check `Testes E2E do NEXO / Executar testes Playwright`. Em GitHub Free, branch protection está disponível para repositórios públicos; para privado em conta pessoal, pode exigir GitHub Pro.
- **Secret scanning/push protection:** GitHub → Settings → Code security and analysis. Habilite Secret scanning e Push protection se os controles estiverem disponíveis. Repositórios públicos têm secret scanning gratuito. Para repositórios privados de usuário individual, GitHub documenta limitações de disponibilidade; Secret Protection em privado é voltado a organizações Team/Enterprise e a cenários Enterprise Managed Users. Se não estiver disponível no plano, mantenha Gitleaks/TruffleHog em CI.
- **Dependabot:** GitHub → Settings → Code security and analysis → Dependabot alerts e Dependabot security updates. A configuração semanal de npm e GitHub Actions está em `.github/dependabot.yml`.
- **2FA:** GitHub → Settings → Password and authentication → Two-factor authentication. Prefira passkey ou app autenticador; guarde recovery codes fora do repositório.

## 5. Verificações que ainda dependem do ambiente

- Atualizar `package-lock.json` com `npm install` após instalar as dependências novas.
- Executar lint, typecheck, testes e build no ambiente local/CI.
- Confirmar ausência de violações CSP em navegadores reais e todos os fluxos.
- Confirmar o recebimento de evento no projeto Sentry depois de cadastrar DSN/token.
- Confirmar Leaked Password Protection no painel Supabase (plano Pro+).
- Rodar Gitleaks e TruffleHog no histórico completo e revisar dados pessoais/financeiros.
- Confirmar a mudança para privado e a continuidade do deploy Vercel no painel.
