# NEXO PWA — instalação móvel e operação segura

## O que foi implementado

- Manifesto Next.js em `app/manifest.ts`, servido em `/manifest.webmanifest`.
- Ícones PNG padrão, maskable, Apple Touch Icon e splash screens iOS gerados a partir de `public/icons/nexo-icon-source.svg` e `public/icons/nexo-maskable-source.svg`.
- Geração automática dos assets antes de `dev` e `build`, usando Sharp.
- Service worker próprio em `public/sw.js`, registrado apenas em produção e em contexto seguro.
- Cache-first apenas para recursos públicos estáticos; navegação network-first, sem armazenar HTML de páginas autenticadas.
- Fallback offline estático em `public/offline-shell.html` e rota acessível `/offline`.
- Aviso de instalação, detecção iOS/Android, estado de conexão e atualização manual do worker.
- Navegação inferior móvel e sidebar em gaveta.
- CSP Report-Only preservada com `worker-src 'self'` e `manifest-src 'self'`; nonce continua sendo usado pelo layout.
- Manifesto, worker e fallback offline liberados do redirecionamento de autenticação.
- Logout limpa o cache público do PWA e o cache local de preferências por usuário.

## Segurança offline

O NEXO é um aplicativo financeiro. Por decisão de segurança, o PWA não oferece consulta offline a saldos, lançamentos, contas, agenda privada ou dados do Supabase. Não são armazenados:

- páginas HTML de navegação;
- respostas `/api/*`;
- respostas RSC/Server Actions;
- chamadas Supabase Auth, REST ou Storage;
- conteúdo que contenha `Set-Cookie`, `Cache-Control: private` ou `no-store`.

O modo offline apresenta apenas uma tela pública informativa e recursos estáticos. A autenticação continua baseada nos cookies HttpOnly existentes e na renovação de sessão do servidor.

## Comandos

```bash
npm install
npm run generate:pwa-icons
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build

# E2E do service worker em build de produção (Playwright inicia o servidor)
NEXO_PWA_E2E_PRODUCTION=true npm run test:pwa

# Para abrir manualmente o build em outra sessão
npm start
```

O comando `npm install` é necessário após atualizar o projeto para sincronizar o lockfile e instalar Sharp. Em seguida, use `npm ci` em CI somente quando `package.json` e `package-lock.json` estiverem sincronizados.

## Testar localmente

O service worker fica desativado em desenvolvimento para não interferir no hot reload. Para testar a instalação localmente:

```bash
npm install
npm run generate:pwa-icons
npm run build
```

Inicie o servidor em um terminal:

```bash
npm start
```

Em outro terminal, acesse `http://localhost:3000` no próprio dispositivo ou use um túnel HTTPS, por exemplo:

```bash
cloudflared tunnel --url http://localhost:3000
```

O link de Preview HTTPS da Vercel é preferível para testar no celular real. Não exponha variáveis de ambiente, tokens ou credenciais ao configurar o túnel.

## Instalar no Android

1. Abra o link HTTPS do Preview no Chrome.
2. Entre na conta NEXO.
3. Toque em **Instalar aplicativo** no aviso ou abra **Configurações → Aplicativo**.
4. Confirme em **Instalar**.
5. Abra o NEXO pelo ícone da tela inicial e confirme que não há barra de endereço.

Se o botão não aparecer, abra o menu ⋮ do Chrome e escolha **Instalar app** ou **Adicionar à tela inicial**. O texto varia conforme o aparelho.

## Instalar no iPhone

1. Abra o link HTTPS no **Safari** (não no navegador interno de outro aplicativo).
2. Entre na conta NEXO.
3. Toque em **Compartilhar** (ícone de quadrado com seta para cima).
4. Role as opções e toque em **Adicionar à Tela de Início**.
5. Confira o nome NEXO e toque em **Adicionar**.
6. Abra o ícone NEXO na tela inicial.

No iPhone, a instalação manual pela folha de compartilhamento é o fluxo esperado; o evento `beforeinstallprompt` não é disponibilizado pelo Safari.

## Testes manuais no celular

- [ ] Instalar pelo Chrome Android ou Safari iOS.
- [ ] Conferir nome NEXO e ícone.
- [ ] Abrir em modo standalone/tela cheia.
- [ ] Fazer login e confirmar sessão mantida após fechar e reabrir.
- [ ] Navegar por Central do Dia, Financeiro, Agenda e Hábitos.
- [ ] Ativar modo avião e abrir uma rota: deve aparecer somente o fallback offline, sem exibir dados financeiros armazenados.
- [ ] Desativar modo avião e confirmar retorno automático da conexão.
- [ ] Publicar nova versão de Preview e confirmar o aviso de atualização.
- [ ] Tocar em atualizar e confirmar recarga após ativação do worker novo.
- [ ] Sair da conta e verificar limpeza do cache e das preferências locais.
- [ ] Desinstalar e reinstalar o PWA.
- [ ] Testar orientação, teclado numérico, seletor nativo de data, notch e barra inferior.

