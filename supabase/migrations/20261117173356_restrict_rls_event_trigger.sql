-- A função pode não existir em bancos criados sem o event trigger opcional.
-- A migration deve continuar aplicável tanto em bancos novos quanto nos já configurados.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
    execute 'comment on function public.rls_auto_enable() is ''Event trigger interno: habilita RLS em tabelas novas no schema public. Não executar pela API.''';
  end if;
end;
$$;
