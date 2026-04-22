import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tipoLabels: Record<string, string> = {
  promessa_compra_venda: "COMPRA DE IMÓVEL",
  promessa_compra_venda_permuta: "COMPRA DE IMÓVEL COM PERMUTA",
  cessao_direitos: "CESSÃO DE DIREITOS POSSESSÓRIOS",
  locacao: "LOCAÇÃO DE IMÓVEL",
};

const tipoLabelsLower: Record<string, string> = {
  promessa_compra_venda: "compra do imóvel",
  promessa_compra_venda_permuta: "compra do imóvel com permuta",
  cessao_direitos: "cessão de direitos possessórios do imóvel",
  locacao: "locação do imóvel",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { dados, tipoContrato, imobiliaria } = await req.json();
    if (!dados) throw new Error("Missing 'dados' in request body");

    const tipoLabel = tipoLabels[tipoContrato] || "NEGÓCIO IMOBILIÁRIO";
    const tipoLabelLower = tipoLabelsLower[tipoContrato] || "negócio imobiliário";

    const imobInfo = imobiliaria
      ? `\n\nDADOS DA IMOBILIÁRIA (use no cabeçalho da proposta):
- Nome: ${imobiliaria.nome}
- CRECI: ${imobiliaria.creci}
- Responsável: ${imobiliaria.responsavel || "não informado"}
- Endereço: ${imobiliaria.endereco || ""}${imobiliaria.numero ? ", nº " + imobiliaria.numero : ""}${imobiliaria.bairro ? " - " + imobiliaria.bairro : ""}
- Cidade/Estado: ${imobiliaria.cidade}/${imobiliaria.estado}
- Telefone: ${imobiliaria.telefone || "não informado"}`
      : "";

    const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro.

Sua tarefa é gerar uma PROPOSTA DE ${tipoLabel} profissional, usando EXATAMENTE o modelo base abaixo como estrutura, mas substituindo todos os dados e exemplos pelos dados oficiais fornecidos.

REGRAS GERAIS (OBRIGATÓRIAS):
- Retorne APENAS o texto final da proposta (sem markdown, sem comentários).
- Não deixe placeholders entre colchetes (ex.: [NOME], [CPF], etc). Tudo deve ser preenchido.
- Se algum dado estiver ausente, use "________" (linha) no lugar, sem inventar.
- Use linguagem jurídica formal.
- Use valores monetários com "R$" e escreva o valor por extenso entre parênteses.
- Adapte os termos conforme o tipo de contrato: locação usa "Locador/Locatário"; cessão usa "Cedente/Cessionário"; permuta menciona imóvel em permuta e torna.
- Na seção "Local e Data", use a cidade/UF mais adequada (preferencialmente do imóvel) e a data do dia (dia/mês por extenso/ano).

MODELO BASE (ESTRUTURA OBRIGATÓRIA):

PROPOSTA DE COMPRA DE IMÓVEL
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

Assinatura do Cônjuge

INSTRUÇÕES DE PREENCHIMENTO:
- [IMOBILIARIA_NOME], [IMOBILIARIA_CRECI] e [IMOBILIARIA_ENDERECO] devem ser preenchidos com os dados enviados (se não houver, deixe "________").
- O proponente é, via de regra, o COMPRADOR/LOCATÁRIO/CESSIONÁRIO (conforme o tipo).`;

    const userPrompt = `Gere a Proposta de ${tipoLabel} com os seguintes dados:

DADOS COLETADOS:
${JSON.stringify(dados, null, 2)}

Tipo de contrato: ${tipoContrato}
${imobInfo}

Gere a proposta completa conforme o modelo nas instruções, com TODAS as cláusulas e espaços para assinatura.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Configurações." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar proposta" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let proposta = data.choices?.[0]?.message?.content || "";
    proposta = proposta.replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/^-{3,}$/gm, "").replace(/`/g, "");

    return new Response(JSON.stringify({ proposta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-proposal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
