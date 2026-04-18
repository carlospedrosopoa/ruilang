alter table public.submissions
add column if not exists proposta_texto text,
add column if not exists proposta_gerada_em timestamptz;

create index if not exists submissions_proposta_gerada_em_idx on public.submissions (proposta_gerada_em);

