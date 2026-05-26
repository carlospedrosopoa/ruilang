alter table public.tipos_contrato
  add column if not exists label_parte_a text,
  add column if not exists label_parte_b text,
  add column if not exists label_parte_a_plural text,
  add column if not exists label_parte_b_plural text,
  add column if not exists partes_simetricas boolean not null default false,
  add column if not exists label_objeto text not null default 'Imóvel',
  add column if not exists label_acao text not null default 'compra e venda';

update public.tipos_contrato
set
  label_parte_a = coalesce(nullif(btrim(label_parte_a), ''), nullif(btrim(label_vendedor), ''), 'Vendedor'),
  label_parte_b = coalesce(nullif(btrim(label_parte_b), ''), nullif(btrim(label_comprador), ''), 'Comprador'),
  label_objeto = coalesce(nullif(btrim(label_objeto), ''), 'Imóvel'),
  label_acao = coalesce(nullif(btrim(label_acao), ''), 'compra e venda')
where
  label_parte_a is null or btrim(label_parte_a) = ''
  or label_parte_b is null or btrim(label_parte_b) = ''
  or label_objeto is null or btrim(label_objeto) = ''
  or label_acao is null or btrim(label_acao) = '';

update public.tipos_contrato
set
  label_parte_a = 'Vendedor',
  label_parte_b = 'Comprador',
  label_parte_a_plural = 'Vendedores',
  label_parte_b_plural = 'Compradores',
  partes_simetricas = false,
  label_objeto = 'Imóvel',
  label_acao = 'compra e venda'
where codigo in ('promessa_compra_venda', 'promessa_compra_venda_permuta');

update public.tipos_contrato
set
  label_parte_a = 'Locador',
  label_parte_b = 'Locatário',
  label_parte_a_plural = 'Locadores',
  label_parte_b_plural = 'Locatários',
  partes_simetricas = false,
  label_objeto = 'Imóvel',
  label_acao = 'locação'
where codigo in ('locacao');

update public.tipos_contrato
set
  label_parte_a = 'Cedente',
  label_parte_b = 'Cessionário',
  label_parte_a_plural = 'Cedentes',
  label_parte_b_plural = 'Cessionários',
  partes_simetricas = false,
  label_objeto = 'Imóvel',
  label_acao = 'cessão de direitos possessórios'
where codigo in ('cessao_direitos', 'cessao_direitos_possessorios');

update public.tipos_contrato
set
  label_parte_a = 'Cedente',
  label_parte_b = 'Cessionário',
  label_parte_a_plural = 'Cedentes',
  label_parte_b_plural = 'Cessionários',
  partes_simetricas = false,
  label_objeto = 'Imóvel',
  label_acao = 'cessão de direitos contratuais'
where codigo in ('cessao_direitos_contratuais');

update public.tipos_contrato
set
  label_parte_a_plural = case
    when label_parte_a_plural is null or btrim(label_parte_a_plural) = '' then
      case when right(label_parte_a, 1) = 'r' then label_parte_a || 'es' else label_parte_a || 's' end
    else label_parte_a_plural
  end,
  label_parte_b_plural = case
    when label_parte_b_plural is null or btrim(label_parte_b_plural) = '' then
      case when right(label_parte_b, 1) = 'r' then label_parte_b || 'es' else label_parte_b || 's' end
    else label_parte_b_plural
  end;

update public.tipos_contrato
set
  label_vendedor = coalesce(nullif(btrim(label_vendedor), ''), label_parte_a),
  label_comprador = coalesce(nullif(btrim(label_comprador), ''), label_parte_b)
where
  label_vendedor is null or btrim(label_vendedor) = ''
  or label_comprador is null or btrim(label_comprador) = '';

alter table public.tipos_contrato
  alter column label_parte_a set default 'Vendedor',
  alter column label_parte_b set default 'Comprador';

update public.tipos_contrato
set
  label_parte_a = coalesce(nullif(btrim(label_parte_a), ''), 'Vendedor'),
  label_parte_b = coalesce(nullif(btrim(label_parte_b), ''), 'Comprador')
where
  label_parte_a is null or btrim(label_parte_a) = ''
  or label_parte_b is null or btrim(label_parte_b) = '';

alter table public.tipos_contrato
  alter column label_parte_a set not null,
  alter column label_parte_b set not null;

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
    insert into public.tipos_contrato (
      imobiliaria_id,
      codigo,
      nome,
      descricao,
      icone,
      label_vendedor,
      label_comprador,
      label_parte_a,
      label_parte_b,
      label_parte_a_plural,
      label_parte_b_plural,
      partes_simetricas,
      label_objeto,
      label_acao,
      modelo_base,
      ativo,
      created_by,
      created_at,
      updated_at
    )
    select
      target_imobiliaria_id,
      t.codigo,
      t.nome,
      t.descricao,
      t.icone,
      t.label_vendedor,
      t.label_comprador,
      t.label_parte_a,
      t.label_parte_b,
      t.label_parte_a_plural,
      t.label_parte_b_plural,
      t.partes_simetricas,
      t.label_objeto,
      t.label_acao,
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
      label_parte_a = excluded.label_parte_a,
      label_parte_b = excluded.label_parte_b,
      label_parte_a_plural = excluded.label_parte_a_plural,
      label_parte_b_plural = excluded.label_parte_b_plural,
      partes_simetricas = excluded.partes_simetricas,
      label_objeto = excluded.label_objeto,
      label_acao = excluded.label_acao,
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
end;
$$;

