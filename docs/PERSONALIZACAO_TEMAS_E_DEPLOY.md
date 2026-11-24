# NEXO — Personalização, temas e publicação

**Estado:** implementação em revisão; não publicada em produção.

## 1. Arquitetura atual

- Preferências continuam na coleção nexo_preferences, coluna JSONB payload da tabela existente public.nexo_user_data. O campo settingsV1 contém schemaVersion: 2.
- A tabela existente tem RLS por auth.uid() para SELECT, INSERT, UPDATE e DELETE. Não foi criada uma segunda fonte de verdade user_preferences, evitando duplicar dados e sincronização.
- O migrador mantém compatibilidade com preferências legadas, incluindo weekStartsOn, sidebarCollapsed e tema antigo dark (convertido para graphite).
- O provider mantém cache por usuário em localStorage, atualizações entre abas e consulta remota periódica.
- Cookie não sensível nexo_appearance_v2 é atualizado ao salvar e no login. O bootstrap com nonce lê o cookie antes da hidratação; localStorage v2 e v1 são fallback.
- A aparência agora tem prévia temporária, Salvar, Descartar e restauração confirmada. O estado de prévia não grava no Supabase.
- Tema automático acompanha mudanças de prefers-color-scheme durante a sessão.

## 2. Temas e contraste

Temas: Grafite (padrão), Claro, Automático, Meia-noite e Grafite quente.

Destaques: Prata, Azul, Violeta, Esmeralda, Âmbar e Rosa. Os pares de cor do texto sobre botão foram calculados para manter contraste WCAG AA (mínimo 4,5:1). Menor razão calculada entre as combinações implementadas: 5,48:1. Os links usam tons separados para fundos claros e escuros; menor razão calculada: 4,98:1.

Densidade, escala tipográfica, raio dos cantos, movimento reduzido e alto contraste usam atributos no elemento html e tokens CSS. A preferência do sistema para movimento reduzido sempre é respeitada.

## 3. Limitação de tokenização

A base ainda não está completamente tokenizada. A auditoria encontrou cores fixas em folhas globais e estilos locais de Financeiro, Contas a pagar, Agenda, Hábitos, Metas e Central do Dia. O sistema de temas adiciona tokens e sobrescreve superfícies compartilhadas, mas não substitui cada cor literal existente.

### Amostra quantitativa da auditoria

- app/globals.css: 582 ocorrências hex (278 valores distintos), 74 ocorrências RGB/RGBA, 426 declarações de espaçamento, 123 raios, 46 sombras e 424 declarações tipográficas.
- app/financeiro/financeiro.css: 100 hex, 2 RGB/RGBA, 67 espaçamentos, 19 raios, 1 sombra e 74 declarações tipográficas.
- Financeiro: Contas a pagar 90 hex; Contas a receber 85; Contas 70; Investimentos 78; Reservas 125; Histórico 91; Planejamento 144.
- Rotina: Agenda 96 hex; Hábitos 87; Tarefas 97; Planejamento 88; página inicial da Rotina 101 hex e 7 RGB/RGBA.
- Metas: 88 hex e 9 RGB/RGBA.
- Central do Dia: 75 hex e 13 RGB/RGBA.
- Navegação: MainNavigation 32 hex e 18 RGB/RGBA; Header 29 hex e 1 RGB/RGBA.

Os estilos locais ainda repetem espaçamentos, raios e fontes por página. Esta amostra é uma auditoria estática dos principais arquivos, não uma declaração de que todos os arquivos do repositório foram convertidos.

O comando npm run check:design-tokens lista cores fixas, classes Tailwind de cor e estilos inline. Ele deve retornar zero violações antes de ser incluído como bloqueio obrigatório de CI e antes da publicação. Não promova esta versão enquanto a checagem reportar violações.

## 4. Perfil e avatar

