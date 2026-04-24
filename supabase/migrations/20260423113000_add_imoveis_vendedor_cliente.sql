alter table public.imoveis
add column if not exists vendedor_cliente_id uuid references public.clientes (id) on delete set null;

create index if not exists imoveis_vendedor_cliente_id_idx on public.imoveis (vendedor_cliente_id);
