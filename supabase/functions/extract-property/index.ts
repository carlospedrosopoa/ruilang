import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AiProvider = "openai" | "gemini";

function getProviderFromRequest(body: any): AiProvider | null {
  const p = body?.ai?.provider;
  if (p === "openai" || p === "gemini") return p;
  return null;
}

function getDefaultProvider(): AiProvider {
  const raw = (Deno.env.get("AI_PROVIDER_DEFAULT") || "").toLowerCase();
  return raw === "gemini" ? "gemini" : "openai";
}

function isFailoverEnabled() {
  const raw = (Deno.env.get("AI_FAILOVER_ENABLED") || "").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

async function callOpenAiExtractProperty(params: {
  apiKey: string;
  systemPrompt: string;
  content: any[];
}) {
  const models = [
    Deno.env.get("OPENAI_MODEL_EXTRACT_PROPERTY") || "gpt-4o-mini",
    Deno.env.get("OPENAI_MODEL_EXTRACT_PROPERTY_FALLBACK") || "gpt-4o",
  ];

  let lastError = "";
  for (const model of models) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.content },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastError = errorText;
      if (response.status === 401) throw new Error("Credenciais inválidas. Verifique OPENAI_API_KEY.");
      if (response.status === 429) throw new Error("Limite de requisições excedido. Tente novamente.");
      if (response.status >= 500) continue;
      throw new Error(`Erro do provedor OpenAI (${response.status})`);
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || "";
    raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    try {
      return JSON.parse(raw);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      continue;
    }
  }

  throw new Error(lastError || "Falha ao extrair dados do imóvel com OpenAI.");
}

async function callGeminiExtractProperty(params: {
  apiKey: string;
  systemPrompt: string;
  userText: string;
  images: string[];
}) {
  const models = [
    Deno.env.get("GEMINI_MODEL_EXTRACT_PROPERTY") || "gemini-2.0-flash",
    Deno.env.get("GEMINI_MODEL_EXTRACT_PROPERTY_FALLBACK") || "gemini-2.0-pro",
  ];

  const parts: any[] = [{ text: params.userText }];
  for (const img of params.images) {
    const mimeType = img.startsWith("JVBERi0") ? "application/pdf" : "image/jpeg";
    parts.push({ inlineData: { mimeType, data: img } });
  }

  let lastError = "";
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemPrompt }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastError = errorText;
      if (response.status === 401 || response.status === 403) throw new Error("Credenciais inválidas. Verifique GEMINI_API_KEY.");
      if (response.status === 429) throw new Error("Limite de requisições excedido. Tente novamente.");
      if (response.status >= 500) continue;
      throw new Error(`Erro do provedor Gemini (${response.status})`);
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof raw !== "string" || !raw.trim()) {
      lastError = "Resposta vazia do Gemini.";
      continue;
    }

    try {
      return JSON.parse(raw);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      continue;
    }
  }

  throw new Error(lastError || "Falha ao extrair dados do imóvel com Gemini.");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { images } = body ?? {};
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

    const requestedProvider = getProviderFromRequest(body);
    const provider = requestedProvider ?? getDefaultProvider();
    const failover = isFailoverEnabled();

    const tryOrder: AiProvider[] = provider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
    let lastError: unknown = null;

    for (const p of tryOrder) {
      try {
        let extracted: any;
        if (p === "openai") {
          const key = Deno.env.get("OPENAI_API_KEY");
          if (!key) throw new Error("OPENAI_API_KEY is not configured");
          extracted = await callOpenAiExtractProperty({ apiKey: key, systemPrompt, content });
        } else {
          const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
          if (!key) throw new Error("GEMINI_API_KEY is not configured");
          extracted = await callGeminiExtractProperty({
            apiKey: key,
            systemPrompt,
            userText: "Extraia os dados do imóvel destes documentos e retorne apenas o JSON final.",
            images,
          });
        }

        return new Response(JSON.stringify({ dados: extracted }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        lastError = e;
        if (!failover) break;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Não foi possível processar a imagem. Tente tirar uma foto mais nítida e bem iluminada.");
  } catch (e) {
    console.error("extract-property error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
