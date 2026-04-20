create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  tipo_contrato text not null,
  perfil text not null,
  provider text null,
  model text null,
  version integer not null default 1,
  active boolean not null default true,
  template_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo_contrato, perfil, version)
);

create index if not exists contract_templates_tipo_perfil_active_idx
  on public.contract_templates (tipo_contrato, perfil, active, version desc);

alter table public.contract_templates enable row level security;

drop policy if exists "Platform admins manage contract_templates" on public.contract_templates;
create policy "Platform admins manage contract_templates"
on public.contract_templates
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members read contract_templates" on public.contract_templates;
create policy "Tenant members read contract_templates"
on public.contract_templates
for select
to authenticated
using (true);

