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

function shouldAutoSaveTemplates() {
  const raw = (Deno.env.get("AI_AUTOSAVE_TEMPLATES") || "").toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes";
}

function normalizePerfil(perfil: unknown) {
  const p = typeof perfil === "string" ? perfil.trim() : "";
  return p || "equilibrado";
}

function insertBeforeLocalEData(base: string, addition: string) {
  const markerRegex = /^\s*LOCAL\s+E\s+DATA\b.*$/im;
  const match = markerRegex.exec(base);
  if (!match || match.index < 0) return `${base}\n\n${addition}\n`;
  const idx = match.index;
  return `${base.slice(0, idx).trimEnd()}\n\n${addition}\n\n${base.slice(idx).trimStart()}`;
}

async function getActiveTemplate(admin: any, tipoContrato: string, perfil: string) {
  const { data, error } = await admin
    .from("contract_templates")
    .select("id, template_text, instructions_ia, provider, model, version")
    .eq("tipo_contrato", tipoContrato)
    .eq("perfil", perfil)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function saveTemplate(
  admin: any,
  params: { tipoContrato: string; perfil: string; provider: string; model: string; templateText: string; instructionsIa?: string | null },
) {
  const existing = await admin
    .from("contract_templates")
    .select("version")
    .eq("tipo_contrato", params.tipoContrato)
    .eq("perfil", params.perfil)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (existing.data?.version || 0) + 1;
  await admin.from("contract_templates").insert({
    tipo_contrato: params.tipoContrato,
    perfil: params.perfil,
    provider: params.provider,
    model: params.model,
    version: nextVersion,
    active: true,
    template_text: params.templateText,
    instructions_ia: params.instructionsIa || null,
    updated_at: new Date().toISOString(),
  });
}

async function generatePeculiaridadesText(params: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  tipoLabel: string;
  baseTemplate: string;
  contrato: any;
  peculiaridades: string;
  instructionsIa?: string | null;
}) {
  const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro.

TAREFA:
Gerar APENAS cláusulas adicionais (texto simples) para incorporar PECULIARIDADES em um contrato já existente.

REGRAS:
- NÃO reescreva o contrato base.
- NÃO repita cláusulas já existentes.
- Escreva cláusulas "CLÁUSULA ADICIONAL PRIMEIRA", "CLÁUSULA ADICIONAL SEGUNDA", etc.
- Use linguagem jurídica formal e consistente com o contrato base.
- Gere APENAS o texto das cláusulas adicionais (sem explicações, sem markdown).`;

  const extraInstructions = typeof params.instructionsIa === "string" && params.instructionsIa.trim()
    ? `\n\nINSTRUÇÕES ADICIONAIS (OBRIGATÓRIAS):\n${params.instructionsIa.trim()}\n`
    : "";

  const userPrompt = `CONTRATO BASE (${params.tipoLabel}) - NÃO REESCREVER:
${params.baseTemplate}

DADOS DO CONTRATO (para contexto):
${JSON.stringify(params.contrato, null, 2)}

PECULIARIDADES A INCORPORAR:
${params.peculiaridades}
${extraInstructions}

Gere somente as cláusulas adicionais.`;

  if (params.provider === "openai") {
    return await callOpenAiText({ apiKey: params.apiKey, model: params.model, systemPrompt, userPrompt });
  }
  return await callGeminiText({ apiKey: params.apiKey, model: params.model, systemPrompt, userPrompt });
}

async function renderContractFromTemplate(params: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  tipoLabel: string;
  templateText: string;
  contrato: any;
  instructionsIa?: string | null;
}) {
  const paymentSpec = buildPaymentSpec(params.contrato);
  const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro.

TAREFA:
Usar o MODELO BASE fornecido como referência de redação e estrutura para gerar a MINUTA FINAL do ${params.tipoLabel}.

REGRAS OBRIGATÓRIAS:
- O modelo base é apenas um MODELO. Se ele contiver nomes/CPF/endereço/valores/datas específicos, você DEVE substituir pelos dados fornecidos.
- Em especial, as cláusulas de PREÇO/VALOR e FORMA DE PAGAMENTO devem seguir EXATAMENTE os dados oficiais fornecidos, ignorando quaisquer valores do modelo base.
- Não invente dados. Se um dado não foi fornecido, omita ou ajuste a redação de forma segura, sem placeholders.
- Mantenha a redação e a estrutura do modelo base o máximo possível, alterando apenas o necessário para refletir os dados corretos.
- Garanta coerência total entre todas as cláusulas (valores, prazos, identificação das partes e do imóvel).
- NÃO use markdown. Gere apenas texto simples pronto para assinatura.`;

  const extraInstructions = typeof params.instructionsIa === "string" && params.instructionsIa.trim()
    ? `\n\nINSTRUÇÕES ADICIONAIS (OBRIGATÓRIAS):\n${params.instructionsIa.trim()}\n`
    : "";

  const userPrompt = `MODELO BASE (REFERÊNCIA) - SUBSTITUIR DADOS PELOS INFORMADOS:
${params.templateText}

DADOS DO CONTRATO (OFICIAIS):
${JSON.stringify(params.contrato, null, 2)}

DADOS OFICIAIS DE VALOR/PAGAMENTO (OBRIGATÓRIO):
${paymentSpec}
${extraInstructions}

Gere a minuta final completa usando a estrutura do modelo base, com todos os dados substituídos pelos oficiais.`;

  if (params.provider === "openai") {
    return await callOpenAiText({ apiKey: params.apiKey, model: params.model, systemPrompt, userPrompt });
  }
  return await callGeminiText({ apiKey: params.apiKey, model: params.model, systemPrompt, userPrompt });
}

function buildPaymentSpec(contrato: any) {
  if (!contrato || typeof contrato !== "object") return "";
  if (contrato.tipoContrato === "locacao") {
    const l = contrato.locacao || {};
    const parts: string[] = [];
    parts.push(`TIPO: LOCAÇÃO (${String(l.finalidade || "").toUpperCase() || "N/A"})`);
    if (l.valorAluguel) parts.push(`ALUGUEL: R$ ${String(l.valorAluguel)}`);
    if (l.diaVencimento) parts.push(`DIA DE VENCIMENTO: ${String(l.diaVencimento)}`);
    if (l.prazoMeses) parts.push(`PRAZO: ${String(l.prazoMeses)} meses`);
    if (l.indiceReajuste) parts.push(`ÍNDICE DE REAJUSTE: ${String(l.indiceReajuste)}`);
    if (l.caucao) parts.push(`GARANTIA/CAUÇÃO: ${String(l.caucao)}`);
    if (l.valorCaucao) parts.push(`VALOR DA CAUÇÃO: R$ ${String(l.valorCaucao)}`);
    if (l.multaRescisao) parts.push(`MULTA POR RESCISÃO: ${String(l.multaRescisao)}`);
    return parts.join("\n");
  }

  const p = contrato.pagamento || {};
  const parts: string[] = [];
  parts.push("TIPO: COMPRA E VENDA / CESSÃO (PAGAMENTO)");
  if (p.valorTotal) parts.push(`VALOR TOTAL: R$ ${String(p.valorTotal)}`);
  const parcelas = Array.isArray(p.parcelas) ? p.parcelas : [];
  if (parcelas.length) {
    parts.push("PARCELAS/ENTRADAS/ARRAS:");
    for (const item of parcelas) {
      const tipo = String(item?.tipo || "").toUpperCase();
      const qtd = typeof item?.quantidade === "number" ? item.quantidade : 1;
      const valor = item?.valor ? `R$ ${String(item.valor)}` : "";
      const venc = item?.dataVencimento ? `Vencimento: ${String(item.dataVencimento)}` : "";
      const desc = item?.descricao ? String(item.descricao) : "";
      parts.push(`- ${tipo || "PARCELA"} | Qtde: ${qtd} | Valor: ${valor || "N/A"} | ${venc}${desc ? ` | ${desc}` : ""}`.trim());
    }
  }
  if (p.multaMoratoria) parts.push(`MULTA MORATÓRIA (ATRASO): ${String(p.multaMoratoria)}`);
  if (p.jurosMora) parts.push(`JUROS DE MORA: ${String(p.jurosMora)}`);
  if (p.multaContratual) parts.push(`MULTA CONTRATUAL (INADIMPLEMENTO/RESCISÃO): ${String(p.multaContratual)}`);
  parts.push("REGRA: As parcelas devem ter valores FIXOS e NOMINAIS. Não incluir correção monetária/reajuste de parcelas.");
  return parts.join("\n");
}

