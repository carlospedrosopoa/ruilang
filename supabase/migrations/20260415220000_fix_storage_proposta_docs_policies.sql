insert into storage.buckets (id, name, public)
values ('proposta-docs', 'proposta-docs', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public upload proposta docs" on storage.objects;
create policy "Public upload proposta docs"
on storage.objects
for insert
to public
with check (bucket_id = 'proposta-docs');

drop policy if exists "Public read proposta docs" on storage.objects;
create policy "Public read proposta docs"
on storage.objects
for select
to public
using (bucket_id = 'proposta-docs');

drop policy if exists "Public delete proposta docs" on storage.objects;
create policy "Public delete proposta docs"
on storage.objects
for delete
to public
using (bucket_id = 'proposta-docs');

drop policy if exists "Public update proposta docs" on storage.objects;
create policy "Public update proposta docs"
on storage.objects
for update
to public
using (bucket_id = 'proposta-docs')
with check (bucket_id = 'proposta-docs');

