import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

interface ClausulaAncorada {
  id: string;
  titulo: string;
  conteudo: string;
  startIndex: number;
  endIndex: number;
  ordinal?: string;
  numero?: number;
}

interface ResultadoParseAncoras {
  clausulas: ClausulaAncorada[];
  erros: Array<{
    tipo: "id_duplicado" | "id_inexistente" | "tag_sem_fechamento" | "tag_sem_id";
    mensagem: string;
    posicao?: number;
  }>;
  textoLimpo: string;
}

type OpcoesRenderizacao = {
  estiloNumeracao: "ordinal" | "arabico";
  prefixoClausula: string;
};

const DEFAULT_OPCOES_ANCHORS: OpcoesRenderizacao = {
  estiloNumeracao: "ordinal",
  prefixoClausula: "CLÁUSULA",
};

const ORDINAIS = [
  "PRIMEIRA",
  "SEGUNDA",
  "TERCEIRA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SÉTIMA",
  "OITAVA",
  "NONA",
  "DÉCIMA",
  "DÉCIMA PRIMEIRA",
  "DÉCIMA SEGUNDA",
  "DÉCIMA TERCEIRA",
  "DÉCIMA QUARTA",
  "DÉCIMA QUINTA",
  "DÉCIMA SEXTA",
  "DÉCIMA SÉTIMA",
  "DÉCIMA OITAVA",
  "DÉCIMA NONA",
  "VIGÉSIMA",
  "VIGÉSIMA PRIMEIRA",
  "VIGÉSIMA SEGUNDA",
  "VIGÉSIMA TERCEIRA",
  "VIGÉSIMA QUARTA",
  "VIGÉSIMA QUINTA",
  "VIGÉSIMA SEXTA",
  "VIGÉSIMA SÉTIMA",
  "VIGÉSIMA OITAVA",
  "VIGÉSIMA NONA",
  "TRIGÉSIMA",
];

function getOrdinal(numero: number): string {
  return ORDINAIS[numero - 1] || `${numero}ª`;
}

function parseTemplateAncoras(texto: string): ResultadoParseAncoras {
  const clausulas: ClausulaAncorada[] = [];
  const erros: ResultadoParseAncoras["erros"] = [];
  const idsExistentes = new Set<string>();

  const regexAbertura = /<!--\s*CLAUSULA\s+id="([^"]+)"(?:\s+titulo="([^"]*)")?\s*-->/g;
  const regexFechamento = /<!--\s*\/CLAUSULA\s*-->/g;

  let match: RegExpExecArray | null;

  while ((match = regexAbertura.exec(texto)) !== null) {
    const id = match[1].trim();
    const titulo = (match[2] || "").trim();
    const startIndex = match.index;

    if (!id) {
      erros.push({
        tipo: "tag_sem_id",
        mensagem: "Tag de abertura de cláusula sem atributo id",
        posicao: startIndex,
      });
      continue;
    }

    if (idsExistentes.has(id)) {
      erros.push({
        tipo: "id_duplicado",
        mensagem: `ID de cláusula duplicado: "${id}"`,
        posicao: startIndex,
      });
      continue;
    }

    regexFechamento.lastIndex = regexAbertura.lastIndex;
    const matchFechamento = regexFechamento.exec(texto);

    if (!matchFechamento) {
      erros.push({
        tipo: "tag_sem_fechamento",
        mensagem: `Cláusula "${id}" sem tag de fechamento`,
        posicao: startIndex,
      });
      continue;
    }

    const endIndex = matchFechamento.index + matchFechamento[0].length;
    const conteudo = texto.slice(match.index + match[0].length, matchFechamento.index).trim();

    idsExistentes.add(id);
    clausulas.push({
      id,
      titulo: titulo || id.toUpperCase(),
      conteudo,
      startIndex,
      endIndex,
    });
  }

  clausulas.sort((a, b) => a.startIndex - b.startIndex);
  clausulas.forEach((clausula, index) => {
    clausula.numero = index + 1;
    clausula.ordinal = getOrdinal(index + 1);
  });

  const regexRef = /{{(REF|NUM|TITULO):([^}]+)}}/g;
  while ((match = regexRef.exec(texto)) !== null) {
    const idRef = match[2].trim();
    if (!idsExistentes.has(idRef)) {
      erros.push({
        tipo: "id_inexistente",
        mensagem: `Referência a ID inexistente: "${idRef}"`,
        posicao: match.index,
      });
    }
  }

  let textoLimpo = texto;
  for (const clausula of clausulas) {
    const tagAbertura = texto.slice(clausula.startIndex, regexAbertura.lastIndex);
    const tagFechamento = texto.slice(regexFechamento.lastIndex, clausula.endIndex);
    textoLimpo = textoLimpo.replace(tagAbertura, "").replace(tagFechamento, "");
  }

  return { clausulas, erros, textoLimpo };
}

function renderizarTemplate(
  texto: string,
  clausulasOrdenadas: ClausulaAncorada[],
  opcoes: Partial<OpcoesRenderizacao> = {},
): string {
  const opts = { ...DEFAULT_OPCOES_ANCHORS, ...opcoes };
  const mapaClausulas = new Map(clausulasOrdenadas.map((c) => [c.id, c]));

  let resultado = texto;

  for (const clausula of clausulasOrdenadas) {
    const regexAbertura = new RegExp(
      `<!--\\s*CLAUSULA\\s+id="${clausula.id}"(?:\\s+titulo="[^"]*")?\\s*-->`,
      "g",
    );
    const regexFechamento = /<!--\s*\/CLAUSULA\s*-->/g;

    const textoClausula = resultado;
    const matchAbertura = regexAbertura.exec(textoClausula);
    if (matchAbertura) {
      regexFechamento.lastIndex = regexAbertura.lastIndex;
      const matchFechamento = regexFechamento.exec(textoClausula);
      if (matchFechamento) {
        const antes = textoClausula.slice(0, matchAbertura.index);
        const depois = textoClausula.slice(matchFechamento.index + matchFechamento[0].length);

        const tituloClausula =
          opts.estiloNumeracao === "ordinal"
            ? `${opts.prefixoClausula} ${clausula.ordinal} – ${clausula.titulo}`
            : `${opts.prefixoClausula} ${clausula.numero}ª – ${clausula.titulo}`;

        resultado = `${antes}${tituloClausula}\n\n${clausula.conteudo}${depois}`;
      }
    }
  }

  resultado = resultado.replace(/{{(REF|NUM|TITULO):([^}]+)}}/g, (_, tipo, idRef) => {
    const clausula = mapaClausulas.get(String(idRef).trim());
    if (!clausula) return `[REFERÊNCIA QUEBRADA: ${idRef}]`;
    if (tipo === "REF") {
      return opts.estiloNumeracao === "ordinal" ? `Cláusula ${clausula.ordinal}` : `Cláusula ${clausula.numero}ª`;
    }
    if (tipo === "NUM") return String(clausula.numero);
    if (tipo === "TITULO") return clausula.titulo;
    return String(_);
  });

  return resultado;
}

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

function insertBeforeSignatureBlock(base: string, addition: string) {
  const markers: RegExp[] = [
    /^\s*ASSINATURAS\b.*$/im,
    /^\s*ASSINAM\b.*$/im,
    /^\s*ASSINATURA\b.*$/im,
    /^\s*TESTEMUNHAS\b.*$/im,
    /^\s*E\s*,?\s*POR\s+ESTAREM\b.*$/im,
    /^\s*E\s+POR\s+ESTAREM\b.*$/im,
    /^\s*_+\s*$/m,
    /^\s*LOCAL\s+E\s+DATA\b.*$/im,
  ];

  let bestIdx: number | null = null;
  for (const re of markers) {
    const match = re.exec(base);
    if (!match || match.index < 0) continue;
    if (bestIdx === null || match.index < bestIdx) bestIdx = match.index;
  }

  if (bestIdx === null) return `${base}\n\n${addition}\n`;
  return `${base.slice(0, bestIdx).trimEnd()}\n\n${addition}\n\n${base.slice(bestIdx).trimStart()}`;
}

function hasConjugeForRole(list: any[]) {
  const arr = Array.isArray(list) ? list : [];
  return arr.some((p) => Boolean((p as any)?.conjugeDeId) || Boolean((p as any)?.conjuge));
}

