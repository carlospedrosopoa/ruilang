do $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
begin
  -- 1) Garante que a imobiliaria "Teste Imóveis" exista
  select i.id
    into v_tenant_id
  from public.imobiliarias i
  where i.nome = 'Teste Imóveis'
  limit 1;

  if v_tenant_id is null then
    insert into public.imobiliarias (
      nome,
      creci,
      cidade,
      estado,
      responsavel,
      email
    )
    values (
      'Teste Imóveis',
      'PENDENTE',
      'Porto Alegre',
      'RS',
      'Administrador',
      'carlospedrosopoa@gmail.com'
    )
    returning id into v_tenant_id;
  end if;

  -- 2) Busca o usuário no Auth pelo e-mail informado
  select u.id
    into v_user_id
  from auth.users u
  where lower(u.email) = 'carlospedrosopoa@gmail.com'
  limit 1;

  -- 3) Se usuário existir, promove a platform admin e vincula como owner da imobiliária
  if v_user_id is not null then
    insert into public.platform_admins (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    insert into public.tenant_members (tenant_id, user_id, role)
    values (v_tenant_id, v_user_id, 'owner')
    on conflict (tenant_id, user_id) do update
      set role = excluded.role;
  else
    raise notice 'Usuário carlospedrosopoa@gmail.com não encontrado em auth.users. Crie o usuário no Auth e reaplique esta migration.';
  end if;
end $$;

