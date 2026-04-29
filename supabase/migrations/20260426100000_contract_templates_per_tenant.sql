alter table public.contract_templates
  add column if not exists imobiliaria_id uuid null references public.imobiliarias(id) on delete cascade;

alter table public.contract_templates
  drop constraint if exists contract_templates_tipo_contrato_perfil_version_key;

drop index if exists public.contract_templates_tipo_perfil_active_idx;
create index if not exists contract_templates_tipo_perfil_active_idx
  on public.contract_templates (imobiliaria_id, tipo_contrato, perfil, active, version desc);

create unique index if not exists contract_templates_unique_global
  on public.contract_templates (tipo_contrato, perfil, version)
  where imobiliaria_id is null;

create unique index if not exists contract_templates_unique_tenant
  on public.contract_templates (imobiliaria_id, tipo_contrato, perfil, version)
  where imobiliaria_id is not null;

alter table public.contract_templates enable row level security;

drop policy if exists "Platform admins manage contract_templates" on public.contract_templates;
create policy "Platform admins manage contract_templates"
on public.contract_templates
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members manage own contract_templates (insert)" on public.contract_templates;
create policy "Tenant members manage own contract_templates (insert)"
on public.contract_templates
for insert
to authenticated
with check (
  imobiliaria_id is not null
  and exists (
    select 1
    from public.tenant_members tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = imobiliaria_id
  )
);

drop policy if exists "Tenant members manage own contract_templates (update)" on public.contract_templates;
create policy "Tenant members manage own contract_templates (update)"
on public.contract_templates
for update
to authenticated
using (
  imobiliaria_id is not null
  and exists (
    select 1
    from public.tenant_members tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = imobiliaria_id
  )
)
with check (
  imobiliaria_id is not null
  and exists (
    select 1
    from public.tenant_members tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = imobiliaria_id
  )
);

drop policy if exists "Tenant members manage own contract_templates (delete)" on public.contract_templates;
create policy "Tenant members manage own contract_templates (delete)"
on public.contract_templates
for delete
to authenticated
using (
  imobiliaria_id is not null
  and exists (
    select 1
    from public.tenant_members tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = imobiliaria_id
  )
);
