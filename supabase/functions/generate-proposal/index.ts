import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tipoLabels: Record<string, string> = {
  promessa_compra_venda: "Compra e Venda de Imóvel",
  promessa_compra_venda_permuta: "Compra e Venda de Imóvel com Permuta",
  cessao_direitos: "Cessão de Direitos Possessórios",
  locacao: "Locação de Imóvel",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { dados, tipoContrato } = await req.json();
    if (!dados) throw new Error("Missing 'dados' in request body");

    const tipoLabel = tipoLabels[tipoContrato] || "Negócio Imobiliário";

    const systemPrompt = `Você é um advogado especialista em direito imobiliário brasileiro. Sua tarefa é gerar uma PROPOSTA DE NEGÓCIO (termo de compromisso preliminar) concisa e profissional para que as partes envolvidas em uma transação imobiliária assinem previamente, manifestando sua intenção firme de celebrar o contrato definitivo.

REGRAS DE REDAÇÃO:
- Linguagem jurídica formal, mas acessível
- Documento CONCISO (1-2 páginas no máximo)
- NÃO use formatação markdown (asteriscos, hashtags, etc). Texto PURO.
- Títulos em LETRAS MAIÚSCULAS
- Qualifique as partes com TODOS os dados fornecidos (nome, CPF, RG/CNH, estado civil, endereço)
- Se houver cônjuge, incluí-lo como anuente

ESTRUTURA OBRIGATÓRIA:
1. TÍTULO: "PROPOSTA DE NEGÓCIO - ${tipoLabel}"
2. PREÂMBULO com qualificação completa das partes
3. CLÁUSULA 1 - OBJETO: Descrição do imóvel e da natureza do negócio pretendido
4. CLÁUSULA 2 - CONDIÇÕES COMERCIAIS: Valor, forma de pagamento resumida
5. CLÁUSULA 3 - COMPROMISSO: As partes declaram que estão de acordo com os termos acima e se comprometem a firmar o contrato definitivo, a ser elaborado por advogado, contendo todas as cláusulas de proteção jurídica necessárias
6. CLÁUSULA 4 - PRAZO: A presente proposta tem validade de 30 dias a contar da assinatura
7. CLÁUSULA 5 - DISPOSIÇÕES GERAIS: A presente proposta não substitui o contrato definitivo, que deverá ser elaborado por profissional habilitado e assinado pelas partes para ter plena eficácia jurídica
8. LOCAL E DATA (deixar em branco para preenchimento)
9. ESPAÇO PARA ASSINATURAS de todas as partes (com nome completo e CPF abaixo de cada linha)
10. ESPAÇO PARA 2 TESTEMUNHAS

IMPORTANTE:
- Gere APENAS o texto da proposta, sem comentários extras
- A proposta deve deixar CLARO que NÃO é o contrato definitivo
- Deve mencionar que o contrato definitivo será elaborado posteriormente com todas as cláusulas de proteção jurídica`;

    const userPrompt = `Gere uma Proposta de Negócio para ${tipoLabel} com os seguintes dados:

${JSON.stringify(dados, null, 2)}

Gere a proposta completa conforme as instruções.`;

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
