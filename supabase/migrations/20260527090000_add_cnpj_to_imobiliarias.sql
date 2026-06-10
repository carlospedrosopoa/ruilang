alter table public.imobiliarias
  add column if not exists cnpj text null;

create index if not exists imobiliarias_cnpj_idx
  on public.imobiliarias (cnpj);
