create table if not exists public.cliente_propostas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  proposta_id uuid not null references public.propostas (id) on delete cascade,
  tipo_pessoa text not null check (tipo_pessoa in ('comprador', 'vendedor')),
  created_at timestamptz not null default now(),
  unique (cliente_id, proposta_id, tipo_pessoa)
);

create index if not exists cliente_propostas_cliente_id_idx on public.cliente_propostas (cliente_id);
create index if not exists cliente_propostas_proposta_id_idx on public.cliente_propostas (proposta_id);

create index if not exists clientes_imob_cpf_idx
  on public.clientes (imobiliaria_id, cpf)
  where cpf is not null and cpf <> '';

create index if not exists clientes_imob_doc_idx
  on public.clientes (imobiliaria_id, documento_tipo, documento_numero)
  where documento_numero is not null and documento_numero <> '';

alter table public.cliente_propostas enable row level security;

drop policy if exists "Platform admins manage cliente_propostas" on public.cliente_propostas;
create policy "Platform admins manage cliente_propostas"
on public.cliente_propostas
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members access cliente_propostas" on public.cliente_propostas;
create policy "Tenant members access cliente_propostas"
on public.cliente_propostas
for all
to authenticated
using (
  exists (
    select 1
    from public.clientes c
    join public.tenant_members tm on tm.tenant_id = c.imobiliaria_id
    where c.id = public.cliente_propostas.cliente_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.clientes c
    join public.tenant_members tm on tm.tenant_id = c.imobiliaria_id
    where c.id = public.cliente_propostas.cliente_id
      and tm.user_id = auth.uid()
  )
);

