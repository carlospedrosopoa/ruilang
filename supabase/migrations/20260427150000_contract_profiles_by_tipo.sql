alter table public.tipos_contrato
  add column if not exists codigo text;

update public.tipos_contrato
set codigo = id::text
where codigo is null or btrim(codigo) = '';

alter table public.tipos_contrato
  alter column codigo set not null;

create unique index if not exists tipos_contrato_imobiliaria_codigo_uq
  on public.tipos_contrato (imobiliaria_id, codigo);

create or replace function public.trg_tipos_contrato_set_codigo()
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

drop trigger if exists trg_tipos_contrato_set_codigo on public.tipos_contrato;
create trigger trg_tipos_contrato_set_codigo
before insert on public.tipos_contrato
for each row
execute function public.trg_tipos_contrato_set_codigo();

alter table public.perfis_contrato
  add column if not exists tipo_contrato_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'perfis_contrato_tipo_contrato_id_fkey'
      and c.conrelid = 'public.perfis_contrato'::regclass
  ) then
    execute 'alter table public.perfis_contrato add constraint perfis_contrato_tipo_contrato_id_fkey foreign key (tipo_contrato_id) references public.tipos_contrato (id) on delete cascade';
  end if;
end;
$$;

do $$
declare
  rec record;
  tipo_id uuid;
begin
  for rec in
    select distinct imobiliaria_id
    from public.perfis_contrato
    where tipo_contrato_id is null
  loop
    select id into tipo_id
    from public.tipos_contrato
    where imobiliaria_id = rec.imobiliaria_id
    order by created_at asc
    limit 1;

    if tipo_id is null then
      insert into public.tipos_contrato (imobiliaria_id, codigo, nome, descricao, icone, label_vendedor, label_comprador, modelo_base, ativo)
      values (rec.imobiliaria_id, 'promessa_compra_venda', 'Promessa de Compra e Venda', 'Contrato de compromisso de compra e venda de imóvel sem permuta.', 'FileText', 'Vendedor', 'Comprador', null, true)
      on conflict (imobiliaria_id, codigo) do update
      set
        nome = excluded.nome,
        descricao = excluded.descricao,
        icone = excluded.icone,
        label_vendedor = excluded.label_vendedor,
        label_comprador = excluded.label_comprador,
        ativo = excluded.ativo,
        updated_at = now()
      returning id into tipo_id;
    end if;

    update public.perfis_contrato
    set tipo_contrato_id = tipo_id,
        updated_at = now()
    where imobiliaria_id = rec.imobiliaria_id
      and tipo_contrato_id is null;
  end loop;
end;
$$;

alter table public.perfis_contrato
  alter column tipo_contrato_id set not null;

create index if not exists perfis_contrato_tipo_idx
  on public.perfis_contrato (imobiliaria_id, tipo_contrato_id, ativo);

create unique index if not exists perfis_contrato_unique_nome_por_tipo
  on public.perfis_contrato (imobiliaria_id, tipo_contrato_id, nome);

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

    insert into public.perfis_contrato (imobiliaria_id, tipo_contrato_id, nome, descricao, icone, instructions_ia, ativo, created_by, created_at, updated_at)
    select
      target_imobiliaria_id,
      tt.id,
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
    on conflict (imobiliaria_id, tipo_contrato_id, nome) do update
    set
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

  insert into public.perfis_contrato (imobiliaria_id, tipo_contrato_id, nome, descricao, icone, instructions_ia, ativo, created_by, created_at, updated_at)
  select
    target_imobiliaria_id,
    t.id,
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
      ('Blindagem Vendedor', 'Máxima proteção ao vendedor: arras não devolvidas em rescisão, proibição de benfeitorias até quitação, cobrança de aluguel em caso de rescisão, sem devolução de valores pagos.', 'ShieldCheck'),
      ('Blindagem Comprador', 'Máxima proteção ao comprador: multa ao vendedor por impossibilidade de escritura, garantia de evicção integral, posse definitiva imediata, devolução com correção em rescisão pelo vendedor.', 'ShieldAlert'),
      ('Equilibrado', 'Contrato balanceado com cláusulas justas para ambas as partes, seguindo boas práticas do mercado imobiliário.', 'Scale')
  ) as p(nome, descricao, icone)
  where t.imobiliaria_id = target_imobiliaria_id
    and t.codigo in ('promessa_compra_venda','promessa_compra_venda_permuta','cessao_direitos','locacao')
  on conflict (imobiliaria_id, tipo_contrato_id, nome) do nothing;
end;
$$;
