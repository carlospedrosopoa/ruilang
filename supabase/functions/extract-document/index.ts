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

    const systemPrompt = `Você é um especialista em extração de dados de documentos brasileiros (RG, CNH, CPF, comprovante de endereço, certidão de casamento, etc.).

Extraia todos os dados pessoais encontrados e chame obrigatoriamente a ferramenta com os campos preenchidos.

REGRAS:
- Para CPF, formate como 000.000.000-00
- Para estado civil, use: Solteiro(a), Casado(a), Divorciado(a), Viúvo(a), Separado(a) consensualmente, Separado(a) judicialmente, União Estável
- Para documentoTipo, use apenas "rg" ou "cnh"
- Para estado, use a sigla (SP, RJ, RS, etc.)
- Se o documento for CNH, extraia o número do registro
- Campos não encontrados devem ser string vazia`; 

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

    const models = ["google/gemini-3-flash-preview", "openai/gpt-5-mini"];
    let lastError = "";

    for (const model of models) {
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
        if (response.status === 429) {
          return jsonResponse({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }, 429);
        }
        if (response.status === 402) {
          return jsonResponse({ error: "Créditos insuficientes." }, 402);
        }

        const errorText = await response.text();
        console.error(`AI error with ${model}:`, response.status, errorText);
        lastError = errorText;
        continue;
      }

      const data = await response.json();

      try {
        const extracted = normalizeExtraction(extractToolArguments(data) ?? extractJsonFallback(data));
        return jsonResponse({ dados: extracted });
      } catch (parseError) {
        console.error(`Failed to parse AI response from ${model}:`, data);
        lastError = parseError instanceof Error ? parseError.message : String(parseError);
      }
    }

    console.error("extract-document exhausted models:", lastError);
    throw new Error("Não foi possível extrair dados do documento. Tente com uma imagem mais nítida.");
  } catch (e) {
    console.error("extract-document error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
