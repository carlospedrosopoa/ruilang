alter table public.perfis_contrato
  add column if not exists codigo text;

update public.perfis_contrato
set codigo = id::text
where codigo is null or btrim(codigo) = '';

alter table public.perfis_contrato
  alter column codigo set not null;

create unique index if not exists perfis_contrato_unique_codigo_por_tipo
  on public.perfis_contrato (imobiliaria_id, tipo_contrato_id, codigo);

create or replace function public.trg_perfis_contrato_set_codigo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := new.id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_perfis_contrato_set_codigo on public.perfis_contrato;
create trigger trg_perfis_contrato_set_codigo
before insert on public.perfis_contrato
for each row
execute function public.trg_perfis_contrato_set_codigo();

create or replace function public.seed_default_perfis_for_tipo_internal(p_tipo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  imob_id uuid;
begin
  select imobiliaria_id into imob_id
  from public.tipos_contrato
  where id = p_tipo_id;

  if imob_id is null then
    return;
  end if;

  insert into public.perfis_contrato (imobiliaria_id, tipo_contrato_id, codigo, nome, descricao, icone, instructions_ia, ativo, created_by, created_at, updated_at)
  values
    (imob_id, p_tipo_id, 'blindagem_vendedor', 'Blindagem Vendedor', 'Máxima proteção ao vendedor: arras não devolvidas em rescisão, proibição de benfeitorias até quitação, cobrança de aluguel em caso de rescisão, sem devolução de valores pagos.', 'ShieldCheck', null, true, null, now(), now()),
    (imob_id, p_tipo_id, 'blindagem_comprador', 'Blindagem Comprador', 'Máxima proteção ao comprador: multa ao vendedor por impossibilidade de escritura, garantia de evicção integral, posse definitiva imediata, devolução com correção em rescisão pelo vendedor.', 'ShieldAlert', null, true, null, now(), now()),
    (imob_id, p_tipo_id, 'equilibrado', 'Equilibrado', 'Contrato balanceado com cláusulas justas para ambas as partes, seguindo boas práticas do mercado imobiliário.', 'Scale', null, true, null, now(), now())
  on conflict (imobiliaria_id, tipo_contrato_id, codigo) do nothing;
end;
$$;

create or replace function public.trg_tipos_contrato_seed_default_perfis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_perfis_for_tipo_internal(new.id);
  return new;
end;
$$;

drop trigger if exists trg_tipos_contrato_seed_default_perfis on public.tipos_contrato;
create trigger trg_tipos_contrato_seed_default_perfis
after insert on public.tipos_contrato
for each row
execute function public.trg_tipos_contrato_seed_default_perfis();

insert into public.perfis_contrato (imobiliaria_id, tipo_contrato_id, codigo, nome, descricao, icone, instructions_ia, ativo, created_by, created_at, updated_at)
select
  t.imobiliaria_id,
  t.id,
  p.codigo,
  p.nome,
  p.descricao,
  p.icone,
  null,
  true,
  null,
  now(),
  now()
from public.tipos_contrato t
cross join (
  values
    ('blindagem_vendedor', 'Blindagem Vendedor', 'Máxima proteção ao vendedor: arras não devolvidas em rescisão, proibição de benfeitorias até quitação, cobrança de aluguel em caso de rescisão, sem devolução de valores pagos.', 'ShieldCheck'),
    ('blindagem_comprador', 'Blindagem Comprador', 'Máxima proteção ao comprador: multa ao vendedor por impossibilidade de escritura, garantia de evicção integral, posse definitiva imediata, devolução com correção em rescisão pelo vendedor.', 'ShieldAlert'),
    ('equilibrado', 'Equilibrado', 'Contrato balanceado com cláusulas justas para ambas as partes, seguindo boas práticas do mercado imobiliário.', 'Scale')
) as p(codigo, nome, descricao, icone)
where not exists (
  select 1
  from public.perfis_contrato pc
  where pc.imobiliaria_id = t.imobiliaria_id
    and pc.tipo_contrato_id = t.id
    and pc.ativo = true
)
on conflict (imobiliaria_id, tipo_contrato_id, codigo) do nothing;

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

  if source_id is not null then
    insert into public.tipos_contrato (imobiliaria_id, codigo, nome, descricao, icone, label_vendedor, label_comprador, modelo_base, ativo, created_by, created_at, updated_at)
    select
      target_imobiliaria_id,
      t.codigo,
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
    on conflict (imobiliaria_id, codigo) do update
    set
      nome = excluded.nome,
      descricao = excluded.descricao,
      icone = excluded.icone,
      label_vendedor = excluded.label_vendedor,
      label_comprador = excluded.label_comprador,
      modelo_base = excluded.modelo_base,
      ativo = excluded.ativo,
      updated_at = now();

    insert into public.perfis_contrato (imobiliaria_id, tipo_contrato_id, codigo, nome, descricao, icone, instructions_ia, ativo, created_by, created_at, updated_at)
    select
      target_imobiliaria_id,
      tt.id,
      p.codigo,
      p.nome,
      p.descricao,
      p.icone,
      p.instructions_ia,
      p.ativo,
      null,
      now(),
      now()
    from public.perfis_contrato p
    join public.tipos_contrato ts on ts.id = p.tipo_contrato_id
    join public.tipos_contrato tt on tt.imobiliaria_id = target_imobiliaria_id and tt.codigo = ts.codigo
    where p.imobiliaria_id = source_id
    on conflict (imobiliaria_id, tipo_contrato_id, codigo) do update
    set
      nome = excluded.nome,
      descricao = excluded.descricao,
      icone = excluded.icone,
      instructions_ia = excluded.instructions_ia,
      ativo = excluded.ativo,
      updated_at = now();

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
  end if;

  insert into public.tipos_contrato (imobiliaria_id, codigo, nome, descricao, icone, label_vendedor, label_comprador, modelo_base, ativo, created_by, created_at, updated_at)
  select
    target_imobiliaria_id,
    v.codigo,
    v.nome,
    v.descricao,
    v.icone,
    v.label_vendedor,
    v.label_comprador,
    null,
    true,
    null,
    now(),
    now()
  from (
    values
      ('promessa_compra_venda', 'Promessa de Compra e Venda', 'Contrato de compromisso de compra e venda de imóvel sem permuta.', 'FileText', 'Vendedor', 'Comprador'),
      ('promessa_compra_venda_permuta', 'Promessa de Compra e Venda com Permuta', 'Contrato com permuta parcial ou total de imóvel como parte do pagamento.', 'ArrowLeftRight', 'Vendedor', 'Comprador'),
      ('cessao_direitos', 'Cessão de Direitos Possessórios', 'Transferência de direitos de posse sobre imóvel não escriturado.', 'ScrollText', 'Cedente', 'Cessionário'),
      ('locacao', 'Contrato de Locação', 'Locação residencial ou comercial conforme Lei 8.245/91.', 'Home', 'Locador', 'Locatário')
  ) as v(codigo, nome, descricao, icone, label_vendedor, label_comprador)
  on conflict (imobiliaria_id, codigo) do update
  set
    nome = excluded.nome,
    descricao = excluded.descricao,
    icone = excluded.icone,
    label_vendedor = excluded.label_vendedor,
    label_comprador = excluded.label_comprador,
    ativo = excluded.ativo,
    updated_at = now();

  perform public.seed_default_perfis_for_tipo_internal(t.id)
  from public.tipos_contrato t
  where t.imobiliaria_id = target_imobiliaria_id;
end;
$$;