- Nome de exibição validado entre 2 e 60 caracteres e sem caracteres HTML.
- Avatar aceita JPG, PNG e WebP na interface, faz recorte quadrado central e converte para WebP 256×256.
- O servidor aceita somente WebP após conversão, valida assinatura RIFF/WEBP e limita o upload a 2 MB.
- Bucket nexo-avatars é público apenas para leitura das imagens; inserção, atualização, listagem autenticada e exclusão exigem JWT e pasta inicial igual ao UUID do usuário.
- O perfil guarda avatarPath; URLs públicas são montadas a partir de NEXT_PUBLIC_SUPABASE_URL. O campo avatarUrl legado continua sendo lido durante a transição.
- Arquivo antigo é removido depois de salvar o novo caminho do perfil. Upload não salvo pode deixar um objeto órfão; limpeza automática ainda não existe.

## 5. Supabase

A migração 20261124134840_nexo_avatars_bucket.sql foi aplicada somente ao projeto NEXO-DEV (mmwkpwspyjvxsennvhic) e conferida:
- bucket nexo-avatars, público para leitura, limite 2.097.152 bytes;
- políticas SELECT, INSERT, UPDATE e DELETE verificadas com pasta do usuário autenticado.

Nenhuma migração foi aplicada ao projeto de produção. A tabela de preferências não foi criada: a aplicação continua usando nexo_user_data com RLS já existente.

### Verificação das políticas

    select policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'NEXO avatar %';

    select policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = 'nexo_user_data';

### Rollback SQL do bucket

Este rollback se recusa a remover o bucket se ainda houver arquivos. Faça backup dos objetos antes de decidir removê-los.

    do $$
    begin
      if exists (select 1 from storage.objects where bucket_id = 'nexo-avatars') then
        raise exception 'Bucket contém avatares. Exporte os objetos antes do rollback.';
      end if;
    end $$;

    drop policy if exists "NEXO avatar read own metadata" on storage.objects;
    drop policy if exists "NEXO avatar insert own" on storage.objects;
    drop policy if exists "NEXO avatar update own" on storage.objects;
    drop policy if exists "NEXO avatar delete own" on storage.objects;

    delete from storage.buckets where id = 'nexo-avatars';

## 6. Variáveis de ambiente

Conferir individualmente em Vercel → Project → Settings → Environment Variables (Production, Preview e Development conforme necessário):

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_URL (alias opcional de servidor)
- SUPABASE_PUBLISHABLE_KEY (alias opcional de servidor)
- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_SENTRY_DSN
- SENTRY_AUTH_TOKEN (segredo, somente build/servidor)
- SENTRY_ORG
- SENTRY_PROJECT
- SENTRY_TEST_TOKEN (temporário; remover depois do teste controlado)

NEXT_PUBLIC_APP_ENV e NEXT_PUBLIC_APP_VERSION são injetadas pelo next.config.js. Não criar NEXT_PUBLIC_SERVICE_ROLE_KEY ou qualquer segredo Supabase com prefixo público. .env* está ignorado pelo .gitignore, com exceção de .env.example.

## 7. Pré-voo e backup

Execute em um terminal com o repositório e Supabase CLI autenticados. Use primeiro o projeto de desenvolvimento e confirme o project ref antes de qualquer comando remoto.

    git status --short
    git switch feature/central-configuracoes-perfil
    git pull --ff-only origin feature/central-configuracoes-perfil
    git fetch origin main
    git tag -a pre-personalizacao -m "Rollback antes da personalização NEXO" origin/main
    git push origin pre-personalizacao

    gitleaks git . --redact --verbose
    npm audit --omit=dev --audit-level=low
    npm audit --audit-level=low
    npm run check:design-tokens

Backup remoto antes da migração de produção (linke explicitamente o projeto de produção; nunca reutilize o vínculo de NEXO-DEV sem conferir):

    supabase login
    supabase link --project-ref <PROJECT_REF_PRODUCAO>

    mkdir -p backups
    supabase db dump --linked -f backups/roles.sql --role-only
    supabase db dump --linked -f backups/schema.sql
    supabase db dump --linked -f backups/data.sql --use-copy --data-only

