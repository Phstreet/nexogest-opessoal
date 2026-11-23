# NEXO — Gestão Pessoal

Aplicação pessoal para organizar finanças, rotina, tarefas, hábitos, objetivos e relatórios.

## Requisitos

- Node.js 22.x
- npm
- Projeto Supabase com Auth e banco configurados

## Configuração local

1. Instale as dependências:

```bash
npm ci
```

2. Copie `.env.example` para `.env.local`.
3. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com os dados do projeto Supabase que será usado no ambiente local.
4. Inicie a aplicação:

```bash
npm run dev
```

Acesse http://localhost:3000.

## Comandos

```bash
npm run dev        # desenvolvimento
npm run lint       # ESLint
npx tsc --noEmit   # verificação TypeScript
npm run build      # build de produção
npm run start      # servidor de produção
npm run test:e2e   # testes Playwright
```

## Estrutura principal

- `app/`: rotas e páginas Next.js.
- `components/`: componentes de interface e layout.
- `contexts/`: autenticação e confirmações.
- `hooks/`: carregamento e persistência de coleções.
- `lib/finance/`: tipos, cálculos e regras financeiras.
- `lib/supabase/`: cliente, servidor e chaves de sincronização.
- `supabase/migrations/`: estrutura e políticas do banco.
- `tests/`: testes automatizados.

## Segurança

O NEXO utiliza cookies HttpOnly para tokens de sessão e políticas RLS para isolar os dados de cada usuário. A aplicação usa a chave publishable; nunca configure ou exponha uma chave `service_role`.

Consulte [docs/SINCRONIZACAO_MULTIDISPOSITIVO.md](docs/SINCRONIZACAO_MULTIDISPOSITIVO.md) para a arquitetura de sincronização, proteção de dados locais e procedimento de validação.
