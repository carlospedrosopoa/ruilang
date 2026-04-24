import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  if (!raw) return true;
  return raw === "1" || raw === "true" || raw === "yes";
}

function getImovelCityUF(dados: any) {
  const imovel = dados?.imovel;
  const cidade = typeof imovel?.municipio === "string" ? imovel.municipio.trim() : "";
  const uf = typeof imovel?.estadoImovel === "string" ? imovel.estadoImovel.trim() : "";
  return { cidade, uf };
}

function formatLongDatePtBR(date: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const year = parts.find((p) => p.type === "year")?.value || "";
  return `${day} de ${month} de ${year}`.trim();
}

function fixLocalEDataInProposalText(text: string, dados: any) {
  const { cidade, uf } = getImovelCityUF(dados);
  if (!cidade) return text;
  const local = uf ? `${cidade}/${uf}` : cidade;
  const dateText = formatLongDatePtBR(new Date());
  const replacement = `${local}, ${dateText}.`;

  const re = /^(\s*Local\s+e\s+Data\s*:\s*).+$/gim;
  if (!re.test(text)) return text;
  return text.replace(re, `$1${replacement}`);
}

async function callOpenAiText(params: { apiKey: string; model: string; systemPrompt: string; userPrompt: string }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      const e: any = new Error("Credenciais inválidas. Verifique OPENAI_API_KEY.");
      e.status = 401;
      throw e;
    }
    if (response.status === 429) {
      const e: any = new Error(`OpenAI (${params.model}) com limite de requisições/tokens excedido. Tente novamente em alguns minutos.`);
      e.status = 429;
      throw e;
    }
    const t = await response.text();
    console.error("AI error:", response.status, t);
    const e: any = new Error(`Erro do provedor OpenAI (${response.status})`);
    e.status = response.status;
    throw e;
  }

  const data = await response.json();
  return (data?.choices?.[0]?.message?.content || "").trim();
}

async function callGeminiText(params: { apiKey: string; model: string; systemPrompt: string; userPrompt: string }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: params.userPrompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const e: any = new Error("Credenciais inválidas. Verifique GEMINI_API_KEY.");
      e.status = response.status;
      throw e;
    }
    if (response.status === 429) {
      const e: any = new Error(`Gemini (${params.model}) com limite de requisições/tokens excedido. Tente novamente em alguns minutos.`);
      e.status = 429;
      throw e;
    }
    if (response.status === 404) {
      const e: any = new Error(`Gemini (${params.model}) não encontrado/disponível neste projeto (404).`);
      e.status = 404;
      throw e;
    }
    const t = await response.text();
    console.error("Gemini error:", response.status, t);
    const e: any = new Error(`Erro do provedor Gemini (${response.status})`);
    e.status = response.status;
    throw e;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") || "";
  return text.trim();
}

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