function buildPartiesSpec(contrato: any) {
  if (!contrato || typeof contrato !== "object") return "";

  const tipo = String(contrato.tipoContrato || "");
  const labels =
    tipo === "locacao"
      ? { a: "LOCADOR(ES)", b: "LOCATÁRIO(S)" }
      : tipo === "cessao_direitos"
        ? { a: "CEDENTE(S)", b: "CESSIONÁRIO(S)" }
        : { a: "VENDEDOR(ES)", b: "COMPRADOR(ES)" };

  const fmtPessoa = (p: any) => {
    if (!p || typeof p !== "object") return "";
    const lines: string[] = [];
    const nome = String(p.nome || "").trim();
    const cpf = String(p.cpf || "").trim();
    const docTipo = String(p.documentoTipo || "").toUpperCase();
    const docNum = String(p.documentoNumero || "").trim();
    const docOrg = String(p.documentoOrgao || "").trim();
    const prof = String(p.profissao || "").trim();
    const nac = String(p.nacionalidade || "").trim();
    const ec = String(p.estadoCivil || "").trim();
    const reg = String(p.regimeBens || "").trim();
    const end = String(p.endereco || "").trim();
    const bairro = String(p.bairro || "").trim();
    const cidade = String(p.cidade || "").trim();
    const uf = String(p.estado || "").trim();
    const cep = String(p.cep || "").trim();

    if (nome) lines.push(`NOME: ${nome}`);
    if (cpf) lines.push(`CPF: ${cpf}`);
    if (docTipo || docNum || docOrg) lines.push(`DOCUMENTO: ${[docTipo, docNum, docOrg].filter(Boolean).join(" ")}`.trim());
    if (nac) lines.push(`NACIONALIDADE: ${nac}`);
    if (prof) lines.push(`PROFISSÃO: ${prof}`);
    if (ec) lines.push(`ESTADO CIVIL: ${ec}${reg ? ` (${reg})` : ""}`);
    if (end || bairro || cidade || uf || cep) {
      lines.push(`ENDEREÇO: ${[end, bairro, cidade, uf, cep].filter(Boolean).join(" - ")}`.trim());
    }

    const c = p.conjuge;
    if (c && typeof c === "object") {
      const cn = String(c.nome || "").trim();
      const ccpf = String(c.cpf || "").trim();
      const cdocTipo = String(c.documentoTipo || "").toUpperCase();
      const cdocNum = String(c.documentoNumero || "").trim();
      const cdocOrg = String(c.documentoOrgao || "").trim();
      const cprof = String(c.profissao || "").trim();
      const cnac = String(c.nacionalidade || "").trim();
      const cLines: string[] = [];
      if (cn) cLines.push(`NOME: ${cn}`);
      if (ccpf) cLines.push(`CPF: ${ccpf}`);
      if (cdocTipo || cdocNum || cdocOrg) cLines.push(`DOCUMENTO: ${[cdocTipo, cdocNum, cdocOrg].filter(Boolean).join(" ")}`.trim());
      if (cnac) cLines.push(`NACIONALIDADE: ${cnac}`);
      if (cprof) cLines.push(`PROFISSÃO: ${cprof}`);
      if (cLines.length) lines.push(`CÔNJUGE/COMPANHEIRO(A): ${cLines.join(" | ")}`);
    }

    return lines.join(" | ");
  };

  const vendedores = Array.isArray(contrato.vendedores) ? contrato.vendedores : [];
  const compradores = Array.isArray(contrato.compradores) ? contrato.compradores : [];
  const out: string[] = [];
  out.push(labels.a + ":");
  out.push(vendedores.length ? vendedores.map((p: any, idx: number) => `${idx + 1}. ${fmtPessoa(p) || "N/A"}`).join("\n") : "1. N/A");
  out.push("");
  out.push(labels.b + ":");
  out.push(compradores.length ? compradores.map((p: any, idx: number) => `${idx + 1}. ${fmtPessoa(p) || "N/A"}`).join("\n") : "1. N/A");
  return out.join("\n").trim();
}

function buildPropertySpec(contrato: any) {
  if (!contrato || typeof contrato !== "object") return "";

  const fmtImovel = (i: any) => {
    if (!i || typeof i !== "object") return "N/A";
    const parts: string[] = [];
    const loc = String(i.localizacao || "").trim();
    const mun = String(i.municipio || "").trim();
    const uf = String(i.estadoImovel || "").trim();
    const tipo = String(i.tipo || "").trim();
    const desc = String(i.descricao || "").trim();
    const area = String(i.areaTotal || "").trim();
    const mat = String(i.matricula || "").trim();
    const reg = String(i.registroImoveis || "").trim();
    const lote = String(i.lote || "").trim();
    const quadra = String(i.quadra || "").trim();
    const car = String(i.caracteristicas || "").trim();

    if (tipo) parts.push(`TIPO: ${tipo}`);
    if (desc) parts.push(`DESCRIÇÃO: ${desc}`);
    if (loc) parts.push(`LOCALIZAÇÃO: ${loc}`);
    if (mun || uf) parts.push(`MUNICÍPIO/UF: ${[mun, uf].filter(Boolean).join("/")}`);
    if (lote) parts.push(`LOTE: ${lote}`);
    if (quadra) parts.push(`QUADRA: ${quadra}`);
    if (area) parts.push(`ÁREA TOTAL: ${area}`);
    if (mat) parts.push(`MATRÍCULA: ${mat}`);
    if (reg) parts.push(`REGISTRO DE IMÓVEIS: ${reg}`);
    if (car) parts.push(`CARACTERÍSTICAS: ${car}`);
    return parts.join("\n");
  };

  const out: string[] = [];
  out.push("IMÓVEL (OBJETO PRINCIPAL):");
  out.push(fmtImovel(contrato.imovel));

  if (contrato.tipoContrato === "promessa_compra_venda_permuta") {
    out.push("");
    out.push("IMÓVEL DE PERMUTA (SE APLICÁVEL):");
    out.push(fmtImovel(contrato.imovelPermuta));
  }

  return out.join("\n").trim();
}

