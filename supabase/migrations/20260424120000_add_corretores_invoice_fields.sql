alter table public.corretores
add column if not exists comissao_percentual numeric(5,2) not null default 6.00,
add column if not exists cpf text null,
add column if not exists endereco text null,
add column if not exists bairro text null,
add column if not exists cidade text null,
add column if not exists estado text null,
add column if not exists cep text null;

create unique index if not exists corretores_imobiliaria_cpf_uidx
on public.corretores (imobiliaria_id, cpf)
where cpf is not null;

