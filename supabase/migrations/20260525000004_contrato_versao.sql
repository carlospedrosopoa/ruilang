-- Create enum for version type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contrato_versao_tipo') THEN
        CREATE TYPE contrato_versao_tipo AS ENUM ('ia_inicial', 'ia_refinamento', 'edicao_manual');
    END IF;
END
$$;

-- Create table for contract versions
CREATE TABLE IF NOT EXISTS public.contrato_versao (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    versao_numero INT NOT NULL,
    conteudo TEXT NOT NULL,
    tipo public.contrato_versao_tipo NOT NULL,
    autor UUID REFERENCES auth.users(id),
    prompt_refinamento TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, versao_numero)
);

CREATE INDEX IF NOT EXISTS idx_contrato_versao_submission ON public.contrato_versao(submission_id);
CREATE INDEX IF NOT EXISTS idx_contrato_versao_tipo ON public.contrato_versao(tipo);
CREATE INDEX IF NOT EXISTS idx_contrato_versao_created ON public.contrato_versao(created_at DESC);

-- Enable RLS
ALTER TABLE public.contrato_versao ENABLE ROW LEVEL SECURITY;

-- RLS Policies (copying pattern from submissions)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contrato_versao' AND policyname = 'Users can view contrato_versao of their submissions') THEN
        EXECUTE $$
            CREATE POLICY "Users can view contrato_versao of their submissions
            ON public.contrato_versao
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.submissions s
                    JOIN public.imobiliarias i ON s.imobiliaria_id = i.id
                    WHERE s.id = contrato_versao.submission_id
                    AND (
                        (i.tenant_id IN (
                            SELECT tm.tenant_id
                            FROM public.tenant_members tm
                            WHERE tm.user_id = auth.uid()
                        )
                    )
                )
            )
        $$;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contrato_versao' AND policyname = 'Users can insert contrato_versao for their submissions') THEN
        EXECUTE $$
            CREATE POLICY "Users can insert contrato_versao for their submissions
            ON public.contrato_versao
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.submissions s
                    JOIN public.imobiliarias i ON s.imobiliaria_id = i.id
                    WHERE s.id = contrato_versao.submission_id
                    AND (
                        (i.tenant_id IN (
                            SELECT tm.tenant_id
                            FROM public.tenant_members tm
                            WHERE tm.user_id = auth.uid()
                        )
                    )
                )
            )
        $$;
    END IF;
END
$$;
