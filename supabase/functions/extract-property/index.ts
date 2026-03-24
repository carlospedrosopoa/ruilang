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

    const { images } = await req.json();
    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new Error("Envie ao menos uma imagem em base64");
    }

    for (const img of images) {
      if (typeof img !== "string" || img.length < 100) {
        throw new Error("Imagem inválida. Certifique-se de enviar fotos nítidas dos documentos.");
      }
    }

    const systemPrompt = `Você é um especialista em extração de dados de documentos imobiliários brasileiros (matrícula de imóvel, escritura pública, contrato de compra e venda, certidão de ônus reais, IPTU, etc.).

Analise as imagens enviadas e extraia TODOS os dados do imóvel que conseguir identificar.

Responda APENAS com um JSON válido no seguinte formato (preencha apenas os campos encontrados, deixe string vazia "" para os não encontrados):

{
  "tipo": "",
  "descricao": "",
  "localizacao": "",
  "municipio": "",
  "estadoImovel": "",
  "lote": "",
  "quadra": "",
  "areaTotal": "",
  "matricula": "",
  "registroImoveis": "",
  "medidasFrente": "",
  "medidasFundos": "",
  "medidasLateralEsquerda": "",
  "medidasLateralDireita": "",
  "caracteristicas": ""
}

REGRAS:
- Para "tipo", use: terreno, casa, apartamento, sala_comercial, loja, galpao, chacara, outro
- Para "estadoImovel", use a sigla do estado (SP, RJ, RS, etc.)
- Para "areaTotal", inclua a unidade (ex: "360,00 m²")
- Para medidas, inclua a unidade (ex: "12,00 metros")
- Para "matricula", extraia apenas o número da matrícula
- Para "registroImoveis", extraia o nome do cartório/ofício (ex: "1ª Zona de Torres/RS")
- Para "descricao", inclua descrições detalhadas do imóvel como confrontações e benfeitorias
- Para "caracteristicas", inclua dados adicionais constantes da matrícula
- Retorne APENAS o JSON, sem markdown, sem explicações`;

    const content: any[] = [
      { type: "text", text: "Extraia os dados do imóvel destes documentos:" },
    ];

    for (const img of images) {
      const mediaType = img.startsWith("JVBERi0") ? "application/pdf" : "image/jpeg";
      content.push({
        type: "image_url",
        image_url: { url: `data:${mediaType};base64,${img}` },
      });
    }

    const models = ["google/gemini-2.5-flash", "openai/gpt-5-mini"];
    let lastError = "";

    for (const model of models) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content },
            ],
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (response.status === 402) {
            return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const t = await response.text();
          console.error(`AI error with ${model}:`, response.status, t);
          lastError = t;
          continue;
        }

        const data = await response.json();
        let raw = data.choices?.[0]?.message?.content || "";
        raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

        let extracted;
        try {
          extracted = JSON.parse(raw);
        } catch {
          console.error("Failed to parse AI response:", raw);
          throw new Error("Não foi possível extrair dados do documento. Tente com uma imagem mais nítida.");
        }

        return new Response(JSON.stringify({ dados: extracted }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (modelError) {
        console.error(`Error with model ${model}:`, modelError);
        if (modelError instanceof Error && modelError.message.includes("extrair dados")) {
          throw modelError;
        }
        lastError = modelError instanceof Error ? modelError.message : String(modelError);
        continue;
      }
    }

    throw new Error("Não foi possível processar a imagem. Tente tirar uma foto mais nítida e bem iluminada.");
  } catch (e) {
    console.error("extract-property error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
