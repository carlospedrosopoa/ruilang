import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { contrato } = await req.json();
    if (!contrato) throw new Error("Missing 'contrato' in request body");

    const tipoLabels: Record<string, string> = {
      promessa_compra_venda: "Contrato de Promessa de Compra e Venda de Imóvel",
      promessa_compra_venda_permuta: "Contrato de Promessa de Compra e Venda de Imóvel com Permuta",
      cessao_direitos: "Contrato de Cessão de Direitos Possessórios",
      locacao: "Contrato de Locação de Imóvel",
    };

    const tipoLabel = tipoLabels[contrato.tipoContrato] || "Contrato Imobiliário";

    const perfilInstrucoes: Record<string, string> = {
      blindagem_vendedor: `PERFIL: BLINDAGEM MÁXIMA PARA O VENDEDOR
- Arras confirmatórias: em caso de rescisão pelo COMPRADOR, NÃO haverá devolução dos valores pagos a título de arras
- Benfeitorias: PROIBIR qualquer benfeitoria no imóvel até a quitação integral. Caso o comprador realize benfeitorias sem autorização, estas NÃO serão indenizadas em hipótese alguma, revertendo em favor do vendedor
- Rescisão pelo comprador: além da perda das arras, o comprador deverá pagar aluguel mensal pelo período de ocupação do imóvel, calculado com base no valor de mercado
- Posse: conceder apenas posse PRECÁRIA até a quitação integral, nunca posse definitiva
- Multa rescisória mais elevada para o comprador (20-30% do valor total)
- Cláusula resolutiva expressa: a falta de pagamento de qualquer parcela importará na resolução de pleno direito do contrato
- Manutenção: todas as despesas de manutenção, tributos e encargos são de responsabilidade do comprador desde a imissão na posse
- Escritura: somente após quitação integral, com todas as despesas por conta do comprador`,
      blindagem_comprador: `PERFIL: BLINDAGEM MÁXIMA PARA O COMPRADOR
- Em caso de impossibilidade de outorga de escritura pelo vendedor, este deverá devolver TODOS os valores pagos acrescidos de multa de 20% do valor total do contrato e correção monetária
- Evicção: o vendedor assume responsabilidade INTEGRAL pela evicção de direito
- Posse: conceder posse DEFINITIVA e JUSTA imediatamente após assinatura do contrato
- Multa rescisória mais elevada para o vendedor
- Garantia de adjudicação compulsória expressa (art. 1.418 CC)
- Cláusula penal em favor do comprador em caso de atraso na entrega ou impedimento à escritura
- Direito de retenção por benfeitorias úteis e necessárias
- Vendedor deve apresentar certidões negativas de ônus reais, fiscais e trabalhistas`,
      equilibrado: `PERFIL: CONTRATO EQUILIBRADO
- Cláusulas justas e proporcionais para ambas as partes
- Multas rescisórias equivalentes para vendedor e comprador
- Arras confirmatórias com regra padrão do Código Civil (art. 418)
- Posse provisória com possibilidade de benfeitorias mediante autorização por escrito
- Evicção conforme regras gerais do Código Civil
- Despesas de transferência repartidas conforme prática de mercado
- Direito de retenção por benfeitorias necessárias, sem direito às voluptuárias`,
    };

    const perfilTexto = perfilInstrucoes[contrato.perfilContrato] || perfilInstrucoes["equilibrado"];

    const systemPrompt = `Você é um advogado especialista em direito contratual e imobiliário brasileiro. Sua tarefa é gerar minutas contratuais precisas, completas e juridicamente seguras.

${perfilTexto}

REGRAS:
- Use linguagem jurídica formal brasileira
- Inclua TODAS as cláusulas obrigatórias: Objeto, Qualificação das Partes, Obrigações, Prazos, Preço e Pagamento, Penalidades e Multas, Rescisão, Foro
- Respeite o Código Civil Brasileiro e legislação aplicável
- Para locação, aplique a Lei 8.245/91 (Lei do Inquilinato)
- Para cessão de direitos, inclua cláusulas sobre posse mansa e pacífica
- Para permuta, detalhe ambos os imóveis e a forma de compensação
- Inclua cláusula LGPD sobre tratamento de dados pessoais
- Use a formatação: CLÁUSULA PRIMEIRA, CLÁUSULA SEGUNDA, etc.
- Gere um documento completo pronto para assinatura
- Inclua espaço para assinaturas e testemunhas no final
- SEMPRE inclua aviso de que o documento deve ser revisado por advogado
- As cláusulas de blindagem devem estar em conformidade com o perfil escolhido

IMPORTANTE: Gere APENAS o texto do contrato, sem comentários ou explicações extras.`;

    const userPrompt = `Gere um ${tipoLabel} completo com os seguintes dados:

DADOS DO CONTRATO:
${JSON.stringify(contrato, null, 2)}

Gere a minuta completa, incluindo todas as cláusulas necessárias, qualificação das partes com os dados fornecidos, e espaço para assinaturas.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Configurações." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar contrato" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const minuta = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ minuta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-contract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
