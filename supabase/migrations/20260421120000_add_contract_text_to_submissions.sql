alter table public.submissions
add column if not exists contract_texto text,
add column if not exists contract_texto_updated_at timestamptz,
add column if not exists contract_texto_updated_by uuid;

create index if not exists submissions_contract_texto_updated_at_idx on public.submissions (contract_texto_updated_at);

