alter table public.clientes
  add column if not exists cnpj text null;

create index if not exists clientes_imobiliaria_cnpj_idx
  on public.clientes (imobiliaria_id, cnpj);