async function fixCoreDataInContract(params: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  tipoLabel: string;
  contratoText: string;
  contrato: any;
  instructionsIa?: string | null;
}) {
  const partiesSpec = buildPartiesSpec(params.contrato);
  const propertySpec = buildPropertySpec(params.contrato);
  const paymentSpec = buildPaymentSpec(params.contrato);
  const extraInstructions =
    typeof params.instructionsIa === "string" && params.instructionsIa.trim()
      ? `\n\nINSTRUÇÕES ADICIONAIS (OBRIGATÓRIAS):\n${params.instructionsIa.trim()}\n`
      : "";

  const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro.

TAREFA:
Ajustar SOMENTE (1) a qualificação das PARTES, (2) a descrição/identificação do(s) IMÓVEL(IS) objeto do contrato e (3) as cláusulas de VALOR/PREÇO e FORMA DE PAGAMENTO/LOCAÇÃO, para que fiquem 100% coerentes com os dados oficiais.

REGRAS:
- O texto base pode conter dados de exemplo do modelo. IGNORE quaisquer nomes/CPF/endereço/valores/datas do modelo.
- Considere como verdade absoluta somente os DADOS OFICIAIS fornecidos.
- NÃO inventar dados.
- NÃO alterar o restante do contrato (cláusulas que não sejam de partes/imóvel/pagamento).
- Não usar markdown. Retornar o contrato completo (texto final).`;

  const userPrompt = `CONTRATO ATUAL:
${params.contratoText}

DADOS OFICIAIS DAS PARTES (OBRIGATÓRIO):
${partiesSpec}

DADOS OFICIAIS DO(S) IMÓVEL(IS) (OBRIGATÓRIO):
${propertySpec}

DADOS OFICIAIS DE VALOR/PAGAMENTO/LOCAÇÃO (OBRIGATÓRIO):
${paymentSpec}
${extraInstructions}

Retorne o contrato completo com as seções/cláusulas de partes, imóvel e pagamento ajustadas conforme os dados oficiais.`;

  if (params.provider === "openai") {
    return await callOpenAiText({ apiKey: params.apiKey, model: params.model, systemPrompt, userPrompt });
  }
  return await callGeminiText({ apiKey: params.apiKey, model: params.model, systemPrompt, userPrompt });
}

function normalizeForMatch(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function extractDigits(input: string) {
  return input.replace(/\D+/g, "");
}

function getFirstPartyNeedles(contrato: any) {
  const vendedor = Array.isArray(contrato?.vendedores) ? contrato.vendedores[0] : null;
  const comprador = Array.isArray(contrato?.compradores) ? contrato.compradores[0] : null;
  const vendedorNome = typeof vendedor?.nome === "string" ? vendedor.nome.trim() : "";
  const compradorNome = typeof comprador?.nome === "string" ? comprador.nome.trim() : "";
  const vendedorCpf = typeof vendedor?.cpf === "string" ? extractDigits(vendedor.cpf) : "";
  const compradorCpf = typeof comprador?.cpf === "string" ? extractDigits(comprador.cpf) : "";
  return {
    vendedorNome,
    compradorNome,
    vendedorCpf,
    compradorCpf,
  };
}

function hasCriticalDataFromForm(text: string, contrato: any) {
  const needles = getFirstPartyNeedles(contrato);
  const norm = normalizeForMatch(text);
  const digitText = extractDigits(text);

  const mustHave: Array<{ ok: boolean; label: string }> = [];
  if (needles.vendedorNome) mustHave.push({ ok: norm.includes(normalizeForMatch(needles.vendedorNome)), label: "vendedorNome" });
  if (needles.compradorNome) mustHave.push({ ok: norm.includes(normalizeForMatch(needles.compradorNome)), label: "compradorNome" });
  if (needles.vendedorCpf) mustHave.push({ ok: digitText.includes(needles.vendedorCpf), label: "vendedorCpf" });
  if (needles.compradorCpf) mustHave.push({ ok: digitText.includes(needles.compradorCpf), label: "compradorCpf" });
  const missing = mustHave.filter((x) => !x.ok).map((x) => x.label);
  return { ok: missing.length === 0, missing, needles };
}

async function fixPaymentInContract(params: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  tipoLabel: string;
  contratoText: string;
  contrato: any;
}) {
  const paymentSpec = buildPaymentSpec(params.contrato);
  const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro.

TAREFA:
Ajustar SOMENTE as cláusulas relacionadas a VALOR/PREÇO e FORMA DE PAGAMENTO do contrato abaixo, para que fiquem 100% coerentes com os dados oficiais.

REGRAS:
- Não alterar outras cláusulas além das relacionadas a pagamento/valor.
- Se o texto atual tiver valores diferentes do oficial, reescreva integralmente as cláusulas de pagamento para corrigir.
- Não inventar dados.
- Não usar markdown. Retornar o contrato completo (texto final).`;

  const userPrompt = `CONTRATO ATUAL:
${params.contratoText}

DADOS OFICIAIS DE VALOR/PAGAMENTO (OBRIGATÓRIO):
${paymentSpec}

Retorne o contrato completo com as cláusulas de pagamento corrigidas conforme os dados oficiais.`;

  if (params.provider === "openai") {
    return await callOpenAiText({ apiKey: params.apiKey, model: params.model, systemPrompt, userPrompt });
  }
  return await callGeminiText({ apiKey: params.apiKey, model: params.model, systemPrompt, userPrompt });
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
  promessa_compra_venda: "Contrato de Promessa de Compra e Venda de Imóvel",
  promessa_compra_venda_permuta: "Contrato de Promessa de Compra e Venda de Imóvel com Permuta",
  cessao_direitos: "Contrato de Cessão de Direitos Possessórios",
  locacao: "Contrato de Locação de Imóvel",
};

function getClausulasEspecificasTipo(tipo: string): string {
  switch (tipo) {
    case "promessa_compra_venda":
      return `
CLÁUSULAS OBRIGATÓRIAS PARA PROMESSA DE COMPRA E VENDA:
1. OBJETO E DESCRIÇÃO COMPLETA DO IMÓVEL - com dados registrais, matrícula, confrontações, área total (ad corpus ou ad mensuram conforme indicado)
2. PREÇO E FORMA DE PAGAMENTO - discriminar arras confirmatórias (art. 418 CC), sinal, parcelas com valores FIXOS, data de vencimento
3. IMISSÃO NA POSSE - definir momento exato da entrega da posse (precária ou definitiva), estado de conservação, inventário de bens se houver
4. OBRIGAÇÕES DO PROMITENTE VENDEDOR:
   - Outorga de escritura definitiva no prazo estipulado após quitação
   - Apresentar certidões negativas: IPTU, ITR (rural), condomínio, forenses, trabalhistas, fiscais (federal/estadual/municipal), protesto
   - Garantir inexistência de ônus, gravames, penhoras, arrestos, sequestros, ações reais ou pessoais reipersecutórias
   - Responsabilidade por evicção (arts. 447 a 457 CC)
   - Manter o imóvel livre e desembaraçado até a transferência
5. OBRIGAÇÕES DO PROMITENTE COMPRADOR:
   - Pagamento pontual das parcelas
   - Responsabilidade por tributos e encargos a partir da imissão na posse (IPTU, taxas, condomínio)
   - Conservação do imóvel
   - Não ceder direitos sem anuência do vendedor
6. CLÁUSULA PENAL MORATÓRIA - multa por atraso no pagamento (máximo 2% para relações consumeristas, livre para civis)
7. CLÁUSULA PENAL COMPENSATÓRIA - multa por inadimplemento definitivo/rescisão
8. JUROS DE MORA - taxa mensal aplicável
9. PARCELAS FIXAS - todas as parcelas têm valores FIXOS, SEM correção monetária, SEM atualização por qualquer índice. O valor de cada parcela é o valor nominal acordado e não sofre reajuste.
10. CLÁUSULA RESOLUTIVA - expressa ou tácita, com procedimento de notificação extrajudicial (art. 474 CC)
11. IRREVOGABILIDADE E IRRETRATABILIDADE - art. 463 CC
12. DIREITO À ADJUDICAÇÃO COMPULSÓRIA - art. 1.418 CC e Súmula 239 STJ
13. BENFEITORIAS - regime aplicável (necessárias, úteis, voluptuárias) conforme arts. 1.219 a 1.222 CC
14. SUB-ROGAÇÃO E CESSÃO - condições para cessão de direitos a terceiros
15. DESPESAS DE TRANSFERÊNCIA - ITBI, emolumentos cartorários, escritura, registro
16. VÍCIOS REDIBITÓRIOS - prazo e condições (arts. 441 a 446 CC)
17. CASO FORTUITO E FORÇA MAIOR - art. 393 CC
18. LGPD - tratamento de dados pessoais das partes
19. FORO DE ELEIÇÃO - comarca competente
20. DISPOSIÇÕES FINAIS - comunicações, contagem de prazos, integralidade do instrumento`;

    case "promessa_compra_venda_permuta":
      return `
CLÁUSULAS OBRIGATÓRIAS PARA PROMESSA DE COMPRA E VENDA COM PERMUTA:
1. OBJETO DUPLO - descrição detalhada de AMBOS os imóveis com dados registrais completos
2. VALORES - valor de cada imóvel, torna (diferença) a ser paga, forma de pagamento da torna
3. SIMULTANEIDADE - estabelecer se a troca é simultânea ou se há prazos diferenciados
4. TODAS as cláusulas da compra e venda simples (acima)
5. CLÁUSULAS ESPECÍFICAS DA PERMUTA:
   - Regime jurídico da troca (arts. 533 CC - aplicam-se as regras da compra e venda)
   - Evicção recíproca - cada permutante responde pela evicção do imóvel que entregou
   - Estado de conservação de cada imóvel
   - Vistoria prévia e aceite do estado dos imóveis
   - Responsabilidade por débitos anteriores de cada imóvel (IPTU, condomínio, etc.)
   - Tributos - ITBI sobre a torna ou sobre ambos conforme legislação municipal
   - Posse simultânea ou escalonada
   - Garantias recíprocas de propriedade e livre disposição
   - Certidões negativas de AMBOS os imóveis
   - Ônus e gravames de AMBOS os imóveis`;

    case "cessao_direitos":
      return `
CLÁUSULAS OBRIGATÓRIAS PARA CESSÃO DE DIREITOS POSSESSÓRIOS:
1. NATUREZA JURÍDICA - esclarecer que se trata de cessão de direitos possessórios e NÃO de propriedade
2. ORIGEM DA POSSE - descrever como o cedente adquiriu a posse (contrato anterior, ocupação, herança, etc.)
3. CADEIA POSSESSÓRIA - listar toda a cadeia de transmissões anteriores, se houver
4. OBJETO - descrição detalhada do imóvel/terreno com localização, medidas, confrontações
5. DECLARAÇÕES DO CEDENTE:
   - Posse mansa, pacífica e ininterrupta
   - Inexistência de oposição de terceiros
   - Inexistência de ação possessória ou reivindicatória
   - Tempo de posse exercido
   - Benfeitorias realizadas
   - Quitação de tributos e encargos durante a posse
6. GARANTIAS:
   - Responsabilidade do cedente por evicção da posse
   - Compromisso de defesa da posse em caso de turbação ou esbulho por terceiros
   - Obrigação de prestar depoimento em eventual ação de usucapião
7. PREÇO E PAGAMENTO - valor da cessão e forma de pagamento
8. IMISSÃO NA POSSE - momento da transferência
9. USUCAPIÃO - cláusula sobre possibilidade de ação de usucapião pelo cessionário, com compromisso do cedente de colaborar
10. RISCOS - informar expressamente que a cessão não garante propriedade, apenas direitos possessórios
11. CLÁUSULA PENAL - multas por inadimplemento
12. IRREVOGABILIDADE
13. LGPD
14. FORO`;

    case "locacao":
      return `
CLÁUSULAS OBRIGATÓRIAS PARA LOCAÇÃO (Lei 8.245/91):
1. OBJETO - descrição do imóvel, finalidade (residencial/comercial), estado de conservação
2. PRAZO - início, término, condições de renovação
3. ALUGUEL - valor mensal, data de vencimento, forma de pagamento
4. REAJUSTE - índice (IGPM, IPCA, INPC), periodicidade (anual), data-base
5. ENCARGOS DO LOCATÁRIO:
   - IPTU (proporcional ou integral conforme pactuado)
   - Condomínio ordinário
   - Conta de água, luz, gás, internet
   - Seguro contra incêndio (art. 22, VIII da Lei 8.245/91)
   - Taxa de lixo e demais tributos
6. GARANTIA LOCATÍCIA (art. 37 da Lei 8.245/91) - apenas UMA:
   - Caução (até 3 aluguéis - art. 38 §2º)
   - Fiança
   - Seguro fiança
   - Cessão fiduciária de quotas
7. VISTORIA - laudo de vistoria inicial, condições de devolução
8. BENFEITORIAS:
   - Necessárias: indenizáveis (salvo estipulação em contrário)
   - Úteis: indenizáveis se autorizadas previamente
   - Voluptuárias: não indenizáveis, podem ser retiradas sem dano
9. CESSÃO E SUBLOCAÇÃO - vedação ou condições (art. 13)
10. DEVERES DO LOCADOR (art. 22):
   - Entregar o imóvel em condições
   - Garantir uso pacífico
   - Manter forma e destino
   - Responder por vícios anteriores
11. DEVERES DO LOCATÁRIO (art. 23):
   - Pagar pontualmente
   - Usar conforme destinação
   - Restituir no estado recebido
   - Não modificar sem consentimento
   - Permitir vistoria
12. MULTA POR RESCISÃO ANTECIPADA - proporcional ao tempo restante (art. 4º)
13. DIREITO DE PREFERÊNCIA - em caso de venda do imóvel (arts. 27 a 34)
14. DENÚNCIA - prazos e formas conforme art. 46 (prazo determinado) e art. 47 (prazo indeterminado)
15. AÇÃO DE DESPEJO - hipóteses (arts. 9 e 59)
16. RENOVATÓRIA (comercial) - requisitos do art. 51
17. LGPD
18. FORO`;

    default:
      return "";
  }
}

