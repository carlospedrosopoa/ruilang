create table if not exists public.imoveis (
  id uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references public.imobiliarias (id) on delete cascade,
  titulo text not null,
  dados jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists imoveis_imobiliaria_id_idx on public.imoveis (imobiliaria_id);
create index if not exists imoveis_ativo_idx on public.imoveis (imobiliaria_id, ativo);

alter table public.imoveis enable row level security;

drop policy if exists "Platform admins manage imoveis" on public.imoveis;
create policy "Platform admins manage imoveis"
on public.imoveis
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members access imoveis" on public.imoveis;
create policy "Tenant members access imoveis"
on public.imoveis
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.imoveis.imobiliaria_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.imoveis.imobiliaria_id
      and tm.user_id = auth.uid()
  )
);

alter table public.submissions
add column if not exists imovel_id uuid references public.imoveis (id) on delete set null;

create index if not exists submissions_imovel_id_idx on public.submissions (imovel_id);
