create table if not exists public.perfis_contrato (
  id uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references public.imobiliarias (id) on delete cascade,
  nome text not null,
  descricao text null,
  icone text not null default 'Scale',
  instructions_ia text null,
  ativo boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists perfis_contrato_imobiliaria_id_idx on public.perfis_contrato (imobiliaria_id);
create index if not exists perfis_contrato_ativo_idx on public.perfis_contrato (imobiliaria_id, ativo);

alter table public.perfis_contrato enable row level security;

drop policy if exists "Platform admins manage perfis_contrato" on public.perfis_contrato;
create policy "Platform admins manage perfis_contrato"
on public.perfis_contrato
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members access perfis_contrato" on public.perfis_contrato;
create policy "Tenant members access perfis_contrato"
on public.perfis_contrato
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.perfis_contrato.imobiliaria_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.perfis_contrato.imobiliaria_id
      and tm.user_id = auth.uid()
  )
);

