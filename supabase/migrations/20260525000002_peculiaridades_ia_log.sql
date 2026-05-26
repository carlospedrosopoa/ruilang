-- Create table for IA decisions on peculiarities
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modo_insercao') THEN
        CREATE TYPE modo_insercao AS ENUM ('nova', 'paragrafo', 'substituicao');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'posicao_insercao') THEN
        CREATE TYPE posicao_insercao AS ENUM ('antes', 'depois', 'inicio', 'fim');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.peculiaridades_ia_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    peculiaridade_index INT NOT NULL,
    texto_original TEXT NOT NULL,
    texto_normalizado TEXT,
    modo public.modo_insercao NOT NULL,
    ancora_alvo TEXT,
    posicao public.posicao_insercao,
    justificativa TEXT,
    conflito BOOLEAN DEFAULT FALSE,
    clausula_id TEXT,
    texto_atual TEXT,
    texto_proposto TEXT,
    razao_conflito TEXT,
    aprovado BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_peculiaridades_ia_log_submission ON public.peculiaridades_ia_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_peculiaridades_ia_log_modo ON public.peculiaridades_ia_log(modo);

-- Enable RLS
ALTER TABLE public.peculiaridades_ia_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (copying pattern from submissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'peculiaridades_ia_log' AND policyname = 'Users can view peculiaridades log of their submissions') THEN
        EXECUTE $$
            CREATE POLICY "Users can view peculiaridades log of their submissions
            ON public.peculiaridades_ia_log
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.submissions s
                    JOIN public.imobiliarias i ON s.imobiliaria_id = i.id
                    WHERE s.id = peculiaridades_ia_log.submission_id
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
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'peculiaridades_ia_log' AND policyname = 'Users can insert peculiaridades log for their submissions') THEN
        EXECUTE $$
            CREATE POLICY "Users can insert peculiaridades log for their submissions
            ON public.peculiaridades_ia_log
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.submissions s
                    JOIN public.imobiliarias i ON s.imobiliaria_id = i.id
                    WHERE s.id = peculiaridades_ia_log.submission_id
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
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'peculiaridades_ia_log' AND policyname = 'Users can update peculiaridades log of their submissions') THEN
        EXECUTE $$
            CREATE POLICY "Users can update peculiaridades log of their submissions
            ON public.peculiaridades_ia_log
            FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.submissions s
                    JOIN public.imobiliarias i ON s.imobiliaria_id = i.id
                    WHERE s.id = peculiaridades_ia_log.submission_id
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