Guarde os dumps fora do repositório e com acesso restrito. Backup do banco não inclui automaticamente arquivos do Storage; exporte os avatares separadamente antes de uma reversão destrutiva.

## 8. Teste e migração

    npm install
    npm ci
    npm run lint
    npm run typecheck
    npm test
    npm run test:e2e
    npm run build

O lockfile precisa ser regenerado no ambiente do projeto: a declaração atual de package.json e package-lock.json ainda diverge para dependências de Sentry/Zod. O conjunto atual usa Playwright; Vitest e Testing Library ainda não estão instalados/configurados.

No projeto de desenvolvimento, conferir a migração:

    supabase migration list --linked
    supabase db push --linked --dry-run

Em produção, somente depois de backup, validação no preview e CI verde:

    supabase link --project-ref <PROJECT_REF_PRODUCAO>
    supabase migration list --linked
    supabase db push --linked --dry-run
    supabase db push --linked

Aplique a migração antes do deploy do código que usa o bucket. Verifique novamente as políticas RLS e faça upload/remoção com dois usuários de teste diferentes; um usuário não pode gravar nem remover objetos no diretório do outro.

## 9. Pull Request, CI e Vercel

Ordem de integração necessária por causa da cadeia atual de branches:
1. PR #21 (auditoria) para main.
2. PR #22 (segurança) para main, depois de atualizar o lockfile e validar CI.
3. PR #23 (configurações/perfil/personalização), retarget para main depois que a base estiver integrada.

A PR #23 está em Draft e atualmente aponta para security/senha-sentry-csp, não para main. O workflow GitHub Actions está configurado para PRs direcionadas a main, portanto não houve CI para o commit mais recente desta branch.

Depois de retarget:
- exigir lint, typecheck, testes, E2E e build verdes;
- conferir preview Vercel em todas as rotas e temas;
- validar avatar e políticas no Supabase;
- só então remover Draft e integrar.

Deploy automático pela integração GitHub/Vercel após merge na main. Alternativa por CLI, em terminal autenticado e projeto já linkado:

    npx vercel link
    npx vercel --prod --yes

## 10. CSP

O proxy.ts atual envia Content-Security-Policy-Report-Only. Mantenha Report-Only durante a validação de todas as rotas, temas, componentes e uploads. Só substitua por Content-Security-Policy depois de revisar relatórios sem violações legítimas, corrigir estilos/recursos bloqueados e repetir E2E e teste manual. Não ative bloqueio enquanto o script de tokens e o teste CSP acusarem violações.

## 11. Pós-publicação

- Login, logout, recuperação de senha e sessão.
- Central do Dia, Financeiro, Contas a pagar/receber, Agenda, Hábitos, Metas, Relatórios e Configurações.
- Repetir navegação com Grafite, Claro, Automático, Meia-noite e Grafite quente.
- Trocar os seis destaques, recarregar e conferir em outra sessão/dispositivo.
- Conferir que a primeira pintura já usa o tema salvo.
- Upload, remoção e exibição de avatar no topo e sidebar.
- Conferir blocos da Central do Dia e ordem/visibilidade da sidebar; estes controles ainda não estão implementados.
- Modo de privacidade em todos os valores financeiros.
- Headers de segurança, Lighthouse e evento controlado no Sentry.
- Testar usuário antigo sem preferências e usuário novo.

## 12. Rollback

1. Código: em Vercel → Deployments, promover a implantação anterior à produção. Alternativamente, reverter o merge no GitHub e aguardar novo deploy.
2. Banco: manter a migração do bucket se houver avatares. O rollback SQL acima só pode ser executado quando o bucket estiver vazio; preferir manter o bucket e reverter apenas o código.
3. Dados: restaurar o dump somente se houve alteração/perda real e após avaliar o impacto. Restaurar banco pode sobrescrever registros criados depois do backup; arquivos de Storage exigem restauração separada.

Seguro: reverter o deploy do frontend. Exige cuidado: reverter schema com arquivos presentes, restaurar dados ou apagar conta/objetos.
