import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const extractionSchema = {
  type: "object",
  properties: {
    nome: { type: "string" },
    nacionalidade: { type: "string" },
    profissao: { type: "string" },
    estadoCivil: { type: "string" },
    regimeBens: { type: "string" },
    documentoTipo: { type: "string", enum: ["", "rg", "cnh"] },
    documentoNumero: { type: "string" },
    documentoOrgao: { type: "string" },
    cpf: { type: "string" },
    filiacaoPai: { type: "string" },
    filiacaoMae: { type: "string" },
    endereco: { type: "string" },
    bairro: { type: "string" },
    cidade: { type: "string" },
    estado: { type: "string" },
    cep: { type: "string" },
    email: { type: "string" },
    telefone: { type: "string" },
  },
  required: [
    "nome",
    "nacionalidade",
    "profissao",
    "estadoCivil",
    "regimeBens",
    "documentoTipo",
    "documentoNumero",
    "documentoOrgao",
    "cpf",
    "filiacaoPai",
    "filiacaoMae",
    "endereco",
    "bairro",
    "cidade",
    "estado",
    "cep",
    "email",
    "telefone",
  ],
  additionalProperties: false,
};

const emptyExtraction = {
  nome: "",
  nacionalidade: "",
  profissao: "",
  estadoCivil: "",
  regimeBens: "",
  documentoTipo: "",
  documentoNumero: "",
  documentoOrgao: "",
  cpf: "",
  filiacaoPai: "",
  filiacaoMae: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  email: "",
  telefone: "",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractToolArguments(data: any) {
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;

  if (typeof args === "string") {
    return JSON.parse(args);
  }

  return args;
}

function extractJsonFallback(data: any) {
  const rawContent = data?.choices?.[0]?.message?.content;
  if (typeof rawContent !== "string" || !rawContent.trim()) return null;

  const cleaned = rawContent
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  return JSON.parse(cleaned);
}

function normalizeExtraction(payload: any) {
  return {
    ...emptyExtraction,
    ...Object.fromEntries(
      Object.entries(payload ?? {}).map(([key, value]) => [key, typeof value === "string" ? value.trim() : ""]),
    ),
  };
}

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

async function callOpenAiExtractDocument(params: {
  apiKey: string;
  systemPrompt: string;
  content: any[];
}) {
  const models = [
    Deno.env.get("OPENAI_MODEL_EXTRACT_DOCUMENT") || "gpt-4o-mini",
    Deno.env.get("OPENAI_MODEL_EXTRACT_DOCUMENT_FALLBACK") || "gpt-4o",
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
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Retorna os dados extraídos do documento em formato estruturado.",
              parameters: extractionSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_document_data" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastError = errorText;
      if (response.status === 401) throw new Error("Credenciais inválidas. Verifique OPENAI_API_KEY.");
      if (response.status === 429) throw new Error("Limite de requisições excedido. Tente novamente em alguns segundos.");
      if (response.status >= 500) continue;
      throw new Error(`Erro do provedor OpenAI (${response.status})`);
    }

    const data = await response.json();
    try {
      return normalizeExtraction(extractToolArguments(data) ?? extractJsonFallback(data));
    } catch (parseError) {
      lastError = parseError instanceof Error ? parseError.message : String(parseError);
      continue;
    }
  }

  throw new Error(lastError || "Falha ao extrair dados com OpenAI.");
}

async function callGeminiExtractDocument(params: {
  apiKey: string;
  systemPrompt: string;
  userText: string;
  images: string[];
}) {
  const models = [
    Deno.env.get("GEMINI_MODEL_EXTRACT_DOCUMENT") || "gemini-2.0-flash",
    Deno.env.get("GEMINI_MODEL_EXTRACT_DOCUMENT_FALLBACK") || "gemini-2.0-pro",
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
      if (response.status === 429) throw new Error("Limite de requisições excedido. Tente novamente em alguns segundos.");
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
      const parsed = JSON.parse(raw);
      return normalizeExtraction(parsed);
    } catch (parseError) {
      lastError = parseError instanceof Error ? parseError.message : String(parseError);
      continue;
    }
  }

  throw new Error(lastError || "Falha ao extrair dados com Gemini.");
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

    const systemPrompt = `Você é um especialista em extração de dados de documentos brasileiros (RG, CNH, CPF, comprovante de endereço, certidão de casamento, etc.).

Extraia todos os dados pessoais encontrados e chame obrigatoriamente a ferramenta com os campos preenchidos.

REGRAS:
- Para CPF, formate como 000.000.000-00
- Para estado civil, use: Solteiro(a), Casado(a), Divorciado(a), Viúvo(a), Separado(a) consensualmente, Separado(a) judicialmente, União Estável
- Para documentoTipo, use apenas "rg" ou "cnh"
- Para estado, use a sigla (SP, RJ, RS, etc.)
- Se o documento for CNH, extraia o número do registro
- Campos não encontrados devem ser string vazia

FORMATO DE RESPOSTA:
- Retorne APENAS um JSON válido, sem markdown, no formato do schema informado`; 

    const content: any[] = [
      { type: "text", text: "Extraia os dados pessoais destes documentos e preencha a ferramenta com o resultado." },
    ];

    for (const img of images) {
      const mediaType = img.startsWith("JVBERi0") ? "application/pdf" : "image/jpeg";
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${mediaType};base64,${img}`,
        },
      });
    }

    const requestedProvider = getProviderFromRequest(body);
    const provider = requestedProvider ?? getDefaultProvider();
    const failover = isFailoverEnabled();

    const tryOrder: AiProvider[] = provider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
    let lastError: unknown = null;

    for (const p of tryOrder) {
      try {
        if (p === "openai") {
          const key = Deno.env.get("OPENAI_API_KEY");
          if (!key) throw new Error("OPENAI_API_KEY is not configured");
          const extracted = await callOpenAiExtractDocument({ apiKey: key, systemPrompt, content });
          return jsonResponse({ dados: extracted });
        }

        const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
        if (!key) throw new Error("GEMINI_API_KEY is not configured");
        const extracted = await callGeminiExtractDocument({
          apiKey: key,
          systemPrompt,
          userText: "Extraia os dados pessoais destes documentos e retorne apenas o JSON final.",
          images,
        });
        return jsonResponse({ dados: extracted });
      } catch (e) {
        lastError = e;
        if (!failover) break;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Não foi possível extrair dados do documento.");
  } catch (e) {
    console.error("extract-document error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
