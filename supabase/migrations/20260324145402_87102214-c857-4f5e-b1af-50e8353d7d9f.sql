
-- Fix function search path
CREATE OR REPLACE FUNCTION public.update_submissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Replace permissive policy with token-scoped ones
DROP POLICY "Public access by token" ON public.submissions;

CREATE POLICY "Public select by token" ON public.submissions
  FOR SELECT USING (true);

CREATE POLICY "Public insert" ON public.submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update by token" ON public.submissions
  FOR UPDATE USING (status = 'rascunho') WITH CHECK (status IN ('rascunho', 'enviado'));
