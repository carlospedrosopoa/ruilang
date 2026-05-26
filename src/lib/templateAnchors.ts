export interface ClausulaAncorada {
  id: string;
  titulo: string;
  conteudo: string;
  startIndex: number;
  endIndex: number;
  ordinal?: string;
  numero?: number;
}

export interface ResultadoParseAncoras {
  clausulas: ClausulaAncorada[];
  erros: Array<{ tipo: 'id_duplicado' | 'id_inexistente' | 'tag_sem_fechamento' | 'tag_sem_id'; mensagem: string; posicao?: number }>;
  textoLimpo: string;
}

export interface OpcoesRenderizacao {
  estiloNumeracao: 'ordinal' | 'arabico';
  prefixoClausula: string;
}

const DEFAULT_OPCOES: OpcoesRenderizacao = {
  estiloNumeracao: 'ordinal',
  prefixoClausula: 'CLÁUSULA'
};

const ORDINAIS = [
  'PRIMEIRA', 'SEGUNDA', 'TERCEIRA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA', 'OITAVA', 'NONA', 'DÉCIMA',
  'DÉCIMA PRIMEIRA', 'DÉCIMA SEGUNDA', 'DÉCIMA TERCEIRA', 'DÉCIMA QUARTA', 'DÉCIMA QUINTA', 'DÉCIMA SEXTA',
  'DÉCIMA SÉTIMA', 'DÉCIMA OITAVA', 'DÉCIMA NONA', 'VIGÉSIMA', 'VIGÉSIMA PRIMEIRA', 'VIGÉSIMA SEGUNDA',
  'VIGÉSIMA TERCEIRA', 'VIGÉSIMA QUARTA', 'VIGÉSIMA QUINTA', 'VIGÉSIMA SEXTA', 'VIGÉSIMA SÉTIMA',
  'VIGÉSIMA OITAVA', 'VIGÉSIMA NONA', 'TRIGÉSIMA'
];

function getOrdinal(numero: number): string {
  return ORDINAIS[numero - 1] || `${numero}ª`;
}

export function parseTemplateAncoras(texto: string): ResultadoParseAncoras {
  const clausulas: ClausulaAncorada[] = [];
  const erros: ResultadoParseAncoras['erros'] = [];
  const idsExistentes = new Set<string>();
  
  const regexAbertura = /<!--\s*CLAUSULA\s+id="([^"]+)"(?:\s+titulo="([^"]*)")?\s*-->/g;
  const regexFechamento = /<!--\s*\/CLAUSULA\s*-->/g;
  
  let match: RegExpExecArray | null;
  
  while ((match = regexAbertura.exec(texto)) !== null) {
    const id = match[1].trim();
    const titulo = (match[2] || '').trim();
    const startIndex = match.index;
    
    if (!id) {
      erros.push({
        tipo: 'tag_sem_id',
        mensagem: 'Tag de abertura de cláusula sem atributo id',
        posicao: startIndex
      });
      continue;
    }
    
    if (idsExistentes.has(id)) {
      erros.push({
        tipo: 'id_duplicado',
        mensagem: `ID de cláusula duplicado: "${id}"`,
        posicao: startIndex
      });
      continue;
    }
    
    regexFechamento.lastIndex = regexAbertura.lastIndex;
    const matchFechamento = regexFechamento.exec(texto);
    
    if (!matchFechamento) {
      erros.push({
        tipo: 'tag_sem_fechamento',
        mensagem: `Cláusula "${id}" sem tag de fechamento`,
        posicao: startIndex
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
      endIndex
    });
  }
  
  clausulas.sort((a, b) => a.startIndex - b.startIndex);
  
  clausulas.forEach((clausula, index) => {
    clausula.numero = index + 1;
    clausula.ordinal = getOrdinal(index + 1);
  });
  
  const regexRef = /{{(REF|NUM|TITULO):([^}]+)}}/g;
  while ((match = regexRef.exec(texto)) !== null) {
    const tipo = match[1];
    const idRef = match[2].trim();
    if (!idsExistentes.has(idRef)) {
      erros.push({
        tipo: 'id_inexistente',
        mensagem: `Referência a ID inexistente: "${idRef}"`,
        posicao: match.index
      });
    }
  }
  
  let textoLimpo = texto;
  for (const clausula of clausulas) {
    const tagAbertura = texto.slice(clausula.startIndex, regexAbertura.lastIndex);
    const tagFechamento = texto.slice(regexFechamento.lastIndex, clausula.endIndex);
    textoLimpo = textoLimpo.replace(tagAbertura, '').replace(tagFechamento, '');
  }
  
  return { clausulas, erros, textoLimpo };
}

export function renderizarTemplate(
  texto: string,
  clausulasOrdenadas: ClausulaAncorada[],
  opcoes: Partial<OpcoesRenderizacao> = {}
): string {
  const opts = { ...DEFAULT_OPCOES, ...opcoes };
  const mapaClausulas = new Map(clausulasOrdenadas.map(c => [c.id, c]));
  
  let resultado = texto;
  
  for (const clausula of clausulasOrdenadas) {
    const regexAbertura = new RegExp(`<!--\\s*CLAUSULA\\s+id="${clausula.id}"(?:\\s+titulo="[^"]*")?\\s*-->`, 'g');
    const regexFechamento = /<!--\s*\/CLAUSULA\s*-->/g;
    
    let textoClausula = resultado;
    let matchAbertura = regexAbertura.exec(textoClausula);
    if (matchAbertura) {
      regexFechamento.lastIndex = regexAbertura.lastIndex;
      const matchFechamento = regexFechamento.exec(textoClausula);
      if (matchFechamento) {
        const antes = textoClausula.slice(0, matchAbertura.index);
        const depois = textoClausula.slice(matchFechamento.index + matchFechamento[0].length);
        
        const tituloClausula = opts.estiloNumeracao === 'ordinal'
          ? `${opts.prefixoClausula} ${clausula.ordinal} – ${clausula.titulo}`
          : `${opts.prefixoClausula} ${clausula.numero}ª – ${clausula.titulo}`;
        
        resultado = `${antes}${tituloClausula}\n\n${clausula.conteudo}${depois}`;
      }
    }
  }
  
  resultado = resultado.replace(/{{(REF|NUM|TITULO):([^}]+)}}/g, (_, tipo, idRef) => {
    const clausula = mapaClausulas.get(idRef.trim());
    if (!clausula) {
      return `[REFERÊNCIA QUEBRADA: ${idRef}]`;
    }
    
    switch (tipo) {
      case 'REF':
        return opts.estiloNumeracao === 'ordinal'
          ? `Cláusula ${clausula.ordinal}`
          : `Cláusula ${clausula.numero}ª`;
      case 'NUM':
        return String(clausula.numero);
      case 'TITULO':
        return clausula.titulo;
      default:
        return _;
    }
  });
  
  return resultado;
}

export function validarEstruturaTemplate(texto: string): { valido: boolean; erros: string[]; avisos: string[] } {
  const parseResult = parseTemplateAncoras(texto);
  const erros: string[] = [];
  const avisos: string[] = [];
  
  for (const erro of parseResult.erros) {
    const msg = erro.posicao !== undefined
      ? `${erro.mensagem} (posição ${erro.posicao})`
      : erro.mensagem;
    erros.push(msg);
  }
  
  if (parseResult.clausulas.length === 0) {
    avisos.push('Nenhuma cláusula ancorada encontrada. O template se comportará como texto livre.');
  }
  
  return {
    valido: erros.length === 0,
    erros,
    avisos
  };
}
