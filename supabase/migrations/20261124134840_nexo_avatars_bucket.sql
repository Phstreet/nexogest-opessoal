-- NEXO — bucket de avatares com gravação isolada por usuário.
-- Bucket público apenas para leitura das fotos de perfil; escrita e remoção exigem JWT
-- e caminho iniciado pelo UUID do usuário autenticado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nexo-avatars',
  'nexo-avatars',
  true,
  2097152,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "NEXO avatar read own metadata" on storage.objects;
create policy "NEXO avatar read own metadata"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'nexo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "NEXO avatar insert own" on storage.objects;
create policy "NEXO avatar insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'nexo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "NEXO avatar update own" on storage.objects;
create policy "NEXO avatar update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'nexo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'nexo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "NEXO avatar delete own" on storage.objects;
create policy "NEXO avatar delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'nexo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
