create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references public.imobiliarias (id) on delete cascade,
  origem_proposta_id uuid references public.propostas (id) on delete set null,
  tipo_pessoa text not null check (tipo_pessoa in ('comprador', 'vendedor')),
  nome_completo text not null,
  cpf text null,
  documento_tipo text null,
  documento_numero text null,
  email text null,
  telefone text null,
  endereco text null,
  bairro text null,
  cidade text null,
  estado text null,
  cep text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (origem_proposta_id, tipo_pessoa, nome_completo)
);

create table if not exists public.cliente_documentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null,
  tipo text null,
  tamanho bigint null,
  url text not null,
  uploaded_at timestamptz null,
  origem_proposta_id uuid references public.propostas (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (cliente_id, url)
);

create index if not exists clientes_imobiliaria_id_idx on public.clientes (imobiliaria_id);
create index if not exists clientes_origem_proposta_id_idx on public.clientes (origem_proposta_id);
create index if not exists cliente_documentos_cliente_id_idx on public.cliente_documentos (cliente_id);
create index if not exists cliente_documentos_origem_proposta_id_idx on public.cliente_documentos (origem_proposta_id);

alter table public.clientes enable row level security;
alter table public.cliente_documentos enable row level security;

drop policy if exists "Platform admins manage clientes" on public.clientes;
create policy "Platform admins manage clientes"
on public.clientes
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members access clientes" on public.clientes;
create policy "Tenant members access clientes"
on public.clientes
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.clientes.imobiliaria_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.clientes.imobiliaria_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists "Platform admins manage cliente_documentos" on public.cliente_documentos;
create policy "Platform admins manage cliente_documentos"
on public.cliente_documentos
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members access cliente_documentos" on public.cliente_documentos;
create policy "Tenant members access cliente_documentos"
on public.cliente_documentos
for all
to authenticated
using (
  exists (
    select 1
    from public.clientes c
    join public.tenant_members tm on tm.tenant_id = c.imobiliaria_id
    where c.id = public.cliente_documentos.cliente_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.clientes c
    join public.tenant_members tm on tm.tenant_id = c.imobiliaria_id
    where c.id = public.cliente_documentos.cliente_id
      and tm.user_id = auth.uid()
  )
);

