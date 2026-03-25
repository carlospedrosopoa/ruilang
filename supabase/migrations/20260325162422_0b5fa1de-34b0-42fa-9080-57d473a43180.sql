
-- Create propostas table
CREATE TABLE public.propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  corretor_nome text,
  corretor_creci text,
  corretor_telefone text,
  imobiliaria_nome text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  documentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'rascunho',
  proposta_texto text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(token)
);

-- Enable RLS
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

-- Public access policies (link-based access like submissions)
CREATE POLICY "Public select propostas" ON public.propostas FOR SELECT TO public USING (true);
CREATE POLICY "Public insert propostas" ON public.propostas FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public update propostas" ON public.propostas FOR UPDATE TO public 
  USING (status = 'rascunho') WITH CHECK (status IN ('rascunho', 'enviado'));
CREATE POLICY "Public delete propostas" ON public.propostas FOR DELETE TO public USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_propostas_updated_at
  BEFORE UPDATE ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_submissions_updated_at();

-- Storage bucket for proposal documents
INSERT INTO storage.buckets (id, name, public) VALUES ('proposta-docs', 'proposta-docs', true);

-- Storage policies
CREATE POLICY "Public upload proposta docs" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'proposta-docs');
CREATE POLICY "Public read proposta docs" ON storage.objects FOR SELECT TO public USING (bucket_id = 'proposta-docs');
CREATE POLICY "Public delete proposta docs" ON storage.objects FOR DELETE TO public USING (bucket_id = 'proposta-docs');
