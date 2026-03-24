export interface Pessoa {
  id: string;
  nome: string;
  nacionalidade: string;
  profissao: string;
  estadoCivil: string;
  regimeBens?: string;
  documentoTipo: "rg" | "cnh";
  documentoNumero: string;
  documentoOrgao: string;
  cpf: string;
  filiacaoPai: string;
  filiacaoMae: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  email?: string;
  telefone?: string;
}

export interface Imovel {
  tipo: string;
  descricao: string;
  localizacao: string;
  municipio: string;
  estadoImovel: string;
  lote: string;
  quadra: string;
  areaTotal: string;
  matricula: string;
  registroImoveis: string;
  medidasFrente: string;
  medidasFundos: string;
  medidasLateralEsquerda: string;
  medidasLateralDireita: string;
  caracteristicas: string;
  adCorpus: boolean;
}

export interface Parcela {
  id: string;
  descricao: string;
  valor: string;
  quantidade: number;
  tipo: "arras" | "parcela" | "entrada";
}

export interface Pagamento {
  valorTotal: string;
  parcelas: Parcela[];
  multaMoratoria: string;
  jurosMora: string;
  indiceCorrecao: string;
  multaContratual: string;
}

export interface Contrato {
  vendedores: Pessoa[];
  compradores: Pessoa[];
  representante?: Pessoa & { creci?: string };
  imovel: Imovel;
  pagamento: Pagamento;
  foro: string;
  cidade: string;
  dataContrato: string;
}

export const estadosCivis = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a) consensualmente",
  "Separado(a) judicialmente",
  "União Estável",
] as const;

export const estadosBR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export function criarPessoaVazia(): Pessoa {
  return {
    id: crypto.randomUUID(),
    nome: "",
    nacionalidade: "brasileira",
    profissao: "",
    estadoCivil: "",
    documentoTipo: "rg",
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
  };
}
