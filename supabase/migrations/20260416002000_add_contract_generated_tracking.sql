alter table public.submissions
add column if not exists contract_generated_at timestamptz,
add column if not exists contract_generated_by uuid;

create index if not exists submissions_contract_generated_at_idx on public.submissions (contract_generated_at);