function stripUnusedConjugeSignatures(text: string, opts: { vendedor: boolean; comprador: boolean }) {
  const lines = String(text || "").split(/\r?\n/);
  const isUnderline = (s: string) => /^\s*_{5,}\s*$/.test(s);
  const isCpfLine = (s: string) => /^\s*CPF\s*:?/i.test(s);
  const isBlank = (s: string) => !String(s || "").trim();

  const vendRe = /(C[ÔO]NJUGE|COMPANHEIR[OA]).{0,40}(VENDEDOR|PROMITENTE\s+VENDEDOR|CEDENTE|LOCADOR)/i;
  const compRe = /(C[ÔO]NJUGE|COMPANHEIR[OA]).{0,40}(COMPRADOR|PROMITENTE\s+COMPRADOR|CESSION[ÁA]RIO|LOCAT[ÁA]RIO)/i;

  const shouldRemoveLine = (line: string) => {
    if (opts.vendedor && vendRe.test(line)) return true;
    if (opts.comprador && compRe.test(line)) return true;
    return false;
  };

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!shouldRemoveLine(line)) {
      out.push(line);
      continue;
    }

    if (out.length > 0 && isUnderline(out[out.length - 1])) out.pop();

    const next = lines[i + 1];
    if (typeof next === "string" && isCpfLine(next)) i += 1;

    while (out.length > 0 && isBlank(out[out.length - 1])) out.pop();
    while (typeof lines[i + 1] === "string" && isBlank(lines[i + 1])) i += 1;
  }

  return out.join("\n");
}

function formatDocDigits(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return raw;
}

function buildImobiliariaEndereco(row: any) {
  const endereco = String(row?.endereco || "").trim();
  const numero = String(row?.numero || "").trim();
  const bairro = String(row?.bairro || "").trim();
  const cidade = String(row?.cidade || "").trim();
  const estado = String(row?.estado || "").trim();
  const cep = String(row?.cep || "").trim();

  const left = [endereco, numero].filter(Boolean).join(", ");
  const mid = bairro ? ` - ${bairro}` : "";
  const right = [cidade, estado].filter(Boolean).join("/");
  const tail = right ? ` - ${right}` : "";
  const cepPart = cep ? ` - CEP ${cep}` : "";
  const full = `${left}${mid}${tail}${cepPart}`.trim();
  return full;
}

