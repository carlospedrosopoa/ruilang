alter table public.imobiliarias enable row level security;

drop policy if exists "Tenant members update own imobiliaria" on public.imobiliarias;
create policy "Tenant members update own imobiliaria"
on public.imobiliarias
for update
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.imobiliarias.id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.imobiliarias.id
      and tm.user_id = auth.uid()
  )
);