function getPerfilInstrucoes(perfil: string, tipo: string): string {
  const isLocacao = tipo === "locacao";
  const partePrincipal = isLocacao ? "LOCADOR" : "VENDEDOR";
  const parteSecundaria = isLocacao ? "LOCATÁRIO" : "COMPRADOR";

  switch (perfil) {
    case "blindagem_vendedor":
      return isLocacao
        ? `PERFIL: BLINDAGEM MÁXIMA PARA O LOCADOR

DIRETRIZES IMPERATIVAS - aplique TODAS estas proteções:

1. GARANTIA REFORÇADA:
   - Exigir caução de 3 meses de aluguel (máximo legal)
   - Alternativamente, exigir fiador com imóvel quitado na mesma comarca
   - Cláusula de substituição de garantia em caso de insuficiência

2. MULTA RESCISÓRIA AGRAVADA:
   - Multa de 3 aluguéis vigentes em caso de rescisão antecipada pelo locatário
   - SEM redução proporcional ao tempo cumprido (afastar art. 4º quando possível)

3. BENFEITORIAS:
   - PROIBIR qualquer benfeitoria sem autorização EXPRESSA E POR ESCRITO do locador
   - Renúncia expressa ao direito de indenização por benfeitorias úteis e voluptuárias
   - Renúncia ao direito de retenção (art. 35 Lei 8.245/91)

4. VISTORIA E DEVOLUÇÃO:
   - Devolução no EXATO estado da vistoria inicial, sob pena de cobrança integral dos reparos
   - Prazo de 48h para desocupação após notificação por inadimplência

5. REAJUSTE:
   - Índice mais favorável ao locador (IGPM ou IPCA, o que for maior)
   - Cláusula de revisional antecipada se defasagem superior a 20%

6. INADIMPLÊNCIA:
   - Multa moratória de 10% + juros de 1% a.m. + correção monetária
   - Vencimento antecipado de TODAS as obrigações
   - Perda da caução em favor do locador
   - Despejo liminar por falta de pagamento (art. 59, §1º, IX)

7. SOLIDARIEDADE - todos os locatários são solidariamente responsáveis

8. VEDAÇÕES AO LOCATÁRIO:
   - Proibida cessão, sublocação ou empréstimo do imóvel
   - Proibida alteração da destinação
   - Proibida guarda de materiais inflamáveis ou perigosos
   - Proibido uso que perturbe vizinhos`

        : `PERFIL: BLINDAGEM MÁXIMA PARA O ${partePrincipal}

DIRETRIZES IMPERATIVAS - aplique TODAS estas proteções:

1. ARRAS CONFIRMATÓRIAS (art. 418 CC):
   - Em caso de rescisão pelo ${parteSecundaria}, NÃO haverá devolução dos valores pagos a título de arras
   - As arras serão RETIDAS integralmente como pré-fixação de perdas e danos
   - O ${partePrincipal} poderá ainda cobrar indenização suplementar se o prejuízo exceder o valor das arras (art. 419 CC)

2. BENFEITORIAS - VEDAÇÃO TOTAL:
   - PROIBIR qualquer benfeitoria no imóvel até a quitação integral
   - Caso o ${parteSecundaria} realize benfeitorias sem autorização, estas NÃO serão indenizadas em hipótese alguma
   - Todas as benfeitorias aderirão ao imóvel em favor do ${partePrincipal}
   - Renúncia expressa ao direito de retenção por benfeitorias (arts. 1.219 e 1.220 CC)

3. POSSE PRECÁRIA:
   - Conceder apenas posse PRECÁRIA e DIRETA até a quitação integral
   - A posse é exercida a título de COMODATO/TOLERÂNCIA vinculada ao contrato
   - Em hipótese alguma a posse será considerada "ad usucapionem"
   - Proibida cessão, empréstimo ou sublocação da posse a terceiros

4. RESCISÃO PELO ${parteSecundaria}:
   - Perda integral das arras e de TODOS os valores pagos a qualquer título
   - Multa compensatória de 20% a 30% do valor total do contrato
   - Pagamento de aluguel mensal pelo período de ocupação (valor de mercado ou % do valor do imóvel/mês)
   - Indenização por danos ao imóvel
   - Prazo de 30 dias para desocupação sob pena de multa diária

5. CLÁUSULA RESOLUTIVA EXPRESSA:
   - A falta de pagamento de QUALQUER parcela por mais de 30 dias importará na resolução de pleno direito
   - Notificação extrajudicial com prazo de 15 dias para purgação da mora
   - Após o prazo, resolução automática sem necessidade de interpelação judicial

6. CLÁUSULA PENAL MORATÓRIA REFORÇADA:
   - Multa de 10% sobre a parcela em atraso
   - Juros de mora de 1% ao mês
   - As parcelas são de valor FIXO, SEM correção monetária
   - Vencimento antecipado de TODAS as parcelas vincendas

7. MANUTENÇÃO E ENCARGOS:
   - TODAS as despesas de manutenção, conservação e reparos são do ${parteSecundaria} desde a imissão na posse
   - IPTU, taxas, condomínio e quaisquer tributos são do ${parteSecundaria}
   - Seguro do imóvel por conta do ${parteSecundaria}

8. ESCRITURA:
   - Somente após quitação integral de TODAS as obrigações
   - TODAS as despesas (ITBI, emolumentos, certidões, registro) por conta exclusiva do ${parteSecundaria}
   - Prazo de 90 dias após quitação para lavratura da escritura

9. CESSÃO DE DIREITOS:
   - PROIBIDA cessão de direitos pelo ${parteSecundaria} sem anuência EXPRESSA E POR ESCRITO do ${partePrincipal}
   - Em caso de cessão autorizada, o ${parteSecundaria} original permanece solidariamente responsável

10. PROCURAÇÃO IRREVOGÁVEL:
    - O ${parteSecundaria} outorga procuração irrevogável ao ${partePrincipal} para fins de resolução contratual e retomada da posse em caso de inadimplemento`;

    case "blindagem_comprador":
      return isLocacao
        ? `PERFIL: BLINDAGEM MÁXIMA PARA O LOCATÁRIO

DIRETRIZES IMPERATIVAS - aplique TODAS estas proteções:

1. ESTABILIDADE DA LOCAÇÃO:
   - Prazo mínimo de 30 meses (garante denúncia vazia apenas ao final)
   - Renovação automática por prazo indeterminado (art. 46 §1º)
   - Direito de preferência em caso de venda (arts. 27-34) com averbação na matrícula

2. BENFEITORIAS:
   - Direito a indenização por benfeitorias necessárias E úteis
   - Direito de retenção até pagamento (art. 35)
   - Benfeitorias úteis autorizadas previamente de forma ampla

3. MULTA PROPORCIONAL:
   - Multa rescisória proporcional ao tempo restante (art. 4º Lei 8.245/91)
   - SEM multa se a rescisão decorrer de transferência de emprego

4. GARANTIAS DO LOCADOR:
   - Locador declara e garante ser proprietário legítimo
   - Locador apresenta matrícula atualizada e certidões negativas
   - Em caso de venda, novo proprietário deve respeitar o contrato (art. 8º com averbação)

5. MANUTENÇÃO:
   - Reparos estruturais por conta do locador
   - Vícios anteriores à locação por conta do locador
   - Prazo de 48h para reparos emergenciais pelo locador

6. PENALIDADES AO LOCADOR:
   - Multa de 3 aluguéis se retomar o imóvel indevidamente
   - Indenização por lucros cessantes em caso de locação comercial
   - Devolução em dobro de valores cobrados indevidamente

7. RENOVATÓRIA (COMERCIAL):
   - Direito à renovatória (art. 51) com prazo mínimo de 5 anos
   - Proteção ao ponto comercial e fundo de comércio`

        : `PERFIL: BLINDAGEM MÁXIMA PARA O ${parteSecundaria}

DIRETRIZES IMPERATIVAS - aplique TODAS estas proteções:

1. GARANTIA DE ESCRITURA:
   - Em caso de impossibilidade de outorga de escritura pelo ${partePrincipal}, este deverá:
      a) Devolver TODOS os valores pagos
      b) Acrescidos de multa compensatória de 20% do valor total do contrato
      c) Juros legais de 1% ao mês desde a citação
   - Prazo máximo de 30 dias para devolução integral

2. EVICÇÃO INTEGRAL:
   - O ${partePrincipal} assume responsabilidade INTEGRAL e ILIMITADA pela evicção (art. 447 CC)
   - Inclui restituição do preço atualizado, despesas do contrato, custas judiciais, honorários e lucros cessantes
   - Renúncia à limitação do art. 449 CC (evicção parcial)

3. POSSE DEFINITIVA:
   - Posse DEFINITIVA, JUSTA e de BOA-FÉ imediatamente após assinatura do contrato e pagamento do sinal
   - Posse com natureza "ad usucapionem" desde a imissão
   - Direito de uso, gozo, fruição e disposição do imóvel

4. ADJUDICAÇÃO COMPULSÓRIA:
   - Garantia expressa de adjudicação compulsória (art. 1.418 CC)
   - O contrato vale como título para registro e serve de base para adjudicação
   - Referência à Súmula 239 STJ (dispensa registro do compromisso)

5. DIREITO DE RETENÇÃO:
   - Direito de retenção por benfeitorias necessárias e úteis (art. 1.219 CC)
   - Indenização integral por benfeitorias necessárias realizadas
   - Autorização ampla para benfeitorias úteis e necessárias

6. CLÁUSULA PENAL EM FAVOR DO ${parteSecundaria}:
   - Multa de 30% do valor total por descumprimento pelo ${partePrincipal}
   - Multa diária de 0,5% do valor do imóvel por atraso na entrega da posse
   - Multa diária de 0,1% por atraso na outorga de escritura após quitação

8. RESCISÃO PELO ${partePrincipal}:
   - Devolução integral de TODOS os valores pagos
   - Acrescidos de correção monetária e juros
   - Multa compensatória de 20% do valor total
   - Indenização por benfeitorias e acessões
   - Prazo de 180 dias de permanência na posse após notificação

9. IRRETRATABILIDADE REFORÇADA:
   - Contrato irrevogável e irretratável por ambas as partes
   - Cláusula penal em caso de arrependimento do ${partePrincipal}
   - Vedação de venda a terceiros durante a vigência

10. SUCESSÃO:
    - Direitos e obrigações transmissíveis aos herdeiros e sucessores
    - Em caso de falecimento do ${partePrincipal}, herdeiros devem cumprir o contrato`;

    case "equilibrado":
    default:
      return `PERFIL: CONTRATO EQUILIBRADO E JUSTO

DIRETRIZES - aplique equilíbrio em TODAS as cláusulas:

1. ARRAS CONFIRMATÓRIAS (regra padrão do art. 418 CC):
   - Rescisão pelo ${parteSecundaria}: perda das arras em favor do ${partePrincipal}
   - Rescisão pelo ${partePrincipal}: devolução das arras em dobro ao ${parteSecundaria}

2. MULTAS RECÍPROCAS E PROPORCIONAIS:
   - Multa compensatória de 10% do valor total para AMBAS as partes
   - Multa moratória de 2% sobre parcela em atraso
   - Juros de mora de 1% ao mês
   - Parcelas com valores FIXOS, SEM correção monetária por qualquer índice

3. BENFEITORIAS:
   - Necessárias: sempre indenizáveis com direito de retenção
   - Úteis: indenizáveis se previamente autorizadas por escrito
   - Voluptuárias: não indenizáveis, podem ser levantadas sem dano ao imóvel

4. POSSE:
   - Posse provisória vinculada ao contrato após pagamento do sinal
   - Conversão em posse definitiva após quitação integral

5. RESCISÃO COM NOTIFICAÇÃO:
   - Notificação extrajudicial com prazo de 30 dias para purgação da mora
   - Em caso de resolução: devolução dos valores pagos com desconto de 10% a título de cláusula penal e despesas administrativas

6. ENCARGOS REPARTIDOS:
   - ITBI por conta do ${parteSecundaria} (praxe de mercado)
   - Certidões e emolumentos repartidos igualmente
   - Tributos: ${partePrincipal} até a imissão na posse, ${parteSecundaria} após

7. EVICÇÃO:
   - Responsabilidade conforme regras gerais do Código Civil (arts. 447-457)

8. CERTIDÕES:
   - ${partePrincipal} apresenta certidões básicas do imóvel e pessoais
   - Prazo razoável de 30 dias para apresentação

9. ESCRITURA:
   - Outorga em prazo razoável após quitação (60 dias)
   - Despesas de escritura e registro por conta do ${parteSecundaria}

10. BOA-FÉ E FUNÇÃO SOCIAL:
    - Interpretação conforme princípios da boa-fé objetiva (art. 422 CC)
    - Função social do contrato (art. 421 CC)
    - Vedação ao enriquecimento sem causa`;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin =
      SUPABASE_URL && SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE) : null;

    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : authHeader;

    const body = await req.json();
    const { contrato } = body ?? {};
    if (!contrato) throw new Error("Missing 'contrato' in request body");
    const submissionId = typeof body?.submissionId === "string" ? body.submissionId : null;

    let tipoLabel = tipoLabels[contrato.tipoContrato] || "Contrato Imobiliário";
    if (typeof contrato?.tipoContratoNome === "string" && contrato.tipoContratoNome.trim()) {
      tipoLabel = `Contrato - ${contrato.tipoContratoNome.trim()}`;
    } else if (admin && !tipoLabels[contrato.tipoContrato]) {
      const { data } = await admin
        .from("tipos_contrato")
        .select("nome")
        .eq("id", contrato.tipoContrato)
        .maybeSingle();
      if (data?.nome) tipoLabel = `Contrato - ${String(data.nome).trim()}`;
    }
    const clausulasTipo = getClausulasEspecificasTipo(contrato.tipoContrato);
    const perfilSelecionado = contrato.perfilContrato || "equilibrado";
    let perfilTexto = getPerfilInstrucoes(perfilSelecionado, contrato.tipoContrato);
    let perfilInstructionsIa: string | null = null;
    if (!perfilTexto && admin && typeof perfilSelecionado === "string" && perfilSelecionado.length >= 32) {
      const { data } = await admin
        .from("perfis_contrato")
        .select("nome, instructions_ia")
        .eq("id", perfilSelecionado)
        .maybeSingle();
      if (data?.nome) {
        const instr = typeof data.instructions_ia === "string" ? data.instructions_ia.trim() : "";
        perfilInstructionsIa = instr || null;
        perfilTexto = `PERFIL: ${String(data.nome).toUpperCase()}

${instr ? `DIRETRIZES IMPERATIVAS:\n${instr}` : "DIRETRIZES: aplicar o perfil selecionado com coerência em todo o contrato."}`;
      }
    }

    const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro, com mais de 20 anos de experiência na elaboração de minutas contratuais para escritórios de advocacia de alto padrão. Sua tarefa é gerar minutas contratuais COMPLETAS, PROFISSIONAIS e JURIDICAMENTE BLINDADAS.

${perfilTexto}

${clausulasTipo}

REGRAS GERAIS DE REDAÇÃO:
- Linguagem jurídica formal brasileira, precisa e sem ambiguidades
- Usar terminologia técnica correta (promitente vendedor/comprador, cedente/cessionário, locador/locatário)
- Qualificar COMPLETAMENTE todas as partes com TODOS os dados fornecidos (nome, nacionalidade, profissão, estado civil, regime de bens se casado, RG/CNH, CPF, filiação, endereço completo)
- Se houver cônjuge, qualificá-lo como interveniente-anuente
- Numerar as cláusulas: CLÁUSULA PRIMEIRA, CLÁUSULA SEGUNDA, etc.
- Subdividir parágrafos: Parágrafo Primeiro, Parágrafo Segundo ou §1º, §2º
- Incluir alíneas quando necessário: a), b), c)

