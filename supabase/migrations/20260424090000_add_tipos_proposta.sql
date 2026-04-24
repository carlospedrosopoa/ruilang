create table if not exists public.tipos_proposta (
  id uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references public.imobiliarias (id) on delete cascade,
  codigo text not null,
  nome text not null,
  descricao text null,
  modelo_base text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (imobiliaria_id, codigo)
);

create index if not exists tipos_proposta_imobiliaria_id_idx on public.tipos_proposta (imobiliaria_id);
create index if not exists tipos_proposta_ativo_idx on public.tipos_proposta (imobiliaria_id, ativo);

alter table public.tipos_proposta enable row level security;

drop policy if exists "Platform admins manage tipos_proposta" on public.tipos_proposta;
create policy "Platform admins manage tipos_proposta"
on public.tipos_proposta
for all
to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "Tenant members access tipos_proposta" on public.tipos_proposta;
create policy "Tenant members access tipos_proposta"
on public.tipos_proposta
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.tipos_proposta.imobiliaria_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.tipos_proposta.imobiliaria_id
      and tm.user_id = auth.uid()
  )
);

create or replace function public.seed_default_tipos_proposta()
returns trigger
language plpgsql
as $$
begin
  insert into public.tipos_proposta (imobiliaria_id, codigo, nome, descricao, modelo_base, ativo)
  values
    (
      new.id,
      'promessa_compra_venda',
      'Compra e Venda',
      'Proposta de compra e venda de imóvel',
      'PROPOSTA DE COMPRA DE IMÓVEL
Pelo presente instrumento, o(a) proponente [NOME DO COMPRADOR], inscrito(a) no CPF sob nº [CPF], residente e domiciliado(a) na cidade de [Cidade/UF], por intermédio da [IMOBILIARIA_NOME], inscrita no CRECI-J nº [IMOBILIARIA_CRECI], localizada na [IMOBILIARIA_ENDERECO], resolve, por livre e espontânea vontade, apresentar a seguinte PROPOSTA DE COMPRA do imóvel abaixo descrito:

Objeto: [DESCRIÇÃO COMPLETA DO IMÓVEL, com localização, quadra, lote, balneário/bairro, município/UF e matrícula/RI quando houver].

CLÁUSULA 1ª – PREÇO E CONDIÇÕES DE PAGAMENTO
1.1. O preço total pela aquisição do imóvel é de R$ [VALOR_TOTAL] ([VALOR_TOTAL_POR_EXTENSO]), a ser pago conforme as condições abaixo:
[DESCREVER FORMA DE PAGAMENTO COMPLETA: arras/sinal (se houver), parcelas (se houver), datas de vencimento, financiamento (se houver), permuta (se houver), torna, etc.]
1.2. O valor referente à comissão pela intermediação imobiliária, no percentual de 6% sobre o valor da venda, será de responsabilidade exclusiva do comprador/proponente, a ser pago no ato da assinatura do contrato preliminar/compromisso de compra e venda.

CLÁUSULA 2ª – PRAZO DE VIGÊNCIA
2.1. A presente proposta é irrevogável, vincula herdeiros e sucessores, e tem validade de 07 (sete) dias para o aceite do(s) proprietário(s)/vendedor(es), contados a partir da data de sua assinatura.

CLÁUSULA 3ª – DISPOSIÇÕES GERAIS
3.1. Esta proposta é parte integrante do contrato de intermediação imobiliária firmado entre a imobiliária e o(s) proprietário(s).
3.2. Após o aceite, a proposta converter-se-á em contrato preliminar (arts. 462 a 466 do Código Civil), obrigando as partes à formalização do negócio definitivo no prazo máximo de 07 (sete) dias após o aceite.
3.3. A parte que der causa ao arrependimento ou à inexecução injustificada do contrato preliminar, além das perdas e danos devidas à parte inocente, arcará com o pagamento imediato dos honorários profissionais do corretor de imóveis, conforme art. 725 do Código Civil.

CLÁUSULA 4ª – DO TRATAMENTO E PROTEÇÃO DE DADOS (LGPD)
4.1. O(s) Proponente(s) e o(s) Vendedor(es) autorizam a Imobiliária, na qualidade de Controladora, a realizar o tratamento de seus dados pessoais (nome, CPF, endereço, contato, etc.) para as finalidades de execução deste negócio jurídico, cumprimento de obrigações legais (fiscais e imobiliárias) e prevenção à lavagem de dinheiro.
4.2. Os dados serão armazenados durante a vigência desta relação contratual e pelo período necessário para atender aos prazos prescricionais e obrigações legais de guarda documental.
4.3. A Imobiliária compromete-se a manter medidas de segurança técnica e administrativa para proteção dos dados, garantindo aos titulares o exercício dos direitos previstos no art. 18 da LGPD, mediante solicitação formal.

CLÁUSULA 5ª – FORO E SOLUÇÃO DE CONFLITOS
5.1. As partes elegem o foro da Comarca de [FORO_CIDADE_UF] para dirimir quaisquer questões oriundas deste instrumento. As controvérsias poderão ser submetidas à conciliação ou arbitragem, conforme Lei nº 9.307/96, mediante anuência expressa das partes.

ACEITE DA PROPOSTA
Local e Data: [CIDADE_UF], [DIA] de [MÊS] de [ANO].

Assinatura do Proponente

Assinatura do Corretor de Imóveis (CRECI)

Testemunhas:

Nome/CPF: __________

Nome/CPF: __________

CLÁUSULA 6ª – ACEITE DO(S) VENDEDOR(ES)
6.1. O(s) Vendedor(es) aceita(m) a proposta nos termos supra e autoriza(m) o corretor de imóveis a receber sinal de negócio, caso aplicável, emitindo o respectivo recibo.

Local e Data: [CIDADE_UF], [DIA] de [MÊS] de [ANO].

Assinatura do Vendedor

Assinatura do Cônjuge',
      true
    ),
    (
      new.id,
      'promessa_compra_venda_permuta',
      'Compra e Venda c/ Permuta',
      'Proposta de compra e venda com permuta',
      'PROPOSTA DE COMPRA DE IMÓVEL COM PERMUTA
[Ajustar o texto e a qualificação conforme o caso, mencionando o imóvel dado em permuta e a torna, quando houver.]

Objeto: [DESCRIÇÃO COMPLETA DO IMÓVEL, com localização, quadra, lote, balneário/bairro, município/UF e matrícula/RI quando houver].
Imóvel em Permuta: [DESCRIÇÃO COMPLETA DO IMÓVEL DADO EM PERMUTA, quando houver].

CLÁUSULA 1ª – PREÇO E CONDIÇÕES DE PAGAMENTO
1.1. O preço total do negócio é de R$ [VALOR_TOTAL] ([VALOR_TOTAL_POR_EXTENSO]).
1.2. Parte do preço será satisfeita mediante permuta do imóvel descrito acima, avaliado em R$ [VALOR_PERMUTA] ([VALOR_PERMUTA_POR_EXTENSO]).
1.3. A diferença ("torna"), se aplicável, será paga em R$ [VALOR_TORNA] ([VALOR_TORNA_POR_EXTENSO]), nas condições: [DETALHAR].

ACEITE DA PROPOSTA
Local e Data: [CIDADE_UF], [DIA] de [MÊS] de [ANO].',
      true
    ),
    (
      new.id,
      'cessao_direitos',
      'Cessão de Direitos',
      'Proposta de cessão de direitos possessórios',
      'PROPOSTA DE CESSÃO DE DIREITOS POSSESSÓRIOS
[Ajustar o texto e a qualificação conforme o caso, utilizando "Cedente/Cessionário".]

Objeto: [DESCRIÇÃO COMPLETA DO IMÓVEL, com localização, quadra, lote, balneário/bairro, município/UF, origem da posse e matrícula/RI quando houver].

CLÁUSULA 1ª – PREÇO E CONDIÇÕES DE PAGAMENTO
1.1. O preço total da cessão é de R$ [VALOR_TOTAL] ([VALOR_TOTAL_POR_EXTENSO]), a ser pago conforme: [DETALHAR].

ACEITE DA PROPOSTA
Local e Data: [CIDADE_UF], [DIA] de [MÊS] de [ANO].',
      true
    ),
    (
      new.id,
      'locacao',
      'Locação',
      'Proposta de locação de imóvel',
      'PROPOSTA DE LOCAÇÃO DE IMÓVEL
[Ajustar o texto e a qualificação conforme o caso, utilizando "Locador/Locatário".]

Objeto: [DESCRIÇÃO COMPLETA DO IMÓVEL, com localização, quadra, lote, balneário/bairro, município/UF e matrícula/RI quando houver].

CLÁUSULA 1ª – VALOR E CONDIÇÕES DE PAGAMENTO
1.1. O valor do aluguel é de R$ [VALOR_ALUGUEL] ([VALOR_ALUGUEL_POR_EXTENSO]), com vencimento todo dia [DIA_VENCIMENTO] de cada mês.
1.2. Garantia locatícia: [CAUÇÃO/FIANÇA/SEGURO FIANÇA], nos termos: [DETALHAR].

ACEITE DA PROPOSTA
Local e Data: [CIDADE_UF], [DIA] de [MÊS] de [ANO].',
      true
    )
  on conflict (imobiliaria_id, codigo) do nothing;

  return new;
