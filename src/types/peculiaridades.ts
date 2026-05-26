export type ModoInsercao = "nova" | "paragrafo" | "substituicao";
export type PosicaoInsercao = "antes" | "depois" | "inicio" | "fim";

export interface DecisaoPeculiaridade {
  textoOriginalUsuario: string;
  textoNormalizado: string;
  modo: ModoInsercao;
  ancoraAlvo: string | null;
  posicao: PosicaoInsercao | null;
  conteudoFinal: string;
  justificativa: string;
  conflito?: boolean;
  clausulaId?: string;
  textoAtual?: string;
  textoProposto?: string;
  razao?: string;
}

export interface DecisaoPeculiaridadeAprovada extends DecisaoPeculiaridade {
  aprovada: boolean;
  textoEditado?: string;
}

export interface LogDecisaoIA {
  id: string;
  submissionId: string;
  peculiaridadeIndex: number;
  textoOriginal: string;
  textoNormalizado: string;
  modo: ModoInsercao;
  ancoraAlvo?: string | null;
  justificativa: string;
  timestamp: Date;
}
