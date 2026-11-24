# NEXO — Configurações, Perfil e Dados

## Persistência e migração

As configurações são armazenadas na coleção existente nexo_preferences, dentro de settingsV1, com schemaVersion: 1. O migrador migrateUserSettings converte os campos legados weekStartsOn e sidebarCollapsed sem remover navigationFavorites.

O perfil continua na coleção existente nexo_profile. Os novos campos opcionais são phone, motto e avatarUrl. O avatar é reduzido para WebP 256×256 e limitado a 240 KB antes de ser enviado.

Não é necessária uma migração SQL para esta etapa: o projeto já possui public.nexo_user_data como armazenamento JSONB por usuário. A tabela está com RLS habilitado e políticas de SELECT, INSERT, UPDATE e DELETE que restringem user_id a auth.uid(). As novas preferências e o perfil usam chaves já permitidas no modelo de coleções; não são criadas tabelas paralelas.

## Sincronização

- Cache local por usuário em localStorage, apenas como fallback.
- Atualização otimista e gravação com debounce de 650 ms.
- Revisão remota verificada antes de salvar para evitar sobrescrever alterações concorrentes.
- BroadcastChannel e evento storage para sincronização entre abas.
- Consulta remota a cada 60 segundos e ao recuperar o foco para refletir alterações feitas em outros dispositivos.
- Bootstrap visual síncrono com nonce CSP para reduzir flash de tema durante a hidratação.

## Efeitos ativos

- Página inicial: redirecionamento quando o usuário abre /.
- Menu compacto: controla a navegação lateral e mantém o campo legado compatível.
- Privacidade: alterna o modo de ocultação no topo e aplica blur nos seletores financeiros identificados.
- Tema, destaque, densidade, fonte, movimento reduzido e contraste: alteram os tokens/estilos globais.
- Inatividade: encerra a sessão após o período configurado.

## Limitações explícitas

O ciclo financeiro personalizado, os alertas de vencimento, as regras de streak, o primeiro dia da semana, os horários padrão da agenda, a ordenação dos blocos da Central do Dia, categorias editáveis, notificações, MFA/2FA, sessões, PIN, importação CSV/XLSX, backups agendados e exclusão de dados/conta ainda não têm serviços de domínio completos conectados. Esses itens não são apresentados como controles ativos. A tela informa “Em breve” onde aplicável.

A importação de backup JSON existente valida as coleções, pede confirmação e baixa um arquivo de segurança do estado atual antes de iniciar a restauração. A gravação de várias coleções não é transacional; em caso de falha de rede durante a restauração, algumas coleções podem já ter sido atualizadas. O arquivo de segurança baixado permite recuperação manual.

## Verificação

Executar npm test, npm run lint, npm run typecheck, npm run test:e2e e npm run build após atualizar o lockfile no ambiente do projeto. Os testes tests/settings.spec.ts cobrem migração de preferências, validação de schema e validação de avatar.
