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
  if (!raw) return true;
  return raw === "1" || raw === "true" || raw === "yes";
}

async function callOpenAiExtractDocument(params: {
  apiKey: string;
  systemPrompt: string;
  content: any[];
}) {
  const models = [
    Deno.env.get("OPENAI_MODEL_EXTRACT_DOCUMENT") || "gpt-4o",
    Deno.env.get("OPENAI_MODEL_EXTRACT_DOCUMENT_FALLBACK") || "gpt-4o-mini",
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
      if (response.status === 401) {
        const e: any = new Error("Credenciais inválidas. Verifique OPENAI_API_KEY.");
        e.status = 401;
        throw e;
      }
      if (response.status === 429) {
        const e: any = new Error("Limite de requisições excedido. Tente novamente em alguns segundos.");
        e.status = 429;
        throw e;
      }
      if (response.status >= 500) continue;
      throw new Error(`Erro do provedor OpenAI (${response.status})`);
    }

    const data = await response.json();
    try {
      return normalizeExtraction(extractJsonFallback(data));
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
      if (response.status === 401 || response.status === 403) {
        const e: any = new Error("Credenciais inválidas. Verifique GEMINI_API_KEY.");
        e.status = response.status;
        throw e;
      }
      if (response.status === 429) {
        const e: any = new Error("Limite de requisições excedido. Tente novamente em alguns segundos.");
        e.status = 429;
        throw e;
      }
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
    const { images, text } = body ?? {};
    const hasImages = Array.isArray(images) && images.length > 0;
    const hasText = typeof text === "string" && text.trim().length > 0;
    if (!hasImages && !hasText) {
      throw new Error("Envie ao menos uma imagem em base64 ou um texto para extração.");
    }

    if (hasImages) {
      for (const img of images) {
        if (typeof img !== "string" || img.length < 100) {
          throw new Error("Imagem inválida. Certifique-se de enviar fotos nítidas dos documentos.");
        }
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

REGRAS ESPECÍFICAS PARA CNH DIGITAL/FÍSICA:
- Se houver "CARTEIRA NACIONAL DE HABILITAÇÃO", "CNH", "CAT HAB", "Nº REGISTRO" ou layout típico da CNH, documentoTipo DEVE ser "cnh".
- Para CNH, priorize:
  - documentoNumero: campo "Nº REGISTRO" (ou número principal da habilitação).
  - documentoOrgao: órgão emissor/UF visível no documento (ex.: Detran + UF, quando disponível).
- No bloco "FILIAÇÃO" da CNH, normalmente há duas linhas:
  - primeira linha = filiacaoPai
  - segunda linha = filiacaoMae
- Não confunda o nome do titular com filiação. Se filiação estiver legível, não deixar em branco.

FORMATO DE RESPOSTA:
- Retorne APENAS um JSON válido, sem markdown, no formato do schema informado`; 

    const content: any[] = [
      { type: "text", text: "Extraia os dados pessoais destes documentos e preencha a ferramenta com o resultado." },
    ];

    if (hasText) {
      content.push({
        type: "text",
        text: `TEXTO PARA EXTRAÇÃO (pode conter dados digitados/OCR):\n${text.trim()}`,
      });
    }

    if (hasImages) {
      for (const img of images) {
        const mediaType = img.startsWith("JVBERi0") ? "application/pdf" : "image/jpeg";
        content.push({
          type: "image_url",
          image_url: {
            url: `data:${mediaType};base64,${img}`,
          },
        });
      }
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
          userText: hasText
            ? `Extraia os dados pessoais do texto abaixo e retorne apenas o JSON final.\n\n${text.trim()}`
            : "Extraia os dados pessoais destes documentos e retorne apenas o JSON final.",
          images: hasImages ? images : [],
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
    const status = typeof (e as any)?.status === "number" ? (e as any).status : 500;
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, status);
  }
});
