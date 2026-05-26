-- Função para normalizar o regime de bens
CREATE OR REPLACE FUNCTION normalize_regime_bens(value TEXT)
RETURNS TEXT AS $$
DECLARE
  clean_value TEXT;
BEGIN
  IF value IS NULL OR value = '' THEN
    RETURN NULL;
  END IF;
  
  clean_value := LOWER(TRANSLATE(value, 'áéíóúâêîôûàèìòùãõ', 'aeiouaeiouaeiouao'));
  clean_value := REGEXP_REPLACE(clean_value, '[^a-z0-9\s]', ' ', 'g');
  clean_value := REGEXP_REPLACE(clean_value, '\s+', ' ', 'g');
  clean_value := TRIM(clean_value);
  
  IF clean_value LIKE '%parcial%' OR clean_value LIKE '%comunhao parcial%' THEN
    RETURN 'comunhao_parcial';
  ELSIF clean_value LIKE '%universal%' OR clean_value LIKE '%comunhao universal%' THEN
    RETURN 'comunhao_universal';
  ELSIF clean_value LIKE '%separacao total%' OR clean_value LIKE '%separar total%' THEN
    RETURN 'separacao_total';
  ELSIF clean_value LIKE '%obrigatoria%' OR clean_value LIKE '%separacao obrigatoria%' OR clean_value LIKE '%legal%' THEN
    RETURN 'separacao_obrigatoria';
  ELSIF clean_value LIKE '%participacao%' OR clean_value LIKE '%aquestos%' THEN
    RETURN 'participacao_final_aquestos';
  ELSIF clean_value LIKE '%uniao estavel sem pacto%' OR (clean_value LIKE '%uniao estavel%' AND clean_value LIKE '%sem pacto%') THEN
    RETURN 'uniao_estavel_sem_pacto';
  ELSIF clean_value LIKE '%uniao estavel com pacto%' OR (clean_value LIKE '%uniao estavel%' AND clean_value LIKE '%com pacto%') THEN
    RETURN 'uniao_estavel_com_pacto';
  ELSE
    RAISE NOTICE 'Valor não identificado: %', value;
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Log de valores que não foram convertidos
CREATE TABLE IF NOT EXISTS regime_bens_conversion_log (
  id SERIAL PRIMARY KEY,
  submission_id UUID NOT NULL,
  pessoa_index INTEGER NOT NULL,
  pessoa_type TEXT NOT NULL, -- 'vendedor' or 'comprador'
  old_value TEXT,
  converted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Atualizar vendedores
UPDATE submissions
SET dados = jsonb_set(
  dados,
  '{vendedores}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN (p->>'estadoCivil') IN ('Casado(a)', 'União Estável') AND (p->>'regimeBens') IS NOT NULL
        THEN jsonb_set(
          p,
          '{regimeBens}',
          to_jsonb(normalize_regime_bens(p->>'regimeBens'))
        )
        ELSE p
      END
    )
    FROM jsonb_array_elements(dados->'vendedores') WITH ORDINALITY AS arr(p, idx)
  )
)
WHERE dados->'vendedores' IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(dados->'vendedores') p
    WHERE (p->>'estadoCivil') IN ('Casado(a)', 'União Estável')
      AND (p->>'regimeBens') IS NOT NULL
  );

-- Atualizar compradores
UPDATE submissions
SET dados = jsonb_set(
  dados,
  '{compradores}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN (p->>'estadoCivil') IN ('Casado(a)', 'União Estável') AND (p->>'regimeBens') IS NOT NULL
        THEN jsonb_set(
          p,
          '{regimeBens}',
          to_jsonb(normalize_regime_bens(p->>'regimeBens'))
        )
        ELSE p
      END
    )
    FROM jsonb_array_elements(dados->'compradores') WITH ORDINALITY AS arr(p, idx)
  )
)
WHERE dados->'compradores' IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(dados->'compradores') p
    WHERE (p->>'estadoCivil') IN ('Casado(a)', 'União Estável')
      AND (p->>'regimeBens') IS NOT NULL
  );

-- Inserir no log os valores que não foram convertidos
INSERT INTO regime_bens_conversion_log (submission_id, pessoa_index, pessoa_type, old_value)
SELECT
  s.id AS submission_id,
  (arr.idx - 1)::INTEGER AS pessoa_index,
  'vendedor' AS pessoa_type,
  arr.p->>'regimeBens' AS old_value
FROM submissions s,
     jsonb_array_elements(s.dados->'vendedores') WITH ORDINALITY AS arr(p, idx)
WHERE (arr.p->>'estadoCivil') IN ('Casado(a)', 'União Estável')
  AND (arr.p->>'regimeBens') IS NOT NULL
  AND normalize_regime_bens(arr.p->>'regimeBens') IS NULL

UNION ALL

SELECT
  s.id AS submission_id,
  (arr.idx - 1)::INTEGER AS pessoa_index,
  'comprador' AS pessoa_type,
  arr.p->>'regimeBens' AS old_value
FROM submissions s,
     jsonb_array_elements(s.dados->'compradores') WITH ORDINALITY AS arr(p, idx)
WHERE (arr.p->>'estadoCivil') IN ('Casado(a)', 'União Estável')
  AND (arr.p->>'regimeBens') IS NOT NULL
  AND normalize_regime_bens(arr.p->>'regimeBens') IS NULL;

-- Verificar o resultado
SELECT
  'Vendedores com regime normalizado' AS status,
  COUNT(*) AS count
FROM submissions s,
     jsonb_array_elements(s.dados->'vendedores') p
WHERE (p->>'estadoCivil') IN ('Casado(a)', 'União Estável')
  AND (p->>'regimeBens') IN (
    'comunhao_parcial',
    'comunhao_universal',
    'separacao_total',
    'separacao_obrigatoria',
    'participacao_final_aquestos',
    'uniao_estavel_sem_pacto',
    'uniao_estavel_com_pacto'
  )

UNION ALL

SELECT
  'Compradores com regime normalizado' AS status,
  COUNT(*) AS count
FROM submissions s,
     jsonb_array_elements(s.dados->'compradores') p
WHERE (p->>'estadoCivil') IN ('Casado(a)', 'União Estável')
  AND (p->>'regimeBens') IN (
    'comunhao_parcial',
    'comunhao_universal',
    'separacao_total',
    'separacao_obrigatoria',
    'participacao_final_aquestos',
    'uniao_estavel_sem_pacto',
    'uniao_estavel_com_pacto'
  )

UNION ALL

SELECT
  'Valores não identificados (log)' AS status,
  COUNT(*) AS count
FROM regime_bens_conversion_log;
