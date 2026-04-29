create or replace function public.seed_imobiliaria_from_defaults_internal(target_imobiliaria_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  source_id uuid;
  perfis_count integer;
begin
  select ps.defaults_imobiliaria_id into source_id
  from public.platform_settings ps
  where ps.id = true;

  if source_id is not null then
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
  end if;

  insert into public.tipos_contrato (imobiliaria_id, nome, descricao, icone, label_vendedor, label_comprador, modelo_base, ativo, created_by, created_at, updated_at)
  select
    target_imobiliaria_id,
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
      ('Promessa de Compra e Venda', 'Contrato de compromisso de compra e venda de imóvel sem permuta.', 'FileText', 'Vendedor', 'Comprador'),
      ('Promessa de Compra e Venda com Permuta', 'Contrato com permuta parcial ou total de imóvel como parte do pagamento.', 'ArrowLeftRight', 'Vendedor', 'Comprador'),
      ('Cessão de Direitos Possessórios', 'Transferência de direitos de posse sobre imóvel não escriturado.', 'ScrollText', 'Vendedor', 'Comprador'),
      ('Contrato de Locação', 'Locação residencial ou comercial conforme Lei 8.245/91.', 'Home', 'Vendedor', 'Comprador')
  ) as v(nome, descricao, icone, label_vendedor, label_comprador)
  where not exists (
    select 1
    from public.tipos_contrato t2
    where t2.imobiliaria_id = target_imobiliaria_id
      and t2.nome = v.nome
  );

  select count(*) into perfis_count
  from public.perfis_contrato
  where imobiliaria_id = target_imobiliaria_id;

  if coalesce(perfis_count, 0) = 0 then
    insert into public.perfis_contrato (imobiliaria_id, nome, descricao, icone, instructions_ia, ativo, created_by, created_at, updated_at)
    values
      (target_imobiliaria_id, 'Blindagem Vendedor', 'Máxima proteção ao vendedor: arras não devolvidas em rescisão, proibição de benfeitorias até quitação, cobrança de aluguel em caso de rescisão, sem devolução de valores pagos.', 'ShieldCheck', null, true, null, now(), now()),
      (target_imobiliaria_id, 'Blindagem Comprador', 'Máxima proteção ao comprador: multa ao vendedor por impossibilidade de escritura, garantia de evicção integral, posse definitiva imediata, devolução com correção em rescisão pelo vendedor.', 'ShieldAlert', null, true, null, now(), now()),
      (target_imobiliaria_id, 'Equilibrado', 'Contrato balanceado com cláusulas justas para ambas as partes, seguindo boas práticas do mercado imobiliário.', 'Scale', null, true, null, now(), now());
  end if;
end;
$$;
