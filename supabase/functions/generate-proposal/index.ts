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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

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

    const systemPrompt = `Você é um advogado especialista em direito imobiliário brasileiro. Sua tarefa é gerar uma PROPOSTA DE NEGÓCIO IMOBILIÁRIO profissional, seguindo EXATAMENTE o modelo e estrutura abaixo.

MODELO OBRIGATÓRIO A SEGUIR:

O documento deve ter DUAS PARTES:
1. A PROPOSTA (página 1)
2. O ACEITE DA PROPOSTA (página 2)

ESTRUTURA EXATA:

---

P R O P O S T A   D E   ${tipoLabel}

Pelo presente [NOME DO CORRETOR], inscrito no CPF sob nº [CPF DO CORRETOR], residente e domiciliado na cidade de [CIDADE/ESTADO DO CORRETOR], através da [NOME DA IMOBILIÁRIA se houver], localizada na [ENDEREÇO DA IMOBILIÁRIA se houver].

Por este instrumento particular, a pessoa qualificada na Cláusula 1ª resolve, por livre e espontânea vontade, propor ao corretor de imóveis a ${tipoLabelLower} descrito,

[DESCRIÇÃO COMPLETA DO IMÓVEL com tipo, localização, quadra, lote, balneário/bairro, município, dados de registro/matrícula e confrontações se disponíveis]

Cláusula 1ª – Preço e condições de pagamento:

1) Pelo imóvel acima descrito o proponente propõe o pagamento do preço de R$ [VALOR TOTAL] ([VALOR POR EXTENSO]) e será pago da seguinte forma:

[LISTAR CADA FORMA DE PAGAMENTO: sinal, parcelas, financiamento, permuta, etc.]

[SE HOUVER COMISSÃO: O valor referente à comissão pela intermediação imobiliária, será de responsabilidade exclusiva do comprador, no valor de [X]%.]

Cláusula 2ª – Prazo de vigência:

1) A presente proposta é assinada em caráter irrevogável, vincula herdeiros e sucessores do proponente e tem vigência de 7 (sete) dias até o aceite do(s) proprietário(s)/vendedor(es), contados da data de sua assinatura.

Cláusula 3ª – Disposições gerais

1) A presente proposta é parte integrante do contrato de intermediação do imóvel, firmado entre o corretor de imóveis e o(s) proprietário(s)/vendedor(es).

2) Após aceita pelo(s) proprietário(s)/vendedor(es) a proposta tornar-se-á um contrato preliminar, nos moldes estabelecidos no art. 462 a 466 do Código Civil, sendo que as partes se obrigam a cumpri-la no prazo máximo de 07 (sete) dias contados do aceite.

3) A parte que der causa ao arrependimento ou a inexecução do contrato preliminar suportará, além das perdas e danos devidas à parte inocente, o pagamento imediato dos honorários profissionais do corretor de imóveis, no mesmo percentual estabelecido no contrato de intermediação, nos moldes estabelecidos no art. 725 do Código Civil.

Cláusula 4ª – Eleição do foro:

1) Todas as questões eventualmente oriundas do presente contrato, serão resolvidas, de forma definitiva via conciliatória ou arbitral, na Comarca do Foro de [CIDADE-ESTADO], consoante os preceitos ditados pela Lei nº 9.307 de 23/09/1996.

---

A C E I T E   D A   P R O P O S T A

Cláusula 5ª – Local e assinatura do proponente e do corretor de imóveis:

1) Local e data:

CIDADE – ESTADO: _______________
DATA: ____/____/________

2) Assinatura das partes:

PROPONENTE: _______________________________

CORRETOR DE IMÓVEIS: _______________________________

3) Assinatura das testemunhas:

Nome: _______________________________    Nome: _______________________________
CPF: ________________________________    CPF: ________________________________

Cláusula 6ª – Aceite do(s) proprietário(s)/vendedor(es):

1) O(s) proprietário(s)/vendedor(es) aceita(m) a proposta conforme formulada e aguarda(m) o proponente para assinatura do contrato ou escritura definitiva do imóvel.

2) O(s) proprietário(s)/vendedor(es) autorizam o corretor de imóveis a receber o sinal do negócio e a emitir recibo em seu(s) nome(s).

3) Local e data:

CIDADE – ESTADO: _______________
DATA: ____/____/________

4) Assinatura das partes:

PROPRIETÁRIO(S)/VENDEDOR(ES): _______________________________

CÔNJUGE DO(S) PROPRIETÁRIO(S)/VENDEDOR(ES): _______________________________

5) Assinatura das testemunhas:

Nome: _______________________________    Nome: _______________________________
CPF: ________________________________    CPF: ________________________________

---

REGRAS DE REDAÇÃO:
- NÃO use formatação markdown (asteriscos, hashtags, etc). Texto PURO.
- Adapte os termos conforme o tipo de contrato (locação usa "locador/locatário", cessão usa "cedente/cessionário")
- Para LOCAÇÃO: adapte a Cláusula 1ª para valor do aluguel mensal, prazo, garantia, etc.
- Para PERMUTA: inclua descrição do imóvel dado em permuta e a torna (diferença de valores)
- Qualifique o corretor com os dados fornecidos
- Descreva o imóvel com TODOS os dados disponíveis
- Escreva os valores por extenso entre parênteses
- O documento deve estar PRONTO PARA IMPRESSÃO E ASSINATURA
- Gere APENAS o texto da proposta, sem comentários extras`;

    const userPrompt = `Gere a Proposta de ${tipoLabel} com os seguintes dados:

DADOS COLETADOS:
${JSON.stringify(dados, null, 2)}

Tipo de contrato: ${tipoContrato}
${imobInfo}

Gere a proposta completa conforme o modelo nas instruções, com TODAS as cláusulas e espaços para assinatura.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Credenciais inválidas. Verifique OPENAI_API_KEY." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
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