LEGISLAÇÃO APLICÁVEL (citar quando pertinente):
- Código Civil Brasileiro (Lei 10.406/2002)
- Lei de Registros Públicos (Lei 6.015/73)
- Lei do Inquilinato (Lei 8.245/91) - para locação
- Código de Defesa do Consumidor quando aplicável
- Lei Geral de Proteção de Dados (Lei 13.709/2018)
- Estatuto da Cidade (Lei 10.257/2001) quando aplicável

ESTRUTURA OBRIGATÓRIA DO DOCUMENTO:
1. Título e identificação do tipo de contrato
2. Preâmbulo com qualificação completa de TODAS as partes
3. Cláusulas numeradas cobrindo TODOS os temas listados acima
4. Cláusula LGPD sobre tratamento de dados pessoais
5. Cláusula de foro de eleição
6. Disposições finais (comunicações, prazos, integralidade)
7. Local e data
8. Espaço para assinaturas das partes (com nome completo e CPF abaixo)
9. Espaço para 2 testemunhas (com nome, CPF e assinatura)
10. Aviso: "Este instrumento particular tem força de escritura pública nos termos do art. 462 do Código Civil."
11. Nota final: "RECOMENDA-SE A REVISÃO DESTE INSTRUMENTO POR ADVOGADO DE CONFIANÇA DAS PARTES."

