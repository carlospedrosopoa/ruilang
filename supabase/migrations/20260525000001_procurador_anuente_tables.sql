-- Create enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'parte_tipo') THEN
    CREATE TYPE parte_tipo AS ENUM ('vendedor', 'comprador');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_procuracao') THEN
    CREATE TYPE tipo_procuracao AS ENUM ('publica', 'particular_com_firma', 'particular_sem_firma');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qualificacao_no_negocio') THEN
    CREATE TYPE qualificacao_no_negocio AS ENUM ('conjuge_meeiro', 'ex_conjuge', 'herdeiro', 'condomino', 'fiador', 'interveniente_garantidor', 'outro');
  END IF;
END
$$;

-- Create procurador table
CREATE TABLE IF NOT EXISTS public.procurador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions (id) ON DELETE CASCADE,
  parte_tipo parte_tipo NOT NULL,
  parte_indice INTEGER NOT NULL,
  
  nome_completo TEXT NOT NULL,
  nacionalidade TEXT,
  profissao TEXT,
  estado_civil TEXT,
  regime_bens TEXT,
  
  tipo_documento TEXT,
  numero_documento TEXT,
  orgao_expedidor TEXT,
  cpf TEXT,
  cnpj TEXT,
  
  filiacao_pai TEXT,
  filiacao_mae TEXT,
  
  endereco_completo TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  email TEXT,
  telefone TEXT,
  
  tipo_procuracao tipo_procuracao,
  data_procuracao DATE,
  cartorio_livro_folha TEXT,
  poderes_outorgados TEXT,
  anexo_procuracao_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for procurador
CREATE INDEX IF NOT EXISTS procurador_submission_id_idx ON public.procurador (submission_id);
CREATE INDEX IF NOT EXISTS procurador_parte_tipo_idx ON public.procurador (parte_tipo);
CREATE INDEX IF NOT EXISTS procurador_cpf_idx ON public.procurador (cpf);
CREATE INDEX IF NOT EXISTS procurador_cnpj_idx ON public.procurador (cnpj);

-- Create anuente table
CREATE TABLE IF NOT EXISTS public.anuente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions (id) ON DELETE CASCADE,
  
  nome_completo TEXT NOT NULL,
  nacionalidade TEXT,
  profissao TEXT,
  estado_civil TEXT,
  regime_bens TEXT,
  
  tipo_documento TEXT,
  numero_documento TEXT,
  orgao_expedidor TEXT,
  cpf TEXT,
  cnpj TEXT,
  
  filiacao_pai TEXT,
  filiacao_mae TEXT,
  
  endereco_completo TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  email TEXT,
  telefone TEXT,
  
  qualificacao_no_negocio qualificacao_no_negocio NOT NULL DEFAULT 'outro',
  qualificacao_outro TEXT,
  motivo_anuencia TEXT,
  assina_contrato BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for anuente
CREATE INDEX IF NOT EXISTS anuente_submission_id_idx ON public.anuente (submission_id);
CREATE INDEX IF NOT EXISTS anuente_qualificacao_idx ON public.anuente (qualificacao_no_negocio);
CREATE INDEX IF NOT EXISTS anuente_cpf_idx ON public.anuente (cpf);
CREATE INDEX IF NOT EXISTS anuente_cnpj_idx ON public.anuente (cnpj);

-- Enable RLS
ALTER TABLE public.procurador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anuente ENABLE ROW LEVEL SECURITY;

-- RLS policies for procurador
DROP POLICY IF EXISTS "Platform admins manage procuradores" ON public.procurador;
CREATE POLICY "Platform admins manage procuradores"
ON public.procurador
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant members access procuradores" ON public.procurador;
CREATE POLICY "Tenant members access procuradores"
ON public.procurador
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_members tm
  JOIN public.submissions s ON tm.tenant_id = s.imobiliaria_id
  WHERE s.id = public.procurador.submission_id
    AND tm.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tenant_members tm
  JOIN public.submissions s ON tm.tenant_id = s.imobiliaria_id
  WHERE s.id = public.procurador.submission_id
    AND tm.user_id = auth.uid()
));

-- RLS policies for anuente
DROP POLICY IF EXISTS "Platform admins manage anuentes" ON public.anuente;
CREATE POLICY "Platform admins manage anuentes"
ON public.anuente
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant members access anuentes" ON public.anuente;
CREATE POLICY "Tenant members access anuentes"
ON public.anuente
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_members tm
  JOIN public.submissions s ON tm.tenant_id = s.imobiliaria_id
  WHERE s.id = public.anuente.submission_id
    AND tm.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tenant_members tm
  JOIN public.submissions s ON tm.tenant_id = s.imobiliaria_id
  WHERE s.id = public.anuente.submission_id
    AND tm.user_id = auth.uid()
));

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_procurador_updated_at ON public.procurador;
CREATE TRIGGER set_procurador_updated_at
  BEFORE UPDATE ON public.procurador
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_anuente_updated_at ON public.anuente;
CREATE TRIGGER set_anuente_updated_at
  BEFORE UPDATE ON public.anuente
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
