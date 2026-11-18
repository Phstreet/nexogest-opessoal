-- Remove execução direta da função event-trigger por papéis da API.
-- O PostgreSQL continua invocando-a como gatilho DDL; clientes REST não precisam executá-la.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

comment on function public.rls_auto_enable() is
  'Event trigger interno: habilita RLS em tabelas novas no schema public. Não executar pela API.';
