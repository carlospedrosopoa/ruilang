create table if not exists public.platform_settings (
  id boolean primary key default true,
  defaults_imobiliaria_id uuid null references public.imobiliarias (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id = true)
);

alter table public.platform_settings enable row level security;

drop policy if exists "Platform admins manage platform_settings" on public.platform_settings;
create policy "Platform admins manage platform_settings"
on public.platform_settings
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

insert into public.platform_settings (id)
values (true)
on conflict (id) do nothing;

update public.platform_settings
set defaults_imobiliaria_id = (
  select i.id
  from public.imobiliarias i
  order by i.created_at asc
  limit 1
)
where id = true and defaults_imobiliaria_id is null;

create or replace function public.seed_imobiliaria_from_defaults_internal(target_imobiliaria_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  source_id uuid;
begin
  select ps.defaults_imobiliaria_id into source_id
  from public.platform_settings ps
  where ps.id = true;

  if source_id is null then
    return;
  end if;

  insert into public.tipos_contrato (imobiliaria_id, nome, descricao, icone, label_vendedor, label_comprador, modelo_base, ativo, created_by, created_at, updated_at)
  select
    target_imobiliaria_id,
    t.nome,
    t.descricao,
    t.icone,
    t.label_vendedor,
    t.label_comprador,
    t.modelo_base,
    t.ativo,
    null,
    now(),
    now()
  from public.tipos_contrato t
  where t.imobiliaria_id = source_id
    and not exists (
      select 1
      from public.tipos_contrato t2
      where t2.imobiliaria_id = target_imobiliaria_id
        and t2.nome = t.nome
    );

  insert into public.perfis_contrato (imobiliaria_id, nome, descricao, icone, instructions_ia, ativo, created_by, created_at, updated_at)
  select
    target_imobiliaria_id,
    p.nome,
    p.descricao,
    p.icone,
    p.instructions_ia,
    p.ativo,
    null,
    now(),
    now()
  from public.perfis_contrato p
  where p.imobiliaria_id = source_id
    and not exists (
      select 1
      from public.perfis_contrato p2
      where p2.imobiliaria_id = target_imobiliaria_id
        and p2.nome = p.nome
    );

  insert into public.tipos_proposta (imobiliaria_id, codigo, nome, descricao, modelo_base, ativo, created_at, updated_at)
  select
    target_imobiliaria_id,
    tp.codigo,
    tp.nome,
    tp.descricao,
    tp.modelo_base,
    tp.ativo,
    now(),
    now()
  from public.tipos_proposta tp
  where tp.imobiliaria_id = source_id
  on conflict (imobiliaria_id, codigo) do update
  set
    nome = excluded.nome,
    descricao = excluded.descricao,
    modelo_base = excluded.modelo_base,
    ativo = excluded.ativo,
    updated_at = now();

  insert into public.contract_templates (imobiliaria_id, tipo_contrato, perfil, provider, model, version, active, template_text, instructions_ia, created_at, updated_at)
  select
    target_imobiliaria_id,
    ct.tipo_contrato,
    ct.perfil,
    ct.provider,
    ct.model,
    1,
    ct.active,
    ct.template_text,
    ct.instructions_ia,
    now(),
    now()
  from (
    select distinct on (tipo_contrato, perfil)
      tipo_contrato,
      perfil,
      provider,
      model,
      active,
      template_text,
      instructions_ia
    from public.contract_templates
    where imobiliaria_id = source_id
    order by tipo_contrato, perfil, version desc
  ) ct
  where not exists (
    select 1
    from public.contract_templates ct2
    where ct2.imobiliaria_id = target_imobiliaria_id
      and ct2.tipo_contrato = ct.tipo_contrato
      and ct2.perfil = ct.perfil
      and ct2.active = true
  );
end;
$$;

create or replace function public.seed_imobiliaria_from_defaults(target_imobiliaria_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then
    raise exception 'not_allowed';
  end if;

  perform public.seed_imobiliaria_from_defaults_internal(target_imobiliaria_id);
end;
$$;

grant execute on function public.seed_imobiliaria_from_defaults(uuid) to authenticated;

create or replace function public.trg_seed_defaults_on_imobiliaria_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_imobiliaria_from_defaults_internal(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_defaults_on_imobiliaria_insert on public.imobiliarias;
create trigger trg_seed_defaults_on_imobiliaria_insert
after insert on public.imobiliarias
for each row
execute function public.trg_seed_defaults_on_imobiliaria_insert();