IMPORTANTE: 
- Gere APENAS o texto do contrato, sem comentários ou explicações extras
- O contrato deve estar PRONTO PARA ASSINATURA
- Seja EXTENSO e DETALHADO - um contrato profissional tem no mínimo 5-8 páginas
- NÃO omita cláusulas por brevidade
- NÃO use formatação markdown (asteriscos, hashtags, etc). O texto deve ser PURO, sem nenhum caractere de formatação como *, **, #, ##, ---, etc.
- Use APENAS texto simples com letras maiúsculas para ênfase quando necessário
- Títulos de cláusulas em LETRAS MAIÚSCULAS sem qualquer marcação
- Descreva o imóvel objeto do contrato em um bloco separado identificado por "IMÓVEL:" no início
- REGRA OBRIGATÓRIA SOBRE PARCELAS: Todas as parcelas do contrato têm valores FIXOS e NOMINAIS. NÃO inclua cláusula de correção monetária, atualização ou reajuste das parcelas por qualquer índice (INPC, IGPM, IPCA ou outro). As multas moratórias e compensatórias devem ser mantidas normalmente.

REGRAS DE QUALIDADE E SEGURANÇA:
- NUNCA inventar dados que não foram fornecidos. Se uma informação não foi fornecida, NÃO preencha com dados fictícios.
- NÃO deixar lacunas genéricas como "a definir", "[preencher]" ou "conforme acordo". Use APENAS os dados efetivamente fornecidos.
- Garantir COERÊNCIA TOTAL entre todas as cláusulas do contrato. Valores, prazos, condições e referências a partes devem ser consistentes do início ao fim.
- Quando dados foram extraídos automaticamente de documentos, utilizá-los normalmente, mas NUNCA sobrescrever dados já preenchidos manualmente pelo operador.
- Evitar termos genéricos — ser específico e preciso em todas as cláusulas.`;

    const perfil = normalizePerfil(contrato.perfilContrato);
    const contratoSemPeculiaridades = { ...contrato };
    delete (contratoSemPeculiaridades as any).peculiaridades;

    const userPromptBase = `Gere um ${tipoLabel} completo e profissional com os seguintes dados:

DADOS DO CONTRATO:
${JSON.stringify(contratoSemPeculiaridades, null, 2)}

