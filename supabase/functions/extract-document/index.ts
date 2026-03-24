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

    const systemPrompt = `Você é um especialista em extração de dados de documentos brasileiros (RG, CNH, CPF, comprovante de endereço, certidão de casamento, etc.).

Analise as imagens enviadas e extraia TODOS os dados pessoais que conseguir identificar.

Responda APENAS com um JSON válido no seguinte formato (preencha apenas os campos encontrados, deixe string vazia "" para os não encontrados):

{
  "nome": "",
  "nacionalidade": "",
  "profissao": "",
  "estadoCivil": "",
  "regimeBens": "",
  "documentoTipo": "rg ou cnh",
  "documentoNumero": "",
  "documentoOrgao": "",
  "cpf": "",
  "filiacaoPai": "",
  "filiacaoMae": "",
  "endereco": "",
  "bairro": "",
  "cidade": "",
  "estado": "",
  "cep": "",
  "email": "",
  "telefone": ""
}

REGRAS:
- Para CPF, formate como 000.000.000-00
- Para estado civil, use: Solteiro(a), Casado(a), Divorciado(a), Viúvo(a), Separado(a) consensualmente, Separado(a) judicialmente, União Estável
- Para documentoTipo, use "rg" ou "cnh"
- Para estado, use a sigla (SP, RJ, RS, etc.)
- Se o documento for CNH, extraia o número do registro
- Retorne APENAS o JSON, sem markdown, sem explicações`;

    const content: any[] = [
      { type: "text", text: "Extraia os dados pessoais destes documentos:" },
    ];

    for (const img of images) {
      const mediaType = img.startsWith("/9j/") ? "image/jpeg"
        : img.startsWith("iVBOR") ? "image/png"
        : img.startsWith("JVBERi0") ? "application/pdf"
        : "image/jpeg";

      content.push({
        type: "image_url",
        image_url: {
          url: `data:${mediaType};base64,${img}`,
        },
      });
    }

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
      console.error("AI error:", response.status, t);
      throw new Error("Erro ao processar documentos");
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || "";

    // Strip markdown code fences if present
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
  } catch (e) {
    console.error("extract-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