function applyImobiliariaIntermediadora(text: string, row: any, include: boolean) {
  let out = String(text || "");

  const blockRe = /(^|\n)\s*IMOBILI[ÁA]RIA\s+INTERMEDIADORA\s*:[\s\S]*?(?=\n\s*\n|$)/i;
  const hasBlock = blockRe.test(out);

  if (!include) {
    if (hasBlock) out = out.replace(blockRe, "\n");
    out = out.replace(/^\s*IMOBILI[ÁA]RIA\s+INTERMEDIADORA\b.*$/gim, "");
    out = out.replace(/\s*Em\s+conjunto\s+com\s+a\s+IMOBILI[ÁA]RIA[\s\S]{0,200}?\.\s*/i, "\n");
    out = out.replace(/\n{3,}/g, "\n\n");
    return out.trim();
  }

  if (!row || !hasBlock) return out;

  const nome = String(row?.nome || "").trim();
  const cnpj = formatDocDigits(row?.cnpj || "");
  const creci = String(row?.creci || "").trim();
  const endereco = buildImobiliariaEndereco(row);

  const line =
    `IMOBILIÁRIA INTERMEDIADORA: ${nome || "______________________________"}, pessoa jurídica de direito privado, ` +
    `CNPJ n.º ${cnpj || "________________"}, com sede na ${endereco || "______________________________"}, ` +
    `CRECI n.º ${creci || "________________"}, doravante denominada "IMOBILIÁRIA".`;

  out = out.replace(blockRe, `\n${line}\n`);
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

function normalizeDuplicateContractTitle(text: string) {
  const lines = String(text || "").split(/\r?\n/);
  const nonEmpty = lines
    .map((line, index) => ({ line: String(line || "").trim(), index }))
    .filter((x) => x.line)
    .slice(0, 8);

  const contractIdx = nonEmpty.find((x) => /^CONTRATO\s+PARTICULAR\s+DE\b/i.test(x.line))?.index ?? -1;
  const instrumentIdx = nonEmpty.find((x) => /^INSTRUMENTO\s+PARTICULAR\s+DE\b/i.test(x.line))?.index ?? -1;

  if (contractIdx === -1 || instrumentIdx === -1 || contractIdx >= instrumentIdx) return String(text || "").trim();

  lines.splice(contractIdx, 1);
  while (contractIdx < lines.length && !String(lines[contractIdx] || "").trim() && !String(lines[Math.max(0, contractIdx - 1)] || "").trim()) {
    lines.splice(contractIdx, 1);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeLooseName(input: string) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeProcuradorSignatureBlocks(text: string, contrato: any) {
  const procuradores = Array.isArray(contrato?.procuradores) ? contrato.procuradores : [];
  if (!procuradores.length) return text;

  const lines = String(text || "").split(/\r?\n/);
  const signatureStart = Math.max(0, lines.length - 180);
  const isUnderline = (s: string) => /^\s*_{5,}\s*$/.test(String(s || ""));
  const isCpfLine = (s: string) => /^\s*(CPF|CNPJ)\s*:/i.test(String(s || "").trim());
  const isRoleLine = (s: string) =>
    /VENDEDOR|COMPRADOR|PROMITENTE|LOCADOR|LOCAT[ÁA]RIO|CEDENTE|CESSION[ÁA]RIO|C[ÔO]NJUGE|COMPANHEIR/i.test(String(s || "").trim());

  const removeBlockAt = (nameIndex: number) => {
    let start = nameIndex;
    if (start > signatureStart && isUnderline(lines[start - 1])) start -= 1;
    if (start > signatureStart && isRoleLine(lines[start - 1])) start -= 1;
    if (start > signatureStart && isUnderline(lines[start - 1])) start -= 1;

    let end = nameIndex;
    while (end + 1 < lines.length && isCpfLine(lines[end + 1])) end += 1;
    while (end + 1 < lines.length && !String(lines[end + 1] || "").trim()) end += 1;

    lines.splice(start, end - start + 1);
  };

  const findNameIndex = (name: string, cpf?: string, avoid = new Set<number>()) => {
    const normalizedName = normalizeLooseName(name);
    const digits = String(cpf || "").replace(/\D/g, "");
    for (let i = signatureStart; i < lines.length; i++) {
      if (avoid.has(i)) continue;
      const line = String(lines[i] || "").trim();
      if (!line) continue;
      const normLine = normalizeLooseName(line);
      const lineDigits = line.replace(/\D/g, "");
      if (normalizedName && normLine.includes(normalizedName)) return i;
      if (digits && lineDigits.includes(digits)) return i;
    }
    return -1;
  };

  for (const proc of procuradores) {
    const parteTipo = proc?.parteTipo === "comprador" ? "compradores" : "vendedores";
    const partes = Array.isArray((contrato as any)?.[parteTipo]) ? (contrato as any)[parteTipo] : [];
    const parteRepresentada = partes.find((_: any, idx: number) => idx === proc?.parteIndice) || null;
    if (!parteRepresentada) continue;

    const procuradorNome = String(proc?.nomeCompleto || proc?.nome || "").trim();
    if (!procuradorNome) continue;
    const procuradorCpf = String(proc?.cpf || "").trim();

    const conjugeParte = partes.find((p: any) => p && p.conjugeDeId === parteRepresentada.id) || null;
    const mesmoNome = conjugeParte && normalizeLooseName(conjugeParte.nome || "") === normalizeLooseName(procuradorNome);
    const mesmoCpf =
      conjugeParte &&
      String(conjugeParte.cpf || "").replace(/\D/g, "") &&
      String(conjugeParte.cpf || "").replace(/\D/g, "") === String(procuradorCpf || "").replace(/\D/g, "");
    const procuradorEhConjuge = Boolean(conjugeParte && (mesmoNome || mesmoCpf));

    const representedName = String(parteRepresentada.nome || "").trim();
    const replacement = procuradorEhConjuge
      ? `p.p. ${representedName} e por si própria - ${procuradorNome}`
      : `p.p. ${representedName} - ${procuradorNome}`;

    const representedIdx = findNameIndex(representedName, parteRepresentada.cpf);
    const spouseIdx = procuradorEhConjuge ? findNameIndex(String(conjugeParte?.nome || ""), conjugeParte?.cpf) : -1;
    const procuradorIdx = findNameIndex(procuradorNome, procuradorCpf, new Set([representedIdx, spouseIdx]));

    if (procuradorEhConjuge && spouseIdx !== -1) {
      lines[spouseIdx] = replacement;
      if (representedIdx !== -1 && representedIdx !== spouseIdx) removeBlockAt(representedIdx);
      continue;
    }

    if (representedIdx !== -1) {
      lines[representedIdx] = replacement;
      if (representedIdx + 1 < lines.length && isCpfLine(lines[representedIdx + 1])) {
        lines[representedIdx + 1] = procuradorCpf ? `CPF: ${procuradorCpf}` : "";
      }
    }

    if (procuradorIdx !== -1 && procuradorIdx !== representedIdx) {
      removeBlockAt(procuradorIdx);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildLiteralPeculiaridadesClause(peculiaridades: string) {
  const raw = String(peculiaridades || "").trim();
  if (!raw) return "";
  const parts = raw
    .split(/\r?\n+/g)
    .map((x) => x.trim())
    .filter(Boolean);
  const body = parts.length
    ? parts.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : raw;
  return `CLÁUSULA ADICIONAL PRIMEIRA - PECULIARIDADES\n\nAs partes ajustam que:\n${body}`.trim();
}

function normalizeForMatch(input: string) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

const ordinaisClausula = [
  "PRIMEIRA",
  "SEGUNDA",
  "TERCEIRA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SÉTIMA",
  "OITAVA",
  "NONA",
  "DÉCIMA",
  "DÉCIMA PRIMEIRA",
  "DÉCIMA SEGUNDA",
  "DÉCIMA TERCEIRA",
  "DÉCIMA QUARTA",
  "DÉCIMA QUINTA",
  "DÉCIMA SEXTA",
  "DÉCIMA SÉTIMA",
  "DÉCIMA OITAVA",
  "DÉCIMA NONA",
  "VIGÉSIMA",
  "VIGÉSIMA PRIMEIRA",
  "VIGÉSIMA SEGUNDA",
  "VIGÉSIMA TERCEIRA",
  "VIGÉSIMA QUARTA",
  "VIGÉSIMA QUINTA",
  "VIGÉSIMA SEXTA",
  "VIGÉSIMA SÉTIMA",
  "VIGÉSIMA OITAVA",
  "VIGÉSIMA NONA",
  "TRIGÉSIMA",
];

const ordinaisClausulaNormToNum = new Map<string, number>(
  ordinaisClausula.map((o, idx) => [normalizeForMatch(o), idx + 1]),
);

function ordinalByNumber(num: number) {
  if (num < 1) return null;
  return ordinaisClausula[num - 1] || null;
}

function numberByOrdinal(raw: string) {
  const key = normalizeForMatch(raw);
  return ordinaisClausulaNormToNum.get(key) || null;
}

function detectClauseStyle(text: string): "numeric" | "ordinal" | "unknown" {
  const numericRe = /^\s*CL[ÁA]USULA\s+\d+(?:ª|A)?\b/im;
  const ordinalRe = /^\s*CL[ÁA]USULA\s+[A-ZÀ-ÿ]+(?:\s+[A-ZÀ-ÿ]+){0,2}\b/im;
  const n = numericRe.exec(text);
  const o = ordinalRe.exec(text);
  if (n && o) return n.index <= o.index ? "numeric" : "ordinal";
  if (n) return "numeric";
  if (o) return "ordinal";
  return "unknown";
}

function findInsertBeforeClauseIndex(text: string) {
  const linesRe = /^\s*CL[ÁA]USULA[^\n]*$/gim;
  const matches: Array<{ index: number; line: string; number: number | null; style: "numeric" | "ordinal" | "unknown" }> = [];
  for (const m of text.matchAll(linesRe)) {
    const line = m[0];
    const idx = m.index ?? -1;
    if (idx < 0) continue;
    const numeric = line.match(/CL[ÁA]USULA\s+(\d+)(?:ª|A)?\b/i)?.[1];
    const ordinalRaw = line.match(/CL[ÁA]USULA\s+([A-ZÀ-ÿ]+(?:\s+[A-ZÀ-ÿ]+){0,2})\b/i)?.[1] || "";
    const ordNum = ordinalRaw ? numberByOrdinal(ordinalRaw) : null;
    const num = numeric ? Number(numeric) : ordNum;
    const style = numeric ? "numeric" : ordNum ? "ordinal" : "unknown";
    matches.push({ index: idx, line, number: Number.isFinite(num as any) ? (num as any) : null, style });
  }
  if (matches.length === 0) return null;

  const pickByKeyword = (kw: string) => {
    const k = normalizeForMatch(kw);
    return matches.find((m) => normalizeForMatch(m.line).includes(k)) || null;
  };

  return (
    pickByKeyword("FORO") ||
    pickByKeyword("DISPOSIÇÕES FINAIS") ||
    pickByKeyword("DISPOSICOES FINAIS") ||
    pickByKeyword("DISPOSIÇÕES GERAIS") ||
    pickByKeyword("DISPOSICOES GERAIS") ||
    pickByKeyword("LGPD") ||
    null
  );
}

function renumberClauses(text: string, startNumber: number, delta: number) {
  if (!startNumber || !Number.isFinite(startNumber) || delta === 0) return text;
  const style = detectClauseStyle(text);
  if (style === "numeric") {
    return text.replace(/^(\s*CL[ÁA]USULA\s+)(\d+)(ª|A)?/gim, (_m, p1, p2, p3) => {
      const n = Number(p2);
      if (!Number.isFinite(n) || n < startNumber) return `${p1}${p2}${p3 || ""}`;
      return `${p1}${n + delta}${p3 || ""}`;
    });
  }
  if (style === "ordinal") {
    return text.replace(/^(\s*CL[ÁA]USULA\s+)([A-ZÀ-ÿ]+(?:\s+[A-ZÀ-ÿ]+){0,2})\b/gim, (m, p1, p2) => {
      const n = numberByOrdinal(p2);
      if (!n || n < startNumber) return m;
      const next = ordinalByNumber(n + delta);
      if (!next) return m;
      return `${p1}${next}`;
    });
  }
  return text;
}

function buildPeculiaridadesClauseTitle(text: string, clauseNumber: number | null) {
  const style = detectClauseStyle(text);
  const title = "PECULIARIDADES E CONDIÇÕES ESPECIAIS";
  if (style === "numeric" && clauseNumber) return `CLÁUSULA ${clauseNumber}ª – ${title}`;
  if (style === "ordinal" && clauseNumber) {
    const ord = ordinalByNumber(clauseNumber);
    if (ord) return `CLÁUSULA ${ord} – ${title}`;
  }
  return `CLÁUSULA – ${title}`;
}

function buildContratoPreviewForPec(contratoText: string) {
  const text = String(contratoText || "").trim();
  if (!text) return "";
  const cutRe = /^\s*(ASSINATURAS|ASSINAM|ASSINATURA|TESTEMUNHAS|LOCAL\s+E\s+DATA)\b[\s\S]*$/im;
  const head = text.replace(cutRe, "").trim();
  const max = 3500;
  if (head.length <= max) return head;
  const start = head.slice(0, 2000).trimEnd();
  const end = head.slice(-1200).trimStart();
  return `${start}\n\n(...)\n\n${end}`.trim();
}

function getContractCityUF(contrato: any) {
  const imovel = contrato?.imovel;
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

function fixLocalEDataInContractText(text: string, contrato: any) {
  const { cidade, uf } = getContractCityUF(contrato);
  if (!cidade) return text;
  const local = uf ? `${cidade}/${uf}` : cidade;
  const dateText = formatLongDatePtBR(new Date());
  const line = `${local}, ${dateText}.`;

  const markerLineRe = /(^\s*LOCAL\s+E\s+DATA\b[^\n]*\n)([^\n]*)(\n?)/im;
  if (markerLineRe.test(text)) {
    return text.replace(markerLineRe, (_m, p1, _p2, p3) => `${p1}${line}${p3 || "\n"}`);
  }

  const cityDateLongRe = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]+(?:\/[A-Z]{2})?,\s*\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+\s+de\s+\d{4}\b.*$/im;
  if (cityDateLongRe.test(text)) {
    return text.replace(cityDateLongRe, line);
  }

  const cityDateShortRe = /^[A-Za-zÀ-ÿ][^,\n]{2,80},\s*\d{1,2}\/\d{1,2}\/\d{4}\b.*$/im;
  if (cityDateShortRe.test(text)) {
    return text.replace(cityDateShortRe, line);
  }

  return text;
}

async function getActiveTemplate(admin: any, tipoContrato: string, perfil: string, imobiliariaId: string | null) {
  if (imobiliariaId) {
    const tenant = await admin
      .from("contract_templates")
      .select("id, template_text, instructions_ia, provider, model, version")
      .eq("tipo_contrato", tipoContrato)
      .eq("perfil", perfil)
      .eq("imobiliaria_id", imobiliariaId)
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!tenant.error && tenant.data?.template_text) return tenant.data;
  }

  const global = await admin
    .from("contract_templates")
    .select("id, template_text, instructions_ia, provider, model, version")
    .eq("tipo_contrato", tipoContrato)
    .eq("perfil", perfil)
    .is("imobiliaria_id", null)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (global.error) return null;
  return global.data;
}

async function saveTemplate(
  admin: any,
  params: {
    tipoContrato: string;
    perfil: string;
    provider: string;
    model: string;
    templateText: string;
    instructionsIa?: string | null;
    imobiliariaId: string | null;
  },
) {
  const existingQuery = admin
    .from("contract_templates")
    .select("version")
    .eq("tipo_contrato", params.tipoContrato)
    .eq("perfil", params.perfil);
  const existing = await (params.imobiliariaId
    ? existingQuery.eq("imobiliaria_id", params.imobiliariaId)
    : existingQuery.is("imobiliaria_id", null)
  )
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (existing.data?.version || 0) + 1;

  const disableQuery = admin
    .from("contract_templates")
    .update({ active: false })
    .eq("tipo_contrato", params.tipoContrato)
    .eq("perfil", params.perfil);
  await (params.imobiliariaId
    ? disableQuery.eq("imobiliaria_id", params.imobiliariaId)
    : disableQuery.is("imobiliaria_id", null)
  );

  await admin.from("contract_templates").insert({
    imobiliaria_id: params.imobiliariaId,
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
  contratoTextPreview: string;
  contrato: any;
  peculiaridades: string;
  instructionsIa?: string | null;
}) {
  const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro.

TAREFA:
Redigir APENAS o conteúdo de UMA cláusula (texto simples) para incorporar PECULIARIDADES em um contrato já existente.

REGRAS:
- NÃO reescreva o contrato base.
- NÃO repita cláusulas já existentes.
- NÃO escreva o título da cláusula e NÃO escreva "CLÁUSULA ..." no início (o sistema colocará o título e a numeração).
- Escreva o caput e, se necessário, parágrafos e itens.
- Use linguagem jurídica formal e consistente com o contrato base.
- Gere APENAS o texto da cláusula (sem explicações, sem markdown).`;

  const extraInstructions = typeof params.instructionsIa === "string" && params.instructionsIa.trim()
    ? `\n\nINSTRUÇÕES ADICIONAIS (OBRIGATÓRIAS):\n${params.instructionsIa.trim()}\n`
    : "";

  const partiesSpec = buildPartiesSpec(params.contrato);
  const propertySpec = buildPropertySpec(params.contrato);
  const paymentSpec = buildPaymentSpec(params.contrato);

  const userPrompt = `EXCERTO DO CONTRATO (${params.tipoLabel}) - APENAS PARA TOM DE REDAÇÃO (NÃO REESCREVER):
${params.contratoTextPreview}

DADOS DO CONTRATO (para contexto):
${partiesSpec}

${propertySpec}

${paymentSpec}

PECULIARIDADES A INCORPORAR:
${params.peculiaridades}
${extraInstructions}

Gere somente o texto da cláusula (sem título e sem numeração de cláusula).`;

  if (params.provider === "openai") {
    return await callOpenAiText({ apiKey: params.apiKey, model: params.model, systemPrompt, userPrompt });
  }
  return await callGeminiText({ apiKey: params.apiKey, model: params.model, systemPrompt, userPrompt });
}

async function integratePeculiaridadesInContract(params: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  tipoLabel: string;
  contratoText: string;
  contrato: any;
  peculiaridades: string;
  instructionsIa?: string | null;
}) {
  const extraInstructions = typeof params.instructionsIa === "string" && params.instructionsIa.trim()
    ? `\n\nINSTRUÇÕES ADICIONAIS (OBRIGATÓRIAS):\n${params.instructionsIa.trim()}\n`
    : "";

  const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro, com 20 anos de experiência em estruturação de negócios complexos (compra e venda, incorporação e locação), meticuloso e com profundo conhecimento do Código Civil, da Lei de Registros Públicos e da jurisprudência do STJ.

TAREFA:
Integrar PECULIARIDADES no CONTRATO abaixo, inserindo-as no LOCAL CORRETO do corpo do contrato (conforme o contexto), sem colocar nada após as assinaturas.

REGRAS:
- Retorne o CONTRATO COMPLETO já com as inserções.
- NÃO use markdown.
- NÃO invente dados.
- NÃO altere nomes/CPFs/endereço das partes, descrição do imóvel, valores ou forma de pagamento já definidos no contrato (apenas adicione regras/obrigações relacionadas às peculiaridades).
- Você recebe um MODELO BASE já convertido em contrato e uma lista de PECULIARIDADES. Para CADA peculiaridade, você DEVE decidir o MODO de inserção:
  1. INTEGRAÇÃO_EM_CLAUSULA_EXISTENTE: quando a peculiaridade modifica, complementa ou substitui parte de uma cláusula já existente; aplique a alteração diretamente nessa cláusula.
  2. CLAUSULA_NOVA: quando a peculiaridade trata de assunto não coberto pelo contrato; crie nova cláusula com título descritivo e juridicamente coerente, posicionada no ponto semanticamente adequado.
- Para cada peculiaridade, escolha a seção/cláusula adequada (ex.: objeto/obrigações/vistoria/posse/encargos/benfeitorias/condomínio/limpeza/devolução/representação/pagamento).
- Priorize INTEGRAÇÃO_EM_CLAUSULA_EXISTENTE como primeira opção. Só use CLAUSULA_NOVA quando o tema realmente não estiver coberto.
- Ao criar CLAUSULA_NOVA, é PROIBIDO usar títulos genéricos como "PECULIARIDADES", "PECULIARIDADES E CONDIÇÕES ESPECIAIS" ou equivalentes. Use sempre título descritivo específico, por exemplo: "DA REPRESENTAÇÃO POR PROCURAÇÃO", "DA FORMA DE PAGAMENTO ESPECIAL", "DA POSSE ANTECIPADA", "DA ENTREGA DE DOCUMENTOS".
- Normalize o texto de cada peculiaridade: corrija ortografia, pontuação e concordância e reescreva tudo em linguagem jurídica formal, SEM alterar o significado material do que o usuário informou.
- NUNCA copie literalmente o texto do usuário para dentro do contrato. SEMPRE produza uma versão processada, técnica e juridicamente formal.
- É PROIBIDO criar uma cláusula avulsa/final de "PECULIARIDADES" ao final do contrato.
- Se uma peculiaridade envolver representação por procuração, o bloco final de assinaturas deve refletir isso: a parte representada não assina separadamente; deve constar apenas "p.p. [NOME DA PARTE REPRESENTADA] - [NOME DO PROCURADOR]". Se o procurador for o próprio cônjuge/companheiro(a) que já assina como parte plena, usar uma única linha: "p.p. [NOME DA PARTE REPRESENTADA] e por si própria - [NOME DO CÔNJUGE PROCURADOR]".
- Priorize inserir como subcláusula/item dentro de cláusula existente (ex.: itens 1.1, 1.2, parágrafos ou alíneas), mantendo a numeração consistente e evitando renumeração desnecessária.
- Se for inevitável criar uma nova cláusula, insira no ponto correto e ajuste a numeração subsequente de forma consistente com o estilo do documento.
- COERÊNCIA INTERNA OBRIGATÓRIA: sempre que uma peculiaridade alterar uma cláusula, revise as demais cláusulas relacionadas e ajuste referências, premissas, consequências e condições para eliminar contradições.
- Exemplos de coerência interna:
  1. Se a forma de pagamento mudar de parcelado para parcela única na escritura, revise também cláusulas de inadimplemento de parcelas, juros de mora por parcela e vencimento antecipado.
  2. Se uma parte atuar por procuração, revise cláusulas boilerplate sobre procuração ou assinatura pessoal que se tornem incompatíveis.
- Faça internamente um rastreio dos ajustes em cadeia necessários antes de responder, mas RETORNE APENAS o contrato final, sem comentários, sem explicações e sem log aparente ao usuário.
- As inserções devem ter redação jurídica e se harmonizar com o texto existente.${extraInstructions}`;

  const userPrompt = `CONTRATO (${params.tipoLabel}):
${params.contratoText}

DADOS DO CONTRATO (para contexto; não inventar nada além disso):
${JSON.stringify(params.contrato, null, 2)}

PECULIARIDADES (OBRIGATÓRIO integrar no lugar correto):
${params.peculiaridades}

Retorne o contrato completo com as peculiaridades integradas no corpo do texto (não no final após assinaturas).`;

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
- Se o modelo base trouxer dois títulos consecutivos no topo, mantenha APENAS "INSTRUMENTO PARTICULAR DE ..." e descarte o título genérico duplicado.
- Se houver representação por procurador, o bloco final de assinaturas deve trazer apenas "p.p. [PARTE REPRESENTADA] - [PROCURADOR]"; a parte representada não assina separadamente. Se o procurador for o cônjuge/companheiro(a) que também é parte plena, use uma única linha: "p.p. [PARTE REPRESENTADA] e por si própria - [PROCURADOR]".
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

function buildProcuradorSpec(procurador: any, parteNome: string) {
  if (!procurador || typeof procurador !== "object") return "";
  const lines: string[] = [];
  
  lines.push(`REPRESENTANTE: ${parteNome}`);
  
  const nome = String(procurador.nomeCompleto || procurador.nome || "").trim();
  if (nome) lines.push(`NOME: ${nome}`);
  
  const cpf = String(procurador.cpf || "").trim();
  if (cpf) lines.push(`CPF: ${cpf}`);
  
  const cnpj = String(procurador.cnpj || "").trim();
  if (cnpj) lines.push(`CNPJ: ${cnpj}`);
  
  const docTipo = String(procurador.tipoDocumento || "").toUpperCase();
  const docNum = String(procurador.numeroDocumento || "").trim();
  const docOrg = String(procurador.orgaoExpedidor || "").trim();
  if (docTipo || docNum || docOrg) lines.push(`DOCUMENTO: ${[docTipo, docNum, docOrg].filter(Boolean).join(" ")}`.trim());
  
  const prof = String(procurador.profissao || "").trim();
  if (prof) lines.push(`PROFISSÃO: ${prof}`);
  
  const nac = String(procurador.nacionalidade || "").trim();
  if (nac) lines.push(`NACIONALIDADE: ${nac}`);
  
  const ec = String(procurador.estadoCivil || "").trim();
  const reg = String(procurador.regimeBens || "").trim();
  if (ec) lines.push(`ESTADO CIVIL: ${ec}${reg ? ` (${reg})` : ""}`);
  
  const end = String(procurador.enderecoCompleto || procurador.endereco || "").trim();
  const bairro = String(procurador.bairro || "").trim();
  const cidade = String(procurador.cidade || "").trim();
  const uf = String(procurador.estado || "").trim();
  const cep = String(procurador.cep || "").trim();
  if (end || bairro || cidade || uf || cep) {
    lines.push(`ENDEREÇO: ${[end, bairro, cidade, uf, cep].filter(Boolean).join(" - ")}`.trim());
  }

  const tipoProc = String(procurador.tipoProcuracao || "").trim();
  if (tipoProc) {
    const tipoProcLabel = tipoProc === "publica" ? "Pública" : 
                          tipoProc === "particular_com_firma" ? "Particular com firma reconhecida" : 
                          tipoProc === "particular_sem_firma" ? "Particular sem firma" : tipoProc;
    lines.push(`TIPO DE PROCURAÇÃO: ${tipoProcLabel}`);
  }
  
  const dataProc = procurador.dataProcuracao ? 
    (typeof procurador.dataProcuracao === "string" ? procurador.dataProcuracao : new Date(procurador.dataProcuracao).toLocaleDateString("pt-BR")) : "";
  if (dataProc) lines.push(`DATA DA PROCURAÇÃO: ${dataProc}`);
  
  const cartorio = String(procurador.cartorioLivroFolha || "").trim();
  if (cartorio) lines.push(`CARTÓRIO/LIVRO/FOLHA: ${cartorio}`);
  
  const poderes = String(procurador.poderesOutorgados || "").trim();
  if (poderes) lines.push(`PODERES OUTORGADOS: ${poderes}`);

  return lines.join("\n");
}

function buildAnuenteSpec(anuente: any) {
  if (!anuente || typeof anuente !== "object") return "";
  const lines: string[] = [];
  
  const nome = String(anuente.nomeCompleto || anuente.nome || "").trim();
  if (nome) lines.push(`NOME: ${nome}`);
  
  const cpf = String(anuente.cpf || "").trim();
  if (cpf) lines.push(`CPF: ${cpf}`);
  
  const cnpj = String(anuente.cnpj || "").trim();
  if (cnpj) lines.push(`CNPJ: ${cnpj}`);
  
  const docTipo = String(anuente.tipoDocumento || "").toUpperCase();
  const docNum = String(anuente.numeroDocumento || "").trim();
  const docOrg = String(anuente.orgaoExpedidor || "").trim();
  if (docTipo || docNum || docOrg) lines.push(`DOCUMENTO: ${[docTipo, docNum, docOrg].filter(Boolean).join(" ")}`.trim());
  
  const prof = String(anuente.profissao || "").trim();
  if (prof) lines.push(`PROFISSÃO: ${prof}`);
  
  const nac = String(anuente.nacionalidade || "").trim();
  if (nac) lines.push(`NACIONALIDADE: ${nac}`);
  
  const ec = String(anuente.estadoCivil || "").trim();
  const reg = String(anuente.regimeBens || "").trim();
  if (ec) lines.push(`ESTADO CIVIL: ${ec}${reg ? ` (${reg})` : ""}`);
  
  const end = String(anuente.enderecoCompleto || anuente.endereco || "").trim();
  const bairro = String(anuente.bairro || "").trim();
  const cidade = String(anuente.cidade || "").trim();
  const uf = String(anuente.estado || "").trim();
  const cep = String(anuente.cep || "").trim();
  if (end || bairro || cidade || uf || cep) {
    lines.push(`ENDEREÇO: ${[end, bairro, cidade, uf, cep].filter(Boolean).join(" - ")}`.trim());
  }

  const qualif = String(anuente.qualificacaoNoNegocio || "").trim();
  if (qualif) {
    const qualifLabel = qualif === "conjuge_meeiro" ? "Cônjuge meeiro" : 
                        qualif === "ex_conjuge" ? "Ex-cônjuge" : 
                        qualif === "herdeiro" ? "Herdeiro" : 
                        qualif === "condomino" ? "Condômino" : 
                        qualif === "fiador" ? "Fiador" : 
                        qualif === "interveniente_garantidor" ? "Interveniente garantidor" : 
                        qualif === "outro" ? "Outro" : qualif;
    lines.push(`QUALIFICAÇÃO NO NEGÓCIO: ${qualifLabel}`);
  }
  
  if (qualif === "outro") {
    const qualifOutro = String(anuente.qualificacaoOutro || "").trim();
    if (qualifOutro) lines.push(`ESPECIFICAR: ${qualifOutro}`);
  }
  
  const motivo = String(anuente.motivoAnuencia || "").trim();
  if (motivo) lines.push(`MOTIVO DA ANUÊNCIA: ${motivo}`);
  
  const assina = typeof anuente.assinaContrato === "boolean" ? anuente.assinaContrato : true;
  lines.push(`ASSINA O CONTRATO: ${assina ? "SIM" : "NÃO"}`);

  return lines.join("\n");
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

  const fmtPessoa = (p: any, isConjuge: boolean = false) => {
    if (!p || typeof p !== "object") return "";
    const lines: string[] = [];
    const nome = String(p.nome || "").trim();
    const cpf = String(p.cpf || "").trim();
    const cnpj = String(p.cnpj || "").trim();
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
    if (cnpj) lines.push(`CNPJ: ${cnpj}`);
    if (docTipo || docNum || docOrg) lines.push(`DOCUMENTO: ${[docTipo, docNum, docOrg].filter(Boolean).join(" ")}`.trim());
    if (nac) lines.push(`NACIONALIDADE: ${nac}`);
    if (prof) lines.push(`PROFISSÃO: ${prof}`);
    if (ec && !isConjuge) lines.push(`ESTADO CIVIL: ${ec}${reg ? ` (${reg})` : ""}`);
    if (end || bairro || cidade || uf || cep) {
      lines.push(`ENDEREÇO: ${[end, bairro, cidade, uf, cep].filter(Boolean).join(" - ")}`.trim());
    }

    return lines.join(" | ");
  };

  const vendedores = Array.isArray(contrato.vendedores) ? contrato.vendedores : [];
  const compradores = Array.isArray(contrato.compradores) ? contrato.compradores : [];
  const procuradores = Array.isArray(contrato.procuradores) ? contrato.procuradores : [];
  const anuentes = Array.isArray(contrato.anuentes) ? contrato.anuentes : [];
  const out: string[] = [];
  
  out.push(labels.a + ":");
  let idxA = 1;
  for (const p of vendedores) {
    const formatted = fmtPessoa(p, !!p.conjugeDeId);
    if (formatted) {
      out.push(`${idxA}. ${formatted}`);
      idxA++;
    }
  }
  if (idxA === 1) out.push("1. N/A");
  
  out.push("");
  
  out.push(labels.b + ":");
  let idxB = 1;
  for (const p of compradores) {
    const formatted = fmtPessoa(p, !!p.conjugeDeId);
    if (formatted) {
      out.push(`${idxB}. ${formatted}`);
      idxB++;
    }
  }
  if (idxB === 1) out.push("1. N/A");
  
  if (procuradores.length > 0) {
    out.push("");
    out.push("PROCURADORES:");
    for (let i = 0; i < procuradores.length; i++) {
      const proc = procuradores[i];
      const parteTipo = proc.parteTipo === "vendedor" ? labels.a.replace(/\(ES\)$/, "") : labels.b.replace(/\(ES\)$/, "");
      const partes = proc.parteTipo === "vendedor" ? vendedores : compradores;
      const partePrincipal = partes.find((_, idx) => idx === proc.parteIndice);
      const parteNome = partePrincipal?.nome || `${parteTipo} ${(proc.parteIndice || 0) + 1}`;
      const spec = buildProcuradorSpec(proc, parteNome);
      if (spec) {
        out.push(`${i + 1}. ${spec}`);
      }
    }
  }
  
  if (anuentes.length > 0) {
    out.push("");
    out.push("ANUENTES:");
    for (let i = 0; i < anuentes.length; i++) {
      const anu = anuentes[i];
      const spec = buildAnuenteSpec(anu);
      if (spec) {
        out.push(`${i + 1}. ${spec}`);
      }
    }
  }
  
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
- Não usar markdown. Retornar o contrato completo (texto final).

IMPORTANTE SOBRE PARTES:
- TODAS as pessoas listadas em "DADOS OFICIAIS DAS PARTES" são PARTES PLENAS do contrato, incluindo cônjuges/companheiros(as).
- DEVE qualificar TODAS essas partes no preâmbulo do contrato.
- DEVE incluir espaço para assinatura de TODAS essas partes no final do contrato.

`;


  const userPrompt = `CONTRATO ATUAL:

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

function normalizeForLooseMatch(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function extractDigits(input: string) {
  return input.replace(/\D+/g, "");
}

function getPartyNeedles(contrato: any) {
  const vendedores = Array.isArray(contrato?.vendedores) ? contrato.vendedores : [];
  const compradores = Array.isArray(contrato?.compradores) ? contrato.compradores : [];
  
  const vendedoresNeedles = vendedores.map(p => ({
    nome: typeof p?.nome === "string" ? p.nome.trim() : "",
    doc: typeof p?.cnpj === "string" && p.cnpj.trim()
      ? extractDigits(p.cnpj)
      : typeof p?.cpf === "string"
        ? extractDigits(p.cpf)
        : ""
  })).filter(x => x.nome || x.doc);
  
  const compradoresNeedles = compradores.map(p => ({
    nome: typeof p?.nome === "string" ? p.nome.trim() : "",
    doc: typeof p?.cnpj === "string" && p.cnpj.trim()
      ? extractDigits(p.cnpj)
      : typeof p?.cpf === "string"
        ? extractDigits(p.cpf)
        : ""
  })).filter(x => x.nome || x.doc);
  
  return { vendedoresNeedles, compradoresNeedles };
}

function hasCriticalDataFromForm(text: string, contrato: any) {
  const needles = getPartyNeedles(contrato);
  const norm = normalizeForLooseMatch(text);
  const digitText = extractDigits(text);

  const mustHave: Array<{ ok: boolean; label: string }> = [];
  
  for (let i = 0; i < needles.vendedoresNeedles.length; i++) {
    const v = needles.vendedoresNeedles[i];
    if (v.nome) mustHave.push({ ok: norm.includes(normalizeForLooseMatch(v.nome)), label: `vendedor${i}Nome` });
    if (v.doc) mustHave.push({ ok: digitText.includes(v.doc), label: `vendedor${i}Doc` });
  }
  
  for (let i = 0; i < needles.compradoresNeedles.length; i++) {
    const c = needles.compradoresNeedles[i];
    if (c.nome) mustHave.push({ ok: norm.includes(normalizeForLooseMatch(c.nome)), label: `comprador${i}Nome` });
    if (c.doc) mustHave.push({ ok: digitText.includes(c.doc), label: `comprador${i}Doc` });
  }
  
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
    const imobiliariaIdFromBody = typeof body?.imobiliariaId === "string" ? body.imobiliariaId : null;

    let submissionImobiliariaId: string | null = null;
    if (admin && submissionId) {
      const { data } = await admin.from("submissions").select("imobiliaria_id").eq("id", submissionId).maybeSingle();
      submissionImobiliariaId = (data as any)?.imobiliaria_id || null;
    }
    const templateImobiliariaId = submissionImobiliariaId || imobiliariaIdFromBody;
    const constarImobiliariaRaw = (contrato as any)?.constarImobiliaria;
    const constarImobiliaria =
      typeof constarImobiliariaRaw === "boolean" ? constarImobiliariaRaw : true;

    let imobiliariaRow: any = null;
    if (admin && templateImobiliariaId && constarImobiliaria) {
      const { data } = await admin
        .from("imobiliarias")
        .select("id, nome, creci, cnpj, endereco, numero, bairro, cidade, estado, cep")
        .eq("id", templateImobiliariaId)
        .maybeSingle();
      imobiliariaRow = data || null;
    }

    let tipoLabel = tipoLabels[contrato.tipoContrato] || "Contrato Imobiliário";
    let tipoContratoLabels = contrato.tipoContratoLabels || null;
    
    if (typeof contrato?.tipoContratoNome === "string" && contrato.tipoContratoNome.trim()) {
      tipoLabel = `Contrato - ${contrato.tipoContratoNome.trim()}`;
    } else if (admin && !tipoLabels[contrato.tipoContrato]) {
      const { data } = await admin
        .from("tipos_contrato")
        .select("nome, label_parte_a, label_parte_b, label_parte_a_plural, label_parte_b_plural, partes_simetricas, label_objeto, label_acao")
        .eq("id", contrato.tipoContrato)
        .maybeSingle();
      if (data?.nome) tipoLabel = `Contrato - ${String(data.nome).trim()}`;
      if (data && !tipoContratoLabels) {
        tipoContratoLabels = {
          nome: data.nome,
          label_parte_a: data.label_parte_a || "Vendedor",
          label_parte_b: data.label_parte_b || "Comprador",
          label_parte_a_plural: data.label_parte_a_plural || "Vendedores",
          label_parte_b_plural: data.label_parte_b_plural || "Compradores",
          partes_simetricas: data.partes_simetricas || false,
          label_objeto: data.label_objeto || "Imóvel",
          label_acao: data.label_acao || "compra e venda",
        };
      }
    }
    
    if (!tipoContratoLabels) {
      const builtinTipo = tipoLabels[contrato.tipoContrato] ? contrato.tipoContrato : "promessa_compra_venda";
      tipoContratoLabels = {
        nome: tipoLabels[builtinTipo] || "Contrato Imobiliário",
        label_parte_a: builtinTipo === "locacao" ? "Locador" : builtinTipo === "cessao_direitos" ? "Cedente" : "Vendedor",
        label_parte_b: builtinTipo === "locacao" ? "Locatário" : builtinTipo === "cessao_direitos" ? "Cessionário" : "Comprador",
        label_parte_a_plural: builtinTipo === "locacao" ? "Locadores" : builtinTipo === "cessao_direitos" ? "Cedentes" : "Vendedores",
        label_parte_b_plural: builtinTipo === "locacao" ? "Locatários" : builtinTipo === "cessao_direitos" ? "Cessionários" : "Compradores",
        partes_simetricas: false,
        label_objeto: "Imóvel",
        label_acao: builtinTipo === "locacao" ? "locação" : builtinTipo === "cessao_direitos" ? "cessão de direitos possessórios" : "compra e venda",
      };
    }
    const clausulasTipo = getClausulasEspecificasTipo(contrato.tipoContrato);
    const perfilSelecionado = contrato.perfilContrato || "equilibrado";
    let perfilTexto = getPerfilInstrucoes(perfilSelecionado, contrato.tipoContrato);
    let perfilInstructionsIa: string | null = null;
    if (!perfilTexto && admin && typeof perfilSelecionado === "string") {
      let data: any = null;

      if (perfilSelecionado.length >= 32) {
        const byId = await admin
          .from("perfis_contrato")
          .select("nome, instructions_ia")
          .eq("id", perfilSelecionado)
          .maybeSingle();
        if (!byId.error && byId.data?.nome) data = byId.data;
      }

      if (!data && templateImobiliariaId) {
        const tipoRow = await admin
          .from("tipos_contrato")
          .select("id")
          .eq("imobiliaria_id", templateImobiliariaId)
          .eq("codigo", contrato.tipoContrato)
          .maybeSingle();

        const tipoId = tipoRow.data?.id as string | undefined;
        if (tipoId) {
          const byCodigo = await admin
            .from("perfis_contrato")
            .select("nome, instructions_ia")
            .eq("imobiliaria_id", templateImobiliariaId)
            .eq("tipo_contrato_id", tipoId)
            .eq("codigo", perfilSelecionado)
            .maybeSingle();
          if (!byCodigo.error && byCodigo.data?.nome) data = byCodigo.data;
        }
      }

      if (data?.nome) {
        const instr = typeof data.instructions_ia === "string" ? data.instructions_ia.trim() : "";
        perfilInstructionsIa = instr || null;
        perfilTexto = `PERFIL: ${String(data.nome).toUpperCase()}

${instr ? `DIRETRIZES IMPERATIVAS:\n${instr}` : "DIRETRIZES: aplicar o perfil selecionado com coerência em todo o contrato."}`;
      }
    }

    const tipoContratoNomeUpper = (tipoContratoLabels.nome || tipoLabel).toUpperCase();
    const parteA = tipoContratoLabels.label_parte_a || "Vendedor";
    const parteB = tipoContratoLabels.label_parte_b || "Comprador";
    const parteAPlural = tipoContratoLabels.label_parte_a_plural || "Vendedores";
    const parteBPlural = tipoContratoLabels.label_parte_b_plural || "Compradores";
    const partesSimetricas = tipoContratoLabels.partes_simetricas || false;
    const labelObjeto = tipoContratoLabels.label_objeto || "Imóvel";
    const labelAcao = tipoContratoLabels.label_acao || "compra e venda";
    const parteAUpper = parteA.toUpperCase();
    const parteBUpper = parteB.toUpperCase();
    const parteAPluralUpper = parteAPlural.toUpperCase();
    const parteBPluralUpper = parteBPlural.toUpperCase();

    const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro, com mais de 20 anos de experiência na elaboração de minutas contratuais para escritórios de advocacia de alto padrão. Sua tarefa é gerar minutas contratuais COMPLETAS, PROFISSIONAIS e JURIDICAMENTE BLINDADAS.

DADOS DO TIPO DE CONTRATO (USE ESTES LABELS EM TODA A REDAÇÃO):
- NOME DO TIPO: ${tipoContratoNomeUpper}
- LABEL PARTE A: ${parteA} (singular) / ${parteAPlural} (plural)
- LABEL PARTE B: ${parteB} (singular) / ${parteBPlural} (plural)
- PARTES SIMÉTRICAS: ${partesSimetricas ? "SIM" : "NÃO"}
- OBJETO: ${labelObjeto}
- AÇÃO: ${labelAcao}

REGRAS ESPECÍFICAS PARA LABELS DINÂMICOS:
1. TÍTULO DO INSTRUMENTO: "INSTRUMENTO PARTICULAR DE ${tipoContratoNomeUpper}"
2. QUALIFICAÇÃO DAS PARTES:
   - Use "${parteAUpper}" e "${parteBUpper}" em MAIÚSCULAS nos títulos dos blocos
   - No corpo do texto, use as formas adequadas (singular/plural, maiúsculas/minúsculas)
   - ${partesSimetricas ? `SE PARTES SIMÉTRICAS: Gere "${parteA} 1" e "${parteA} 2" no preâmbulo e no corpo` : ""}
3. CLÁUSULAS: Substitua TODAS as referências hardcoded por estas regras:
   - {{PARTE_A}} → ${parteA}
   - {{PARTE_B}} → ${parteB}
   - {{PARTE_A_PLURAL}} → ${parteAPlural}
   - {{PARTE_B_PLURAL}} → ${parteBPlural}
   - {{OBJETO}} → ${labelObjeto}
   - {{ACAO}} → ${labelAcao}
4. GÊNERO DAS PARTES:
   - Adaptar o gênero dos labels conforme o sexo das pessoas cadastradas naquele lado
   - Se todas forem mulheres → feminino (ex: "${parteA.replace(/or$/, 'ora').replace(/dor$/, 'dora')}")
   - Se todas forem homens → masculino (ex: "${parteA}")
   - Se misto → masculino plural
   - Para pessoa jurídica → usar feminino por convenção ("a empresa") ou seguir o gênero do termo

${perfilTexto}

${clausulasTipo}

REGRAS GERAIS DE REDAÇÃO:
- Linguagem jurídica formal brasileira, precisa e sem ambiguidades
- Qualificar COMPLETAMENTE todas as partes com TODOS os dados fornecidos (nome, nacionalidade, profissão, estado civil, regime de bens se casado, RG/CNH, CPF ou CNPJ, filiação, endereço completo)
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
1. Título e identificação do tipo de contrato ("INSTRUMENTO PARTICULAR DE ${tipoContratoNomeUpper}")
2. Preâmbulo com qualificação completa de TODAS as partes (incluindo cônjuges/companheiros(as) que são partes plenas do contrato) usando os labels dinâmicos
3. Cláusulas numeradas cobrindo TODOS os temas listados acima
4. Cláusula LGPD sobre tratamento de dados pessoais
5. Cláusula de foro de eleição
6. Disposições finais (comunicações, prazos, integralidade)
7. Local e data
8. Espaço para assinaturas de TODAS as partes plenas (com nome completo e CPF abaixo, incluindo cônjuges/companheiros(as))
9. Espaço para 2 testemunhas (com nome, CPF e assinatura)
10. Aviso: "Este instrumento particular tem força de escritura pública nos termos do art. 462 do Código Civil."
11. Nota final: "RECOMENDA-SE A REVISÃO DESTE INSTRUMENTO POR ADVOGADO DE CONFIANÇA DAS PARTES."

IMPORTANTE SOBRE PARTES PLENAS:
- TODAS as pessoas listadas nos arrays "vendedores" e "compradores" (incluindo aquelas com conjugeDeId) são PARTES PLENAS do contrato e DEVEM ser qualificadas como signatárias no preâmbulo e DEVEM ter espaço para assinatura no final.
- NÃO trate cônjuges como apenas como "intervenientes" ou "anuentes" — eles são partes signatárias completas.

REGRAS DE QUALIFICAÇÃO DE PROCURADORES:
- Quando um vendedor/comprador possuir procurador, a qualificação da parte no preâmbulo deve seguir o padrão: "[QUALIFICAÇÃO COMPLETA DA PARTE], neste ato representado(a) por seu(sua) bastante procurador(a) [QUALIFICAÇÃO COMPLETA DO PROCURADOR], conforme procuração [pública/particular] lavrada em [DATA] no [CARTÓRIO/LIVRO/FOLHA], cujos poderes outorgados incluem [PODERES RESUMIDOS]."
- No bloco final de assinaturas, quando a parte for representada por procurador, a parte representada NÃO assina separadamente.
- Nesses casos, a linha de assinatura deve conter APENAS o procurador com a descrição: "p.p. [NOME DA PARTE REPRESENTADA] - [NOME DO PROCURADOR]".
- Se o procurador também for cônjuge/companheiro(a) da parte representada e também constar como parte plena no contrato, ele/ela assina UMA ÚNICA VEZ acumulando os dois papéis, no formato: "p.p. [NOME DA PARTE REPRESENTADA] e por si própria - [NOME DO CÔNJUGE PROCURADOR]".
- A parte representada NÃO assina; apenas o procurador.

REGRAS DE QUALIFICAÇÃO DE ANUENTES:
- Após o bloco de qualificação das partes principais, criar bloco "ANUENTES:" listando cada anuente com qualificação completa e a função no negócio (ex.: "na qualidade de cônjuge meeiro, conforme [...]").
- Adicionar cláusula específica "DA ANUÊNCIA" antes da cláusula do Foro, explicitando que os anuentes concordam expressamente com os termos do contrato e renunciam a eventuais direitos que poderiam opor.
- No bloco final de assinaturas, criar linha para cada anuente com label "ANUENTE — [QUALIFICAÇÃO]" se assina_contrato=true.


IMPORTANTE: 
- Gere APENAS o texto do contrato, sem comentários ou explicações extras
- O contrato deve estar PRONTO PARA ASSINATURA
- Seja EXTENSO e DETALHADO - um contrato profissional tem no mínimo 5-8 páginas
- NÃO omita cláusulas por brevidade
- NÃO use formatação markdown (asteriscos, hashtags, etc). O texto deve ser PURO, sem nenhum caractere de formatação como *, **, #, ##, ---, etc.
- Use APENAS texto simples com letras maiúsculas para ênfase quando necessário
- Títulos de cláusulas em LETRAS MAIÚSCULAS sem qualquer marcação
- Descreva o ${labelObjeto.toUpperCase()} objeto do contrato em um bloco separado identificado por "${labelObjeto.toUpperCase()}:" no início
- REGRA OBRIGATÓRIA SOBRE PARCELAS: Todas as parcelas do contrato têm valores FIXOS e NOMINAIS. NÃO inclua cláusula de correção monetária, atualização ou reajuste das parcelas por qualquer índice (INPC, IGPM, IPCA ou outro). As multas moratórias e compensatórias devem ser mantidas normalmente.
- Se o modelo base ou rascunho apresentar dois títulos consecutivos no topo (por exemplo "CONTRATO PARTICULAR DE ..." e logo abaixo "INSTRUMENTO PARTICULAR DE ..."), mantenha APENAS um título. Prefira "INSTRUMENTO PARTICULAR DE ${tipoContratoNomeUpper}".

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
      const existingTemplate = await getActiveTemplate(admin, contrato.tipoContrato, perfil, templateImobiliariaId);
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
              Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-1.5-flash",
              Deno.env.get("GEMINI_MODEL_CONTRACT_FALLBACK") || "gemini-1.5-pro",
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
              Deno.env.get("GEMINI_MODEL_CONTRACT_RENDER") || Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-1.5-flash",
              Deno.env.get("GEMINI_MODEL_CONTRACT_RENDER_FALLBACK") || Deno.env.get("GEMINI_MODEL_CONTRACT_FALLBACK") || "gemini-1.5-pro",
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

      const needsCoreFix = !hasCriticalDataFromForm(baseContrato, contratoSemPeculiaridades).ok;
      if (renderProvider && needsCoreFix) {
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
                Deno.env.get("GEMINI_MODEL_CONTRACT_CORE_FIX") || Deno.env.get("GEMINI_MODEL_CONTRACT_PAYMENT_FIX") || Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-1.5-flash",
                Deno.env.get("GEMINI_MODEL_CONTRACT_CORE_FIX_FALLBACK") || Deno.env.get("GEMINI_MODEL_CONTRACT_PAYMENT_FIX_FALLBACK") || Deno.env.get("GEMINI_MODEL_CONTRACT_FALLBACK") || "gemini-1.5-pro",
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
      const existingTemplate = await getActiveTemplate(admin, contrato.tipoContrato, perfil, templateImobiliariaId);
      if (!existingTemplate?.template_text) {
        await saveTemplate(admin, {
          tipoContrato: contrato.tipoContrato,
          perfil,
          provider: usedProvider,
          model: usedModel,
          templateText: minutaBase,
          imobiliariaId: templateImobiliariaId,
        });
      }
    }

    let minutaFinal = baseContrato;
    const peculiaridades = typeof contrato.peculiaridades === "string" ? contrato.peculiaridades.trim() : "";
    if (peculiaridades) {
      const providerForPec = usedModel ? usedProvider : provider;
      const failover = isFailoverEnabled();
      const tryOrder: AiProvider[] = providerForPec === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
      let integratedContract: string | null = null;
      let lastIntegrationError: unknown = null;

      for (const p of tryOrder) {
        try {
          if (p === "openai") {
            const key = Deno.env.get("OPENAI_API_KEY");
            if (!key) throw new Error("OPENAI_API_KEY is not configured");
            const models = [
              Deno.env.get("OPENAI_MODEL_CONTRACT_PEC") || Deno.env.get("OPENAI_MODEL_CONTRACT") || "gpt-4o-mini",
              Deno.env.get("OPENAI_MODEL_CONTRACT_PEC_FALLBACK") || Deno.env.get("OPENAI_MODEL_CONTRACT_FALLBACK") || "gpt-4o",
            ];
            for (const model of models) {
              try {
                integratedContract = await integratePeculiaridadesInContract({
                  provider: "openai",
                  apiKey: key,
                  model,
                  tipoLabel,
                  contratoText: baseContrato,
                  contrato: contratoSemPeculiaridades,
                  peculiaridades,
                  instructionsIa: templateInstructionsIa,
                });
                break;
              } catch (e) {
                lastIntegrationError = e;
                const status = (e as any)?.status;
                if (status === 429) continue;
                throw e;
              }
            }
          } else {
            const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
            if (!key) throw new Error("GEMINI_API_KEY is not configured");
            const models = [
              Deno.env.get("GEMINI_MODEL_CONTRACT_PEC") || Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-1.5-flash",
              Deno.env.get("GEMINI_MODEL_CONTRACT_PEC_FALLBACK") || Deno.env.get("GEMINI_MODEL_CONTRACT_FALLBACK") || "gemini-1.5-pro",
            ];
            for (const model of models) {
              try {
                integratedContract = await integratePeculiaridadesInContract({
                  provider: "gemini",
                  apiKey: key,
                  model,
                  tipoLabel,
                  contratoText: baseContrato,
                  contrato: contratoSemPeculiaridades,
                  peculiaridades,
                  instructionsIa: templateInstructionsIa,
                });
                break;
              } catch (e) {
                lastIntegrationError = e;
                const status = (e as any)?.status;
                if (status === 429 || status === 404) continue;
                throw e;
              }
            }
          }
          break;
        } catch (e) {
          lastIntegrationError = e;
          const status = (e as any)?.status;
          const shouldForceFallback = status === 404;
          if (!failover && !shouldForceFallback) break;
        }
      }

      const cleanedIntegrated = (integratedContract || "")
        .replace(/\*\*/g, "")
        .replace(/^#{1,6}\s*/gm, "")
        .replace(/^-{3,}$/gm, "")
        .replace(/`/g, "")
        .trim();

      if (!cleanedIntegrated) {
        throw lastIntegrationError instanceof Error ? lastIntegrationError : new Error("Não foi possível integrar as peculiaridades no corpo do contrato.");
      }

      minutaFinal = cleanedIntegrated;
    }

    if (baseSource !== "ai") {
      const check = hasCriticalDataFromForm(minutaFinal, contratoSemPeculiaridades);
      if (!check.ok) {
        const tryOrderFix: AiProvider[] = provider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
        const vendedorNomes = check.needles.vendedoresNeedles
          .map((item: { nome?: string }) => item?.nome || "")
          .filter(Boolean);
        const compradorNomes = check.needles.compradoresNeedles
          .map((item: { nome?: string }) => item?.nome || "")
          .filter(Boolean);
        const vendedorDocs = check.needles.vendedoresNeedles
          .map((item: { doc?: string }) => item?.doc || "")
          .filter(Boolean);
        const compradorDocs = check.needles.compradoresNeedles
          .map((item: { doc?: string }) => item?.doc || "")
          .filter(Boolean);

        const strictInstructions = [
          "REPARO CRÍTICO (OBRIGATÓRIO): o contrato ainda contém dados do MODELO BASE. Corrija agora.",
          "Você DEVE substituir integralmente quaisquer nomes/CPF/endereço/valores/datas do modelo pelos dados oficiais.",
          "O texto final DEVE conter (em qualquer lugar):",
          vendedorNomes.length ? `- VENDEDORES: ${vendedorNomes.join("; ")}` : null,
          compradorNomes.length ? `- COMPRADORES: ${compradorNomes.join("; ")}` : null,
          vendedorDocs.length ? `- DOCUMENTOS DOS VENDEDORES (CPF/CNPJ): ${vendedorDocs.join("; ")}` : null,
          compradorDocs.length ? `- DOCUMENTOS DOS COMPRADORES (CPF/CNPJ): ${compradorDocs.join("; ")}` : null,
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
                Deno.env.get("GEMINI_MODEL_CONTRACT_CORE_FIX") || Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-1.5-flash",
                Deno.env.get("GEMINI_MODEL_CONTRACT_CORE_FIX_FALLBACK") || Deno.env.get("GEMINI_MODEL_CONTRACT_FALLBACK") || "gemini-1.5-pro",
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

    const hasVendedorConjuge = hasConjugeForRole((contrato as any)?.vendedores);
    const hasCompradorConjuge = hasConjugeForRole((contrato as any)?.compradores);
    minutaFinal = stripUnusedConjugeSignatures(minutaFinal, { vendedor: !hasVendedorConjuge, comprador: !hasCompradorConjuge });
    minutaFinal = normalizeProcuradorSignatureBlocks(minutaFinal, contratoSemPeculiaridades);
    minutaFinal = normalizeDuplicateContractTitle(minutaFinal);

    minutaFinal = fixLocalEDataInContractText(minutaFinal, contratoSemPeculiaridades);

    // Processamento de âncoras simbólicas
    try {
      const parseResult = parseTemplateAncoras(minutaFinal);
      if (parseResult.clausulas.length > 0) {
        minutaFinal = renderizarTemplate(minutaFinal, parseResult.clausulas, {
          estiloNumeracao: 'ordinal'
        });
      }
    } catch (err) {
      console.warn("Erro ao processar âncoras simbólicas:", err);
    }

    // Pós-processamento para cláusula da anuência
    const anuentes = Array.isArray(contrato.anuentes) ? contrato.anuentes : [];
    if (anuentes.length > 0) {
      const anuentesQueAssinam = anuentes.filter(a => 
        typeof a.assinaContrato === "boolean" ? a.assinaContrato : true
      );
      
      if (anuentesQueAssinam.length > 0) {
        const clausulaAnuencia = `DA ANUÊNCIA

Os anuentes abaixo identificados concordam expressamente com todos os termos e condições do presente instrumento, renunciando a qualquer direito que poderiam opor ao negócio, inclusive direitos de preferência, evicção, usucapião, retenção ou qualquer outro direito que pudessem ter sobre o imóvel objeto deste contrato.`;
        minutaFinal = insertBeforeLocalEData(minutaFinal, clausulaAnuencia);
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