Gere a minuta completa com TODAS as cláusulas obrigatórias listadas nas instruções, qualificação detalhada das partes com todos os dados fornecidos, e espaço para assinaturas e testemunhas.`;

    const requestedProvider = getProviderFromRequest(body);
    const provider = requestedProvider ?? getDefaultProvider();
    const failover = isFailoverEnabled();

    const tryOrder: AiProvider[] = provider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
    let lastError: unknown = null;
    let minutaBase = "";
    let baseSource: "template" | "custom_modelo_base" | "ai" = "ai";
    let usedProvider: AiProvider = provider;
    let usedModel = "";
    let templateInstructionsIa: string | null = null;

    if (admin) {
      const existingTemplate = await getActiveTemplate(admin, contrato.tipoContrato, perfil);
      if (existingTemplate?.template_text) {
        minutaBase = existingTemplate.template_text;
        baseSource = "template";
      }
      if (typeof existingTemplate?.instructions_ia === "string" && existingTemplate.instructions_ia.trim()) {
        templateInstructionsIa = existingTemplate.instructions_ia;
      }
    }
    if (perfilInstructionsIa) {
      templateInstructionsIa = templateInstructionsIa ? `${templateInstructionsIa}\n\n${perfilInstructionsIa}` : perfilInstructionsIa;
    }

    if (admin && !minutaBase) {
      const { data } = await admin
        .from("tipos_contrato")
        .select("modelo_base, label_vendedor, label_comprador, nome")
        .eq("id", contrato.tipoContrato)
        .maybeSingle();
      const modeloBase = typeof data?.modelo_base === "string" ? data.modelo_base.trim() : "";
      if (modeloBase) {
        minutaBase = modeloBase;
        baseSource = "custom_modelo_base";
        usedProvider = "openai";
        usedModel = "manual";
      }
    }

    for (const p of tryOrder) {
      try {
        if (!minutaBase) {
          if (p === "openai") {
            const key = Deno.env.get("OPENAI_API_KEY");
            if (!key) throw new Error("OPENAI_API_KEY is not configured");
            const models = [
              Deno.env.get("OPENAI_MODEL_CONTRACT") || "gpt-4o-mini",
              Deno.env.get("OPENAI_MODEL_CONTRACT_FALLBACK") || "gpt-4o",
            ];
            let openAiError: unknown = null;
            for (const model of models) {
              try {
                minutaBase = await callOpenAiText({ apiKey: key, model, systemPrompt, userPrompt: userPromptBase });
                usedProvider = "openai";
                usedModel = model;
                baseSource = "ai";
                break;
              } catch (e) {
                openAiError = e;
                const status = (e as any)?.status;
                if (status === 429) continue;
                throw e;
              }
            }
            if (!minutaBase && openAiError) throw openAiError;
          } else {
            const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
            if (!key) throw new Error("GEMINI_API_KEY is not configured");
            const models = [
              Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-1.5-pro",
              Deno.env.get("GEMINI_MODEL_CONTRACT_FALLBACK") || "gemini-1.5-flash",
            ];
            let geminiError: unknown = null;
            for (const model of models) {
              try {
                minutaBase = await callGeminiText({ apiKey: key, model, systemPrompt, userPrompt: userPromptBase });
                usedProvider = "gemini";
                usedModel = model;
                baseSource = "ai";
                break;
              } catch (e) {
                geminiError = e;
                const status = (e as any)?.status;
                if (status === 429 || status === 404) continue;
                throw e;
              }
            }
            if (!minutaBase && geminiError) throw geminiError;
          }
        }
        break;
      } catch (e) {
        lastError = e;
        const status = (e as any)?.status;
        const shouldForceFallback = status === 404;
        if (!failover && !shouldForceFallback) break;
      }
    }

    if (!minutaBase) {
      throw lastError instanceof Error ? lastError : new Error("Erro ao gerar contrato");
    }
    
    // Strip any remaining markdown formatting
    minutaBase = minutaBase.replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/^-{3,}$/gm, "").replace(/`/g, "");

    let baseContrato = minutaBase;
    if (baseSource !== "ai") {
      const tryOrderRender: AiProvider[] = provider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
      let renderError: unknown = null;
      let rendered: string | null = null;
      let renderProvider: AiProvider | null = null;
      let renderModel = "";

      for (const p of tryOrderRender) {
        try {
          if (p === "openai") {
            const key = Deno.env.get("OPENAI_API_KEY");
            if (!key) throw new Error("OPENAI_API_KEY is not configured");
            const models = [
              Deno.env.get("OPENAI_MODEL_CONTRACT_RENDER") || Deno.env.get("OPENAI_MODEL_CONTRACT") || "gpt-4o-mini",
              Deno.env.get("OPENAI_MODEL_CONTRACT_RENDER_FALLBACK") || Deno.env.get("OPENAI_MODEL_CONTRACT_FALLBACK") || "gpt-4o",
            ];
            let openAiError: unknown = null;
            for (const model of models) {
              try {
                rendered = await renderContractFromTemplate({
                  provider: "openai",
                  apiKey: key,
                  model,
                  tipoLabel,
                  templateText: minutaBase,
                  contrato: contratoSemPeculiaridades,
                  instructionsIa: templateInstructionsIa,
                });
                renderProvider = "openai";
                renderModel = model;
                break;
              } catch (e) {
                openAiError = e;
                const status = (e as any)?.status;
                if (status === 429) continue;
                throw e;
              }
            }
            if (rendered === null && openAiError) throw openAiError;
          } else {
            const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
            if (!key) throw new Error("GEMINI_API_KEY is not configured");
            const models = [
              Deno.env.get("GEMINI_MODEL_CONTRACT_RENDER") || Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-1.5-pro",
              Deno.env.get("GEMINI_MODEL_CONTRACT_RENDER_FALLBACK") || Deno.env.get("GEMINI_MODEL_CONTRACT_FALLBACK") || "gemini-1.5-flash",
            ];
            let geminiError: unknown = null;
            for (const model of models) {
              try {
                rendered = await renderContractFromTemplate({
                  provider: "gemini",
                  apiKey: key,
                  model,
                  tipoLabel,
                  templateText: minutaBase,
                  contrato: contratoSemPeculiaridades,
                  instructionsIa: templateInstructionsIa,
                });
                renderProvider = "gemini";
                renderModel = model;
                break;
              } catch (e) {
                geminiError = e;
                const status = (e as any)?.status;
                if (status === 429 || status === 404) continue;
                throw e;
              }
            }
            if (rendered === null && geminiError) throw geminiError;
          }
          break;
        } catch (e) {
          renderError = e;
          const status = (e as any)?.status;
          const shouldForceFallback = status === 404;
          if (!failover && !shouldForceFallback) break;
        }
      }

      if (!rendered) {
        throw renderError instanceof Error ? renderError : new Error("Erro ao aplicar modelo base ao contrato");
      }

      baseContrato = rendered.replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/^-{3,}$/gm, "").replace(/`/g, "");

      if (renderProvider) {
        const tryOrderFix: AiProvider[] = renderProvider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
        let fixed: string | null = null;
        let lastFixErr: unknown = null;
        for (const p of tryOrderFix) {
          try {
            if (p === "openai") {
              const key = Deno.env.get("OPENAI_API_KEY");
              if (!key) throw new Error("OPENAI_API_KEY is not configured");
              const models = [
                Deno.env.get("OPENAI_MODEL_CONTRACT_CORE_FIX") || Deno.env.get("OPENAI_MODEL_CONTRACT_PAYMENT_FIX") || renderModel || Deno.env.get("OPENAI_MODEL_CONTRACT") || "gpt-4o-mini",
                Deno.env.get("OPENAI_MODEL_CONTRACT_CORE_FIX_FALLBACK") || Deno.env.get("OPENAI_MODEL_CONTRACT_PAYMENT_FIX_FALLBACK") || Deno.env.get("OPENAI_MODEL_CONTRACT_FALLBACK") || "gpt-4o",
              ];
              let openAiError: unknown = null;
              for (const model of models) {
                try {
                  fixed = await fixCoreDataInContract({
                    provider: "openai",
                    apiKey: key,
                    model,
                    tipoLabel,
                    contratoText: baseContrato,
                    contrato: contratoSemPeculiaridades,
                    instructionsIa: templateInstructionsIa,
                  });
                  break;
                } catch (e) {
                  openAiError = e;
                  const status = (e as any)?.status;
                  if (status === 429) continue;
                  throw e;
                }
              }
              if (fixed === null && openAiError) throw openAiError;
            } else {
              const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
              if (!key) throw new Error("GEMINI_API_KEY is not configured");
              const models = [
                Deno.env.get("GEMINI_MODEL_CONTRACT_CORE_FIX") || Deno.env.get("GEMINI_MODEL_CONTRACT_PAYMENT_FIX") || Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-1.5-pro",
                Deno.env.get("GEMINI_MODEL_CONTRACT_CORE_FIX_FALLBACK") || Deno.env.get("GEMINI_MODEL_CONTRACT_PAYMENT_FIX_FALLBACK") || Deno.env.get("GEMINI_MODEL_CONTRACT_FALLBACK") || "gemini-1.5-flash",
              ];
              let geminiError: unknown = null;
              for (const model of models) {
                try {
                  fixed = await fixCoreDataInContract({
                    provider: "gemini",
                    apiKey: key,
                    model,
                    tipoLabel,
                    contratoText: baseContrato,
                    contrato: contratoSemPeculiaridades,
                    instructionsIa: templateInstructionsIa,
                  });
                  break;
                } catch (e) {
                  geminiError = e;
                  const status = (e as any)?.status;
                  if (status === 429 || status === 404) continue;
                  throw e;
                }
              }
              if (fixed === null && geminiError) throw geminiError;
            }
            break;
          } catch (e) {
            lastFixErr = e;
            const status = (e as any)?.status;
            const shouldForceFallback = status === 404;
            if (!failover && !shouldForceFallback) break;
          }
        }
        if (fixed && fixed.trim()) {
          baseContrato = fixed.replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/^-{3,}$/gm, "").replace(/`/g, "");
        } else if (lastFixErr) {
          throw lastFixErr instanceof Error ? lastFixErr : new Error("Erro ao ajustar dados principais do contrato");
        }
      }
    } else if (shouldAutoSaveTemplates() && admin && usedModel) {
      const existingTemplate = await getActiveTemplate(admin, contrato.tipoContrato, perfil);
      if (!existingTemplate?.template_text) {
        await saveTemplate(admin, {
          tipoContrato: contrato.tipoContrato,
          perfil,
          provider: usedProvider,
          model: usedModel,
          templateText: minutaBase,
        });
      }
    }

    let minutaFinal = baseContrato;
    const peculiaridades = typeof contrato.peculiaridades === "string" ? contrato.peculiaridades.trim() : "";
    if (peculiaridades) {
      const providerForPec = usedModel ? usedProvider : provider;
      const failover = isFailoverEnabled();
      const tryOrder: AiProvider[] = providerForPec === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
      let extraText: string | null = null;
      let lastPecError: unknown = null;

      for (const p of tryOrder) {
        try {
          if (p === "openai") {
            const key = Deno.env.get("OPENAI_API_KEY");
            if (!key) throw new Error("OPENAI_API_KEY is not configured");
            const models = [
              Deno.env.get("OPENAI_MODEL_CONTRACT_PEC") || Deno.env.get("OPENAI_MODEL_CONTRACT") || "gpt-4o-mini",
              Deno.env.get("OPENAI_MODEL_CONTRACT_PEC_FALLBACK") || Deno.env.get("OPENAI_MODEL_CONTRACT_FALLBACK") || "gpt-4o",
            ];
            let openAiError: unknown = null;
            for (const model of models) {
              try {
                extraText = await generatePeculiaridadesText({
                  provider: "openai",
                  apiKey: key,
                  model,
                  tipoLabel,
                  baseTemplate: baseContrato,
                  contrato: contratoSemPeculiaridades,
                  peculiaridades,
                  instructionsIa: templateInstructionsIa,
                });
                break;
              } catch (e) {
                openAiError = e;
                const status = (e as any)?.status;
                if (status === 429) continue;
                throw e;
              }
            }
            if (extraText === null && openAiError) throw openAiError;
          } else {
            const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
            if (!key) throw new Error("GEMINI_API_KEY is not configured");
            const models = [
              Deno.env.get("GEMINI_MODEL_CONTRACT_PEC") || Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-1.5-flash",
              Deno.env.get("GEMINI_MODEL_CONTRACT_PEC_FALLBACK") || Deno.env.get("GEMINI_MODEL_CONTRACT_FALLBACK") || "gemini-1.5-pro",
            ];
            let geminiError: unknown = null;
            for (const model of models) {
              try {
                extraText = await generatePeculiaridadesText({
                  provider: "gemini",
                  apiKey: key,
                  model,
                  tipoLabel,
                  baseTemplate: baseContrato,
                  contrato: contratoSemPeculiaridades,
                  peculiaridades,
                  instructionsIa: templateInstructionsIa,
                });
                break;
              } catch (e) {
                geminiError = e;
                const status = (e as any)?.status;
                if (status === 429 || status === 404) continue;
                throw e;
              }
            }
            if (extraText === null && geminiError) throw geminiError;
          }
          break;
        } catch (e) {
          lastPecError = e;
          const status = (e as any)?.status;
          const shouldForceFallback = status === 404;
          if (!failover && !shouldForceFallback) break;
        }
      }

      if (extraText === null) {
        throw lastPecError instanceof Error ? lastPecError : new Error("Erro ao gerar peculiaridades");
      }
      if (extraText && extraText.trim()) minutaFinal = insertBeforeLocalEData(baseContrato, extraText.trim());
    }

    if (baseSource !== "ai") {
      const check = hasCriticalDataFromForm(minutaFinal, contratoSemPeculiaridades);
      if (!check.ok) {
        const tryOrderFix: AiProvider[] = provider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
        const strictInstructions = [
          "REPARO CRÍTICO (OBRIGATÓRIO): o contrato ainda contém dados do MODELO BASE. Corrija agora.",
          "Você DEVE substituir integralmente quaisquer nomes/CPF/endereço/valores/datas do modelo pelos dados oficiais.",
          "O texto final DEVE conter (em qualquer lugar):",
          check.needles.vendedorNome ? `- VENDEDOR: ${check.needles.vendedorNome}` : null,
          check.needles.compradorNome ? `- COMPRADOR: ${check.needles.compradorNome}` : null,
          check.needles.vendedorCpf ? `- CPF VENDEDOR: ${check.needles.vendedorCpf}` : null,
          check.needles.compradorCpf ? `- CPF COMPRADOR: ${check.needles.compradorCpf}` : null,
          "Não altere cláusulas que não sejam de partes, imóvel e pagamento/locação.",
        ]
          .filter(Boolean)
          .join("\n");

        let repaired: string | null = null;
        let lastFixErr: unknown = null;
        for (const p of tryOrderFix) {
          try {
            if (p === "openai") {
              const key = Deno.env.get("OPENAI_API_KEY");
              if (!key) throw new Error("OPENAI_API_KEY is not configured");
              const models = [
                Deno.env.get("OPENAI_MODEL_CONTRACT_CORE_FIX") || Deno.env.get("OPENAI_MODEL_CONTRACT") || "gpt-4o-mini",
                Deno.env.get("OPENAI_MODEL_CONTRACT_CORE_FIX_FALLBACK") || Deno.env.get("OPENAI_MODEL_CONTRACT_FALLBACK") || "gpt-4o",
              ];
              let openAiError: unknown = null;
              for (const model of models) {
                try {
                  repaired = await fixCoreDataInContract({
                    provider: "openai",
                    apiKey: key,
                    model,
                    tipoLabel,
                    contratoText: minutaFinal,
                    contrato: contratoSemPeculiaridades,
                    instructionsIa: templateInstructionsIa ? `${templateInstructionsIa}\n\n${strictInstructions}` : strictInstructions,
                  });
                  break;
                } catch (e) {
                  openAiError = e;
                  const status = (e as any)?.status;
                  if (status === 429) continue;
                  throw e;
                }
              }
              if (repaired === null && openAiError) throw openAiError;
            } else {
              const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
              if (!key) throw new Error("GEMINI_API_KEY is not configured");
              const models = [
                Deno.env.get("GEMINI_MODEL_CONTRACT_CORE_FIX") || Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-1.5-pro",
                Deno.env.get("GEMINI_MODEL_CONTRACT_CORE_FIX_FALLBACK") || Deno.env.get("GEMINI_MODEL_CONTRACT_FALLBACK") || "gemini-1.5-flash",
              ];
              let geminiError: unknown = null;
              for (const model of models) {
                try {
                  repaired = await fixCoreDataInContract({
                    provider: "gemini",
                    apiKey: key,
                    model,
                    tipoLabel,
                    contratoText: minutaFinal,
                    contrato: contratoSemPeculiaridades,
                    instructionsIa: templateInstructionsIa ? `${templateInstructionsIa}\n\n${strictInstructions}` : strictInstructions,
                  });
                  break;
                } catch (e) {
                  geminiError = e;
                  const status = (e as any)?.status;
                  if (status === 429 || status === 404) continue;
                  throw e;
                }
              }
              if (repaired === null && geminiError) throw geminiError;
            }
            break;
          } catch (e) {
            lastFixErr = e;
            const status = (e as any)?.status;
            const shouldForceFallback = status === 404;
            if (!failover && !shouldForceFallback) break;
          }
        }

        if (repaired && repaired.trim()) {
          const cleaned = repaired.replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/^-{3,}$/gm, "").replace(/`/g, "");
          const verify = hasCriticalDataFromForm(cleaned, contratoSemPeculiaridades);
          if (!verify.ok) {
            throw new Error("O modelo base contém dados de exemplo e não foi possível substituir automaticamente pelos dados do formulário.");
          }
          minutaFinal = cleaned;
        } else if (lastFixErr) {
          throw lastFixErr instanceof Error ? lastFixErr : new Error("Erro ao ajustar dados principais do contrato");
        } else {
          throw new Error("O modelo base contém dados de exemplo e não foi possível substituir automaticamente pelos dados do formulário.");
        }
      }
    }

    if (admin && submissionId) {
      let userId: string | null = null;
      if (accessToken) {
        const { data: userData } = await admin.auth.getUser(accessToken);
        userId = userData?.user?.id || null;
      }
      await admin
        .from("submissions")
        .update({
          status: "contrato_gerado",
          contract_generated_at: new Date().toISOString(),
          contract_generated_by: userId,
          contract_texto: minutaFinal,
          contract_texto_updated_at: new Date().toISOString(),
          contract_texto_updated_by: userId,
        })
        .eq("id", submissionId);
    }

    return new Response(JSON.stringify({ minuta: minutaFinal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-contract error:", e);
    const status = typeof (e as any)?.status === "number" ? (e as any).status : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
