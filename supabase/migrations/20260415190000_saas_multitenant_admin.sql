create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists "Platform admins read own row" on public.platform_admins;
create policy "Platform admins read own row"
on public.platform_admins
for select
to authenticated
using (user_id = auth.uid());

create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.imobiliarias (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

alter table public.tenant_members enable row level security;

drop policy if exists "Tenant members read own memberships" on public.tenant_members;
create policy "Tenant members read own memberships"
on public.tenant_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Platform admins manage memberships" on public.tenant_members;
create policy "Platform admins manage memberships"
on public.tenant_members
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

alter table public.submissions
add column if not exists imobiliaria_id uuid references public.imobiliarias (id);

alter table public.propostas
add column if not exists imobiliaria_id uuid references public.imobiliarias (id);

create index if not exists submissions_imobiliaria_id_idx on public.submissions (imobiliaria_id);
create index if not exists propostas_imobiliaria_id_idx on public.propostas (imobiliaria_id);
create index if not exists tenant_members_user_id_idx on public.tenant_members (user_id);
create index if not exists tenant_members_tenant_id_idx on public.tenant_members (tenant_id);

drop policy if exists "Public read imobiliarias" on public.imobiliarias;
drop policy if exists "Public insert imobiliarias" on public.imobiliarias;
drop policy if exists "Public update imobiliarias" on public.imobiliarias;
drop policy if exists "Public delete imobiliarias" on public.imobiliarias;

drop policy if exists "Platform admins manage imobiliarias" on public.imobiliarias;
create policy "Platform admins manage imobiliarias"
on public.imobiliarias
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members read own imobiliaria" on public.imobiliarias;
create policy "Tenant members read own imobiliaria"
on public.imobiliarias
for select
to authenticated
using (exists (
  select 1 from public.tenant_members tm
  where tm.tenant_id = public.imobiliarias.id
    and tm.user_id = auth.uid()
));

drop policy if exists "Public access by token" on public.submissions;

drop policy if exists "Platform admins manage submissions" on public.submissions;
create policy "Platform admins manage submissions"
on public.submissions
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members access submissions" on public.submissions;
create policy "Tenant members access submissions"
on public.submissions
for all
to authenticated
using (exists (
  select 1 from public.tenant_members tm
  where tm.tenant_id = public.submissions.imobiliaria_id
    and tm.user_id = auth.uid()
))
with check (exists (
  select 1 from public.tenant_members tm
  where tm.tenant_id = public.submissions.imobiliaria_id
    and tm.user_id = auth.uid()
));

drop policy if exists "Public select propostas" on public.propostas;
drop policy if exists "Public insert propostas" on public.propostas;
drop policy if exists "Public update propostas" on public.propostas;
drop policy if exists "Public delete propostas" on public.propostas;

drop policy if exists "Platform admins manage propostas" on public.propostas;
create policy "Platform admins manage propostas"
on public.propostas
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members access propostas" on public.propostas;
create policy "Tenant members access propostas"
on public.propostas
for all
to authenticated
using (exists (
  select 1 from public.tenant_members tm
  where tm.tenant_id = public.propostas.imobiliaria_id
    and tm.user_id = auth.uid()
))
with check (exists (
  select 1 from public.tenant_members tm
  where tm.tenant_id = public.propostas.imobiliaria_id
    and tm.user_id = auth.uid()
));

