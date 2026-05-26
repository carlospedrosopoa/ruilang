-- Migração para substituir labels hardcoded por placeholders nos modelos de contrato
-- Data: 2026-05-24

-- Função helper para substituir labels em texto
create or replace function public.replace_contract_labels(text_input text)
returns text as $$
declare
  result text;
begin
  result := text_input;
  
  -- Substituições para PARTE A (Vendedor/Cedente/Locador)
  result := regexp_replace(result, '\bPROMITENTE VENDEDOR\b', '{{PARTE_A_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bVENDEDOR\b', '{{PARTE_A_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bVENDEDORES\b', '{{PARTE_A_PLURAL_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bvendedor\b', '{{parte_a_minuscula}}', 'g');
  result := regexp_replace(result, '\bvendedores\b', '{{parte_a_plural_minuscula}}', 'g');
  
  result := regexp_replace(result, '\bCEDENTE\b', '{{PARTE_A_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bCEDENTES\b', '{{PARTE_A_PLURAL_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bcedente\b', '{{parte_a_minuscula}}', 'g');
  result := regexp_replace(result, '\bcedentes\b', '{{parte_a_plural_minuscula}}', 'g');
  
  result := regexp_replace(result, '\bLOCADOR\b', '{{PARTE_A_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bLOCADORES\b', '{{PARTE_A_PLURAL_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\blocador\b', '{{parte_a_minuscula}}', 'g');
  result := regexp_replace(result, '\blocadores\b', '{{parte_a_plural_minuscula}}', 'g');
  
  -- Substituições para PARTE B (Comprador/Cessionário/Locatário)
  result := regexp_replace(result, '\bPROMITENTE COMPRADOR\b', '{{PARTE_B_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bCOMPRADOR\b', '{{PARTE_B_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bCOMPRADORES\b', '{{PARTE_B_PLURAL_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bcomprador\b', '{{parte_b_minuscula}}', 'g');
  result := regexp_replace(result, '\bcompradores\b', '{{parte_b_plural_minuscula}}', 'g');
  
  result := regexp_replace(result, '\bCESSIONÁRIO\b', '{{PARTE_B_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bCESSIONARIOS\b', '{{PARTE_B_PLURAL_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bcessionário\b', '{{parte_b_minuscula}}', 'g');
  result := regexp_replace(result, '\bcessionarios\b', '{{parte_b_plural_minuscula}}', 'g');
  result := regexp_replace(result, '\bcessionario\b', '{{parte_b_minuscula}}', 'g');
  
  result := regexp_replace(result, '\bLOCATÁRIO\b', '{{PARTE_B_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bLOCATARIOS\b', '{{PARTE_B_PLURAL_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\blocatário\b', '{{parte_b_minuscula}}', 'g');
  result := regexp_replace(result, '\blocatarios\b', '{{parte_b_plural_minuscula}}', 'g');
  result := regexp_replace(result, '\blocatario\b', '{{parte_b_minuscula}}', 'g');
  
  -- Substituições para OBJETO
  result := regexp_replace(result, '\bIMÓVEL\b', '{{OBJETO_MAIUSCULA}}', 'gi');
  result := regexp_replace(result, '\bimóvel\b', '{{objeto_minuscula}}', 'g');
  result := regexp_replace(result, '\bimovel\b', '{{objeto_minuscula}}', 'g');
  
  return result;
end;
$$ language plpgsql immutable;

-- Aplicar substituições nas tabelas que contêm modelos de contrato
update public.contract_templates
set template_text = public.replace_contract_labels(template_text),
    instructions_ia = public.replace_contract_labels(instructions_ia);

update public.tipos_contrato
set modelo_base = public.replace_contract_labels(modelo_base);

update public.perfis_contrato
set instructions_ia = public.replace_contract_labels(instructions_ia);

-- Drop da função helper (opcional, pode manter para uso futuro)
-- drop function public.replace_contract_labels(text);