const defaultModeloBase = `PROPOSTA DE COMPRA DE IMÓVEL
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

Assinatura do Cônjuge`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = SUPABASE_URL && SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE) : null;

    const body = await req.json();
    const { dados, tipoContrato, imobiliaria, imobiliariaId } = body || {};
    if (!dados) throw new Error("Missing 'dados' in request body");

    const tipoLabel = tipoLabels[tipoContrato] || "NEGÓCIO IMOBILIÁRIO";
    const tipoLabelLower = tipoLabelsLower[tipoContrato] || "negócio imobiliário";

    const resolvedImobiliariaId =
      typeof imobiliariaId === "string" && imobiliariaId.trim()
        ? imobiliariaId.trim()
        : typeof imobiliaria?.id === "string" && imobiliaria.id.trim()
          ? imobiliaria.id.trim()
          : null;

    let modeloBase = defaultModeloBase;
    if (admin && resolvedImobiliariaId && typeof tipoContrato === "string" && tipoContrato.trim()) {
      const { data } = await admin
        .from("tipos_proposta")
        .select("modelo_base")
        .eq("imobiliaria_id", resolvedImobiliariaId)
        .eq("codigo", tipoContrato)
        .eq("ativo", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const dbModelo = typeof data?.modelo_base === "string" ? data.modelo_base.trim() : "";
      if (dbModelo) modeloBase = dbModelo;
    }

    const imobInfo = imobiliaria
      ? `\n\nDADOS DA IMOBILIÁRIA (use no cabeçalho da proposta):
- Nome: ${imobiliaria.nome}
- CRECI: ${imobiliaria.creci}
- Responsável: ${imobiliaria.responsavel || "não informado"}
- Endereço: ${imobiliaria.endereco || ""}${imobiliaria.numero ? ", nº " + imobiliaria.numero : ""}${imobiliaria.bairro ? " - " + imobiliaria.bairro : ""}
- Cidade/Estado: ${imobiliaria.cidade}/${imobiliaria.estado}
- Telefone: ${imobiliaria.telefone || "não informado"}`
      : "";

    const tipoLower = String(tipoContrato || "").toLowerCase();
    const roles =
      tipoLower === "locacao"
        ? { proponente: "Locatário (proponente)", alienante: "Locador" }
        : tipoLower === "cessao_direitos"
          ? { proponente: "Cessionário (proponente)", alienante: "Cedente" }
          : { proponente: "Comprador (proponente)", alienante: "Vendedor" };

    const compradores = Array.isArray((dados as any)?.compradores) ? ((dados as any).compradores as any[]) : [];
    const vendedores = Array.isArray((dados as any)?.vendedores) ? ((dados as any).vendedores as any[]) : [];
    const imovel = (dados as any)?.imovel || null;
    const pagamento = (dados as any)?.pagamento || null;
    const locacao = (dados as any)?.locacao || null;

    const pick = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const pessoaResumo = (p: any) => {
      const nome = pick(p?.nome) || pick(p?.nome_completo) || pick(p?.nomeCompleto);
      const cpf = pick(p?.cpf);
      const estadoCivil = pick(p?.estadoCivil);
      const rg = pick(p?.rg);
      const email = pick(p?.email);
      const tel = pick(p?.telefone);
      const end = [pick(p?.endereco), pick(p?.bairro), pick(p?.cidade), pick(p?.estado), pick(p?.cep)].filter(Boolean).join(" • ");
      const parts = [
        nome ? `Nome: ${nome}` : "",
        cpf ? `CPF: ${cpf}` : "",
        rg ? `RG: ${rg}` : "",
        estadoCivil ? `Estado civil: ${estadoCivil}` : "",
        end ? `Endereço: ${end}` : "",
        tel ? `Telefone: ${tel}` : "",
        email ? `E-mail: ${email}` : "",
      ].filter(Boolean);
      return parts.length ? `- ${parts.join(" | ")}` : "- (sem dados)";
    };

    const imovelResumo = () => {
      if (!imovel) return "- (sem dados)";
      const local = pick(imovel?.localizacao);
      const mun = pick(imovel?.municipio);
      const uf = pick(imovel?.estadoImovel);
      const mat = pick(imovel?.matricula);
      const ri = pick(imovel?.registroImoveis);
      const tipo = pick(imovel?.tipoImovel) || pick(imovel?.tipo);
      const parts = [
        tipo ? `Tipo: ${tipo}` : "",
        local ? `Localização: ${local}` : "",
        mun || uf ? `Cidade/UF: ${[mun, uf].filter(Boolean).join("/")}` : "",
        mat ? `Matrícula: ${mat}` : "",
        ri ? `RI: ${ri}` : "",
      ].filter(Boolean);
      return parts.length ? `- ${parts.join(" | ")}` : "- (sem dados)";
    };

    const valoresResumo = () => {
      const out: string[] = [];
      const total = pick(pagamento?.valorTotal);
      if (total) out.push(`- Valor total informado: ${total}`);
      const valorAluguel = pick(locacao?.valorAluguel);
      if (valorAluguel) out.push(`- Valor aluguel informado: ${valorAluguel}`);
      const parcelas = Array.isArray(pagamento?.parcelas) ? (pagamento.parcelas as any[]) : [];
      if (parcelas.length) out.push(`- Parcelas: ${parcelas.length} item(ns) (inclui arras/entrada quando houver)`);
      return out.length ? out.join("\n") : "- (sem dados)";
    };

    const resumoEstruturado = `RESUMO ESTRUTURADO (use para preencher o modelo):
${roles.proponente}:
${compradores.length ? compradores.map(pessoaResumo).join("\n") : "- (sem dados)"}

${roles.alienante}:
${vendedores.length ? vendedores.map(pessoaResumo).join("\n") : "- (sem dados)"}

Imóvel:
${imovelResumo()}

Valores e condições:
${valoresResumo()}`;

    const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro.

Sua tarefa é gerar uma PROPOSTA DE ${tipoLabel} profissional, usando EXATAMENTE o modelo base abaixo como estrutura, mas substituindo todos os dados e exemplos pelos dados oficiais fornecidos.

REGRAS GERAIS (OBRIGATÓRIAS):
- Retorne APENAS o texto final da proposta (sem markdown, sem comentários).
- Não deixe placeholders entre colchetes (ex.: [NOME], [CPF], etc). Tudo deve ser preenchido.
- Se o modelo base contiver lacunas como "____" ou "________", substitua pelas informações disponíveis. Só mantenha "________" quando o dado realmente estiver ausente.
- Se algum dado estiver ausente, use "________" (linha) no lugar, sem inventar.
- Use linguagem jurídica formal.
- Use valores monetários com "R$" e escreva o valor por extenso entre parênteses.
- Adapte os termos conforme o tipo de contrato: locação usa "Locador/Locatário"; cessão usa "Cedente/Cessionário"; permuta menciona imóvel em permuta e torna.
- Na seção "Local e Data", use a cidade/UF mais adequada (preferencialmente do imóvel) e a data do dia (dia/mês por extenso/ano).

MODELO BASE (ESTRUTURA OBRIGATÓRIA):

${modeloBase}

INSTRUÇÕES DE PREENCHIMENTO:
- [IMOBILIARIA_NOME], [IMOBILIARIA_CRECI] e [IMOBILIARIA_ENDERECO] devem ser preenchidos com os dados enviados (se não houver, deixe "________").
- O proponente é, via de regra, o COMPRADOR/LOCATÁRIO/CESSIONÁRIO (conforme o tipo).`;

    const userPrompt = `Gere a Proposta de ${tipoLabel} com os seguintes dados:

DADOS COLETADOS:
${JSON.stringify(dados, null, 2)}

${resumoEstruturado}

Tipo de contrato: ${tipoContrato}
${imobInfo}

Gere a proposta completa conforme o modelo nas instruções, com TODAS as cláusulas e espaços para assinatura.`;

    const requestedProvider = getProviderFromRequest(body);
    const provider = requestedProvider ?? getDefaultProvider();
    const failover = isFailoverEnabled();

    const tryOrder: AiProvider[] = provider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
    let lastError: unknown = null;
    let proposta = "";

    for (const p of tryOrder) {
      try {
        if (p === "openai") {
          const key = Deno.env.get("OPENAI_API_KEY");
          if (!key) throw new Error("OPENAI_API_KEY is not configured");
          const models = [
            Deno.env.get("OPENAI_MODEL_PROPOSAL") || "gpt-4o-mini",
            Deno.env.get("OPENAI_MODEL_PROPOSAL_FALLBACK") || "gpt-4o",
          ];
          let openAiError: unknown = null;
          for (const model of models) {
            try {
              proposta = await callOpenAiText({ apiKey: key, model, systemPrompt, userPrompt });
              break;
            } catch (e) {
              openAiError = e;
              const status = (e as any)?.status;
              if (status === 429) continue;
              throw e;
            }
          }
          if (!proposta && openAiError) throw openAiError;
        } else {
          const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
          if (!key) throw new Error("GEMINI_API_KEY is not configured");
          const models = [
            Deno.env.get("GEMINI_MODEL_PROPOSAL") || "gemini-1.5-flash",
            Deno.env.get("GEMINI_MODEL_PROPOSAL_FALLBACK") || "gemini-1.5-pro",
          ];
          let geminiError: unknown = null;
          for (const model of models) {
            try {
              proposta = await callGeminiText({ apiKey: key, model, systemPrompt, userPrompt });
              break;
            } catch (e) {
              geminiError = e;
              const status = (e as any)?.status;
              if (status === 429 || status === 404) continue;
              throw e;
            }
          }
          if (!proposta && geminiError) throw geminiError;
        }
        break;
      } catch (e) {
        lastError = e;
        const status = (e as any)?.status;
        const shouldForceFallback = status === 404;
        if (!failover && !shouldForceFallback) break;
      }
    }

    if (!proposta) {
      throw lastError instanceof Error ? lastError : new Error("Erro ao gerar proposta");
    }

    proposta = proposta.replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/^-{3,}$/gm, "").replace(/`/g, "");
    proposta = fixLocalEDataInProposalText(proposta, dados);

    return new Response(JSON.stringify({ proposta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-proposal error:", e);
    const status = typeof (e as any)?.status === "number" ? (e as any).status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
