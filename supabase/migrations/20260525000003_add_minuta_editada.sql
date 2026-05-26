-- Add minuta_editada column to submissions table
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS contract_texto_editado TEXT;

COMMENT ON COLUMN public.submissions.contract_texto_editado IS 'Texto da minuta editado pelo usuário (mantém o original em contract_texto)';
