# NEXO PWA — instalação e operação

## Segurança e cache

O service worker é registrado apenas em build de produção. Ele aplica cache-first exclusivamente a recursos estáticos públicos versionados em `/_next/static/`, `/icons/`, `/nexo-icon.svg` e `/favicon.ico`.

Navegações usam rede sem gravar respostas. Se a rede falhar, o worker apresenta uma página offline estática e sem dados. Requisições `/api/`, Server Actions, RSC, autenticação e chamadas ao Supabase nunca entram no cache. A sessão permanece nos cookies HttpOnly existentes.

O logout limpa chaves locais com prefixo `nexo_` e caches identificados como dados de usuário. O cache público de arquivos estáticos pode permanecer no dispositivo.

## Ícones

Execute `npm run pwa:icons`. O script usa `public/nexo-icon.svg` como fonte e gera PNGs 192, 512, maskable 192/512, Apple Touch Icon, favicons e telas de abertura iOS em `public/icons/`.

## Desenvolvimento

O service worker fica desativado em `next dev`. Para validar a instalação, publique um Preview HTTPS na Vercel ou rode `npm run build && npm run start` localmente em localhost.

## Testes

- `npm run test:pwa`: manifesto e página offline; o teste do service worker exige `PLAYWRIGHT_PWA_PRODUCTION=true`.
- `npm run lint`, `npm run typecheck`, `npm run build`.
- Teste em aparelho real é obrigatório para instalação, ícone, tela cheia, atualização e login persistente.

## Atualização

A versão nova fica em espera até o usuário tocar em “Atualizar”. O botão envia `SKIP_WAITING` ao worker em espera e recarrega a página após a troca de controller.

## Limitações

O modo offline não permite consultar, criar ou alterar dados pessoais/financeiros. Web Push ainda não foi implementado. No iOS, a instalação deve ser feita pelo Safari usando Compartilhar > Adicionar à Tela de Início; suporte a recursos PWA depende da versão do iOS.
