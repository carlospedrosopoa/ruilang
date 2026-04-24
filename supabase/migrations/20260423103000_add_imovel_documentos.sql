create table if not exists public.imovel_documentos (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid not null references public.imoveis (id) on delete cascade,
  titulo text not null,
  nome_arquivo text not null,
  storage_path text not null,
  tipo text null,
  tamanho bigint null,
  url text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid null
);

create index if not exists imovel_documentos_imovel_id_idx on public.imovel_documentos (imovel_id);
create index if not exists imovel_documentos_uploaded_at_idx on public.imovel_documentos (imovel_id, uploaded_at desc);

alter table public.imovel_documentos enable row level security;

drop policy if exists "Platform admins manage imovel_documentos" on public.imovel_documentos;
create policy "Platform admins manage imovel_documentos"
on public.imovel_documentos
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members access imovel_documentos" on public.imovel_documentos;
create policy "Tenant members access imovel_documentos"
on public.imovel_documentos
for all
to authenticated
using (
  exists (
    select 1
    from public.imoveis i
    join public.tenant_members tm on tm.tenant_id = i.imobiliaria_id
    where i.id = public.imovel_documentos.imovel_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.imoveis i
    join public.tenant_members tm on tm.tenant_id = i.imobiliaria_id
    where i.id = public.imovel_documentos.imovel_id
      and tm.user_id = auth.uid()
  )
);
