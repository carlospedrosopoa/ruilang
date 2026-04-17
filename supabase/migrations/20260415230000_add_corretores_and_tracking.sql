create table if not exists public.corretores (
  id uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references public.imobiliarias (id) on delete cascade,
  nome text not null,
  creci text null,
  telefone text null,
  email text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corretores_imobiliaria_id_idx on public.corretores (imobiliaria_id);
create index if not exists corretores_nome_idx on public.corretores (nome);

alter table public.corretores enable row level security;

drop policy if exists "Platform admins manage corretores" on public.corretores;
create policy "Platform admins manage corretores"
on public.corretores
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members access corretores" on public.corretores;
create policy "Tenant members access corretores"
on public.corretores
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.corretores.imobiliaria_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.corretores.imobiliaria_id
      and tm.user_id = auth.uid()
  )
);

alter table public.propostas
add column if not exists corretor_id uuid references public.corretores (id),
add column if not exists first_opened_at timestamptz,
add column if not exists submitted_at timestamptz;

alter table public.submissions
add column if not exists corretor_id uuid references public.corretores (id),
add column if not exists first_opened_at timestamptz,
add column if not exists submitted_at timestamptz;

create index if not exists propostas_corretor_id_idx on public.propostas (corretor_id);
create index if not exists submissions_corretor_id_idx on public.submissions (corretor_id);