end;
$$;

drop trigger if exists seed_default_tipos_proposta on public.imobiliarias;
create trigger seed_default_tipos_proposta
after insert on public.imobiliarias
for each row execute function public.seed_default_tipos_proposta();

insert into public.tipos_proposta (imobiliaria_id, codigo, nome, descricao, modelo_base, ativo)
select
  i.id,
  t.codigo,
  t.nome,
  t.descricao,
  t.modelo_base,
  true
from public.imobiliarias i
cross join (
  values
    (
      'promessa_compra_venda',
      'Compra e Venda',
      'Proposta de compra e venda de imóvel',
      'PROPOSTA DE COMPRA DE IMÓVEL
Pelo presente instrumento, o(a) proponente [NOME DO COMPRADOR], inscrito(a) no CPF sob nº [CPF], residente e domiciliado(a) na cidade de [Cidade/UF], por intermédio da [IMOBILIARIA_NOME], inscrita no CRECI-J nº [IMOBILIARIA_CRECI], localizada na [IMOBILIARIA_ENDERECO], resolve, por livre e espontânea vontade, apresentar a seguinte PROPOSTA DE COMPRA do imóvel abaixo descrito:

Objeto: [DESCRIÇÃO COMPLETA DO IMÓVEL, com localização, quadra, lote, balneário/bairro, município/UF e matrícula/RI quando houver].

CLÁUSULA 1ª – PREÇO E CONDIÇÕES DE PAGAMENTO
1.1. O preço total pela aquisição do imóvel é de R$ [VALOR_TOTAL] ([VALOR_TOTAL_POR_EXTENSO]), a ser pago conforme as condições abaixo:
[DESCREVER FORMA DE PAGAMENTO COMPLETA: arras/sinal (se houver), parcelas (se houver), datas de vencimento, financiamento (se houver), permuta (se houver), torna, etc.]
1.2. O valor referente à comissão pela intermediação imobiliária, no percentual de 6% sobre o valor da venda, será de responsabilidade exclusiva do comprador/proponente, a ser pago no ato da assinatura do contrato preliminar/compromisso de compra e venda.

CLÁUSULA 2ª – PRAZO DE VIGÊNCIA
2.1. A presente proposta é irrevogável, vincula herdeiros e sucessores, e tem validade de 07 (sete) dias para o aceite do(s) proprietário(s)/vendedor(es), contados a partir da data de sua assinatura.

CLÁUSULA 3ª – DISPOSIÇÕES GERAIS
3.1. Esta proposta é parte integrante do contrato de intermediação imobiliária firmado entre a imobiliária e o(s) proprietário(s).
3.2. Após o aceite, a proposta converter-se-á em contrato preliminar (arts. 462 a 466 do Código Civil), obrigando as partes à formalização do negócio definitivo no prazo máximo de 07 (sete) dias após o aceite.
3.3. A parte que der causa ao arrependimento ou à inexecução injustificada do contrato preliminar, além das perdas e danos devidas à parte inocente, arcará com o pagamento imediato dos honorários profissionais do corretor de imóveis, conforme art. 725 do Código Civil.

CLÁUSULA 4ª – DO TRATAMENTO E PROTEÇÃO DE DADOS (LGPD)
4.1. O(s) Proponente(s) e o(s) Vendedor(es) autorizam a Imobiliária, na qualidade de Controladora, a realizar o tratamento de seus dados pessoais (nome, CPF, endereço, contato, etc.) para as finalidades de execução deste negócio jurídico, cumprimento de obrigações legais (fiscais e imobiliárias) e prevenção à lavagem de dinheiro.
4.2. Os dados serão armazenados durante a vigência desta relação contratual e pelo período necessário para atender aos prazos prescricionais e obrigações legais de guarda documental.
4.3. A Imobiliária compromete-se a manter medidas de segurança técnica e administrativa para proteção dos dados, garantindo aos titulares o exercício dos direitos previstos no art. 18 da LGPD, mediante solicitação formal.

CLÁUSULA 5ª – FORO E SOLUÇÃO DE CONFLITOS
5.1. As partes elegem o foro da Comarca de [FORO_CIDADE_UF] para dirimir quaisquer questões oriundas deste instrumento. As controvérsias poderão ser submetidas à conciliação ou arbitragem, conforme Lei nº 9.307/96, mediante anuência expressa das partes.

ACEITE DA PROPOSTA
Local e Data: [CIDADE_UF], [DIA] de [MÊS] de [ANO].

Assinatura do Proponente

Assinatura do Corretor de Imóveis (CRECI)

Testemunhas:

Nome/CPF: __________

Nome/CPF: __________

CLÁUSULA 6ª – ACEITE DO(S) VENDEDOR(ES)
6.1. O(s) Vendedor(es) aceita(m) a proposta nos termos supra e autoriza(m) o corretor de imóveis a receber sinal de negócio, caso aplicável, emitindo o respectivo recibo.

Local e Data: [CIDADE_UF], [DIA] de [MÊS] de [ANO].

Assinatura do Vendedor

Assinatura do Cônjuge'
    ),
    (
      'promessa_compra_venda_permuta',
      'Compra e Venda c/ Permuta',
      'Proposta de compra e venda com permuta',
      'PROPOSTA DE COMPRA DE IMÓVEL COM PERMUTA
[Ajustar o texto e a qualificação conforme o caso, mencionando o imóvel dado em permuta e a torna, quando houver.]

Objeto: [DESCRIÇÃO COMPLETA DO IMÓVEL, com localização, quadra, lote, balneário/bairro, município/UF e matrícula/RI quando houver].
Imóvel em Permuta: [DESCRIÇÃO COMPLETA DO IMÓVEL DADO EM PERMUTA, quando houver].

CLÁUSULA 1ª – PREÇO E CONDIÇÕES DE PAGAMENTO
1.1. O preço total do negócio é de R$ [VALOR_TOTAL] ([VALOR_TOTAL_POR_EXTENSO]).
1.2. Parte do preço será satisfeita mediante permuta do imóvel descrito acima, avaliado em R$ [VALOR_PERMUTA] ([VALOR_PERMUTA_POR_EXTENSO]).
1.3. A diferença ("torna"), se aplicável, será paga em R$ [VALOR_TORNA] ([VALOR_TORNA_POR_EXTENSO]), nas condições: [DETALHAR].

ACEITE DA PROPOSTA
Local e Data: [CIDADE_UF], [DIA] de [MÊS] de [ANO].'
    ),
    (
      'cessao_direitos',
      'Cessão de Direitos',
      'Proposta de cessão de direitos possessórios',
      'PROPOSTA DE CESSÃO DE DIREITOS POSSESSÓRIOS
[Ajustar o texto e a qualificação conforme o caso, utilizando "Cedente/Cessionário".]

Objeto: [DESCRIÇÃO COMPLETA DO IMÓVEL, com localização, quadra, lote, balneário/bairro, município/UF, origem da posse e matrícula/RI quando houver].

CLÁUSULA 1ª – PREÇO E CONDIÇÕES DE PAGAMENTO
1.1. O preço total da cessão é de R$ [VALOR_TOTAL] ([VALOR_TOTAL_POR_EXTENSO]), a ser pago conforme: [DETALHAR].

ACEITE DA PROPOSTA
Local e Data: [CIDADE_UF], [DIA] de [MÊS] de [ANO].'
    ),
    (
      'locacao',
      'Locação',
      'Proposta de locação de imóvel',
      'PROPOSTA DE LOCAÇÃO DE IMÓVEL
[Ajustar o texto e a qualificação conforme o caso, utilizando "Locador/Locatário".]

Objeto: [DESCRIÇÃO COMPLETA DO IMÓVEL, com localização, quadra, lote, balneário/bairro, município/UF e matrícula/RI quando houver].

CLÁUSULA 1ª – VALOR E CONDIÇÕES DE PAGAMENTO
1.1. O valor do aluguel é de R$ [VALOR_ALUGUEL] ([VALOR_ALUGUEL_POR_EXTENSO]), com vencimento todo dia [DIA_VENCIMENTO] de cada mês.
1.2. Garantia locatícia: [CAUÇÃO/FIANÇA/SEGURO FIANÇA], nos termos: [DETALHAR].

ACEITE DA PROPOSTA
Local e Data: [CIDADE_UF], [DIA] de [MÊS] de [ANO].'
    )
) as t(codigo, nome, descricao, modelo_base)
on conflict (imobiliaria_id, codigo) do nothing;
