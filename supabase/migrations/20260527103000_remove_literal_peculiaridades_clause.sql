update public.contract_templates
set
  template_text = btrim(
    regexp_replace(
      regexp_replace(
        template_text,
        '(?is)\mCL[ÁA]USULA\s+(D[ÉE]CIMA\s+QUINTA|D[ÉE]CIMA\s+SEXTA)\s*[–-]\s*PECULIARIDADES\s+E\s+CONDI[ÇC][ÕO]ES\s+ESPECIAIS.*?(\n\s*CL[ÁA]USULA\b|\n\s*LOCAL\s+E\s+DATA\b|\n\s*ASSINATURAS?\b|\n\s*TESTEMUNHAS\b|$)',
        E'\n\\2',
        'g'
      ),
      '\{\{\s*PECULIARIDADES\s*\}\}',
      '',
      'gi'
    )
  ),
  updated_at = now()
where
  template_text ~* 'PECULIARIDADES\s+E\s+CONDI[ÇC][ÕO]ES\s+ESPECIAIS'
  or template_text ~* '\{\{\s*PECULIARIDADES\s*\}\}';

update public.tipos_contrato
set
  modelo_base = btrim(
    regexp_replace(
      regexp_replace(
        coalesce(modelo_base, ''),
        '(?is)\mCL[ÁA]USULA\s+(D[ÉE]CIMA\s+QUINTA|D[ÉE]CIMA\s+SEXTA)\s*[–-]\s*PECULIARIDADES\s+E\s+CONDI[ÇC][ÕO]ES\s+ESPECIAIS.*?(\n\s*CL[ÁA]USULA\b|\n\s*LOCAL\s+E\s+DATA\b|\n\s*ASSINATURAS?\b|\n\s*TESTEMUNHAS\b|$)',
        E'\n\\2',
        'g'
      ),
      '\{\{\s*PECULIARIDADES\s*\}\}',
      '',
      'gi'
    )
  ),
  updated_at = now()
where
  coalesce(modelo_base, '') ~* 'PECULIARIDADES\s+E\s+CONDI[ÇC][ÕO]ES\s+ESPECIAIS'
  or coalesce(modelo_base, '') ~* '\{\{\s*PECULIARIDADES\s*\}\}';
