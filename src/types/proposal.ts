export interface PropostaDados {
  vendedores: import("@/types/contract").Pessoa[];
  compradores: import("@/types/contract").Pessoa[];
  imovel: import("@/types/contract").Imovel;
  pagamento: PropostaPagamento;
  observacoes?: string;
}

export interface PropostaPagamento {
  valorTotal: string;
  formaPagamento: "avista" | "parcelado";
  valorEntrada?: string;
  numeroParcelas?: number;
  dataPrimeiraParcela?: string;
  observacoes?: string;
}

export interface PropostaDocumento {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  url: string;
  uploadedAt: string;
}

export function criarPagamentoPropostaVazio(): PropostaPagamento {
  return {
    valorTotal: "",
    formaPagamento: "avista",
  };
}
