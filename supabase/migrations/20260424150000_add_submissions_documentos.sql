alter table public.submissions
add column if not exists documentos jsonb not null default '[]'::jsonb;