## Limitações e itens Em breve

- Consulta de dados financeiros e pessoais offline: **não implementada intencionalmente**.
- Web Push para contas a vencer, hábitos e agenda: **Em breve**. Requer tabela de subscriptions com RLS, chaves VAPID, endpoint de inscrição/remoção, função de envio agendada e controles por categoria. No iPhone, Web Push exige iOS 16.4 ou superior e o app adicionado à Tela de Início.
- Bloqueio do app por PIN/biometria/WebAuthn: **Em breve**. A biometria web não deve ser simulada com PIN salvo localmente.
- Logout por inatividade: permanece na configuração de segurança existente; validar comportamento no dispositivo real.
- Splash screen Apple depende de dimensões e versões do iOS; validar nos modelos suportados.
- O suporte ao evento de instalação e à atualização visual varia entre navegadores.

## CSP, Sentry e headers

O proxy continua emitindo CSP Report-Only com nonce e mantém os domínios Supabase, Vercel Analytics e Sentry já utilizados pelo projeto. Foram adicionados apenas `worker-src 'self'` e `manifest-src 'self'`; não foi adicionado `unsafe-inline`. HSTS continua aplicado em produção pelo proxy. O header do worker usa `no-store` para que o navegador verifique novas versões.

Antes de promover a CSP de Report-Only para bloqueio, analisar os relatórios em todas as rotas e validar o app instalado.

## Lighthouse e critérios de instalação

O Lighthouse 12 removeu a categoria PWA e suas auditorias ([issue oficial do Lighthouse](https://github.com/GoogleChrome/lighthouse/issues/15535)). Portanto, não use `--only-categories=pwa` nas versões atuais. Use Lighthouse para desempenho, acessibilidade, boas práticas e SEO, e valide manifesto, worker, instalação e modo offline com os testes Playwright do projeto e a interface de instalação do Chrome.

```bash
npx lighthouse https://URL-DO-PREVIEW --only-categories=performance,accessibility,best-practices,seo --view
```

A pontuação Lighthouse não certifica a instalação. A aprovação final depende do manifesto e ícones servidos, worker controlando a página em produção, HTTPS e instalação confirmada no navegador/dispositivo.

## Publicação e rollback

1. Abrir PR da branch PWA para a branch-base correta da cadeia atual.
2. Sincronizar dependências com `npm install` e confirmar o lockfile.
3. Executar lint, typecheck, testes e build.
4. Aguardar CI e Preview da Vercel.
5. Abrir o Preview em Android e iPhone reais; validar login, instalação e modo avião.
6. Fazer merge somente após CI e testes manuais aprovados.
7. Após deploy, validar `/manifest.webmanifest`, `/sw.js`, ícones e `/offline`.
8. Para rollback, reverter o commit/merge PWA na branch principal e publicar novamente. No navegador, atualizar o app conectado para receber o novo worker; se necessário, remover o app da tela inicial e limpar os dados do site nas configurações do navegador.

## Etapa 2 — lojas com Capacitor (somente plano)

O mesmo projeto pode ser empacotado com Capacitor. Como o NEXO usa Next.js App Router e autenticação/cookies no servidor, a opção de menor risco é um shell Capacitor que aponta para a URL HTTPS de produção. Export estático só é viável após separar as rotas que dependem de APIs, autenticação server-side, headers nonce e recursos dinâmicos; não é uma troca simples de configuração.

1. Instalar Capacitor, criar `capacitor.config.ts` com a URL de produção e adicionar plataformas Android/iOS.
2. Criar projetos nativos e abrir no Android Studio e Xcode.
3. Configurar deep links, status bar, splash, ícones, permissões mínimas, armazenamento seguro e política de privacidade.
4. Google Play Console: conta de distribuição completa com taxa de cadastro de US$ 25, paga uma vez. Contas pessoais também precisam cumprir os requisitos de teste e verificação de dispositivo antes da distribuição pública ([regras oficiais](https://support.google.com/googleplay/android-developer/answer/6112435)).
5. Apple Developer Program: assinatura de US$ 99 por ano, cobrada em moeda local onde disponível; organizações precisam passar pela verificação da entidade e podem precisar de D‑U‑N‑S ([preços e inscrição oficiais](https://developer.apple.com/help/account/membership/program-enrollment/)).
6. Preparar screenshots por tamanho de tela, ícones de loja, descrição, classificação etária, URL de suporte e política de privacidade.
7. Revisar políticas de coleta/compartilhamento de dados, exclusão de conta, compras digitais (se houver), login e permissões.
8. Testar distribuição interna/TestFlight antes de submeter.

**PWA:** distribuição imediata via HTTPS, sem aprovação de loja e manutenção de um único código; limitações de APIs e integração nativa variam por navegador. **Capacitor:** presença nas lojas e acesso a plugins nativos; exige contas pagas, builds assinados, revisão, manutenção de projetos nativos e adequação às políticas das lojas.
