alter table public.imobiliarias
add column if not exists logo_url text null,
add column if not exists logo_storage_path text null,
add column if not exists rede_social_url text null,
add column if not exists whatsapp_atendimento text null,
add column if not exists site_url text null;

