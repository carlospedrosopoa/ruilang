
-- Create imobiliarias table
CREATE TABLE public.imobiliarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  creci TEXT NOT NULL,
  responsavel TEXT,
  telefone TEXT,
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  cep TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.imobiliarias ENABLE ROW LEVEL SECURITY;

-- Public read/insert/update policies (no auth for now)
CREATE POLICY "Public read imobiliarias" ON public.imobiliarias FOR SELECT TO public USING (true);
CREATE POLICY "Public insert imobiliarias" ON public.imobiliarias FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public update imobiliarias" ON public.imobiliarias FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public delete imobiliarias" ON public.imobiliarias FOR DELETE TO public USING (true);

-- Add imobiliaria_id to submissions
ALTER TABLE public.submissions ADD COLUMN imobiliaria_id UUID REFERENCES public.imobiliarias(id);
