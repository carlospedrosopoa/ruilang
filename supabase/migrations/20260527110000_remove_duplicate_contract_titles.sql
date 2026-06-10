-- Remove titulo duplicado no topo dos modelos base, preservando o titulo preferido.
-- Ex.: "CONTRATO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE IMÓVEL"
-- seguido de "INSTRUMENTO PARTICULAR DE COMPROMISSO DE VENDA E COMPRA DE IMÓVEL"

update public.contract_templates
set template_text = regexp_replace(
  template_text,
  '(?is)^\s*CONTRATO\s+PARTICULAR\s+DE\s+PROMESSA\s+DE\s+COMPRA\s+E\s+VENDA\s+DE\s+IM[ÓO]VEL\s*\r?\n+\s*(INSTRUMENTO\s+PARTICULAR\s+DE\s+COMPROMISSO\s+DE\s+VENDA\s+E\s+COMPRA\s+DE\s+IM[ÓO]VEL)',
  E'\\1'
)
where template_text ~* '^\s*CONTRATO\s+PARTICULAR\s+DE\s+PROMESSA\s+DE\s+COMPRA\s+E\s+VENDA\s+DE\s+IM[ÓO]VEL\s*\r?\n+\s*INSTRUMENTO\s+PARTICULAR\s+DE\s+COMPROMISSO\s+DE\s+VENDA\s+E\s+COMPRA\s+DE\s+IM[ÓO]VEL';

update public.tipos_contrato
set modelo_base = regexp_replace(
  modelo_base,
  '(?is)^\s*CONTRATO\s+PARTICULAR\s+DE\s+PROMESSA\s+DE\s+COMPRA\s+E\s+VENDA\s+DE\s+IM[ÓO]VEL\s*\r?\n+\s*(INSTRUMENTO\s+PARTICULAR\s+DE\s+COMPROMISSO\s+DE\s+VENDA\s+E\s+COMPRA\s+DE\s+IM[ÓO]VEL)',
  E'\\1'
)
where modelo_base ~* '^\s*CONTRATO\s+PARTICULAR\s+DE\s+PROMESSA\s+DE\s+COMPRA\s+E\s+VENDA\s+DE\s+IM[ÓO]VEL\s*\r?\n+\s*INSTRUMENTO\s+PARTICULAR\s+DE\s+COMPROMISSO\s+DE\s+VENDA\s+E\s+COMPRA\s+DE\s+IM[ÓO]VEL';
