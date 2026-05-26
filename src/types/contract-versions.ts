export type TipoVersaoContrato = 'ia_inicial' | 'ia_refinamento' | 'edicao_manual';

export interface ContratoVersao {
  id: string;
  submissionId: string;
  versaoNumero: number;
  conteudo: string;
  tipo: TipoVersaoContrato;
  autor?: string;
  promptRefinamento?: string;
  createdAt: Date;
}

export const tipoVersaoLabels: Record<TipoVersaoContrato, string> = {
  ia_inicial: 'Geração inicial (IA)',
  ia_refinamento: 'Refinamento (IA)',
  edicao_manual: 'Edição manual'
};

export function criarVersaoContrato(
  submissionId: string,
  versaoNumero: number,
  conteudo: string,
  tipo: TipoVersaoContrato,
  autor?: string,
  promptRefinamento?: string
): ContratoVersao {
  return {
    id: crypto.randomUUID(),
    submissionId,
    versaoNumero,
    conteudo,
    tipo,
    autor,
    promptRefinamento,
    createdAt: new Date()
  };
}
