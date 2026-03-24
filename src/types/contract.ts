export type TipoContrato =
  | "promessa_compra_venda"
  | "promessa_compra_venda_permuta"
  | "cessao_direitos"
  | "locacao";

export interface TipoContratoInfo {
  id: TipoContrato;
  nome: string;
  descricao: string;
  icone: string;
  subcategoria?: string;
}

export const tiposContrato: TipoContratoInfo[] = [
  {
    id: "promessa_compra_venda",
    nome: "Promessa de Compra e Venda",
    descricao: "Contrato de compromisso de compra e venda de imóvel sem permuta.",
    icone: "FileText",
  },
  {
    id: "promessa_compra_venda_permuta",
    nome: "Promessa de Compra e Venda com Permuta",
    descricao: "Contrato com permuta parcial ou total de imóvel como parte do pagamento.",
    icone: "ArrowLeftRight",
    subcategoria: "Com Permuta",
  },
  {
    id: "cessao_direitos",
    nome: "Cessão de Direitos Possessórios",
    descricao: "Transferência de direitos de posse sobre imóvel não escriturado.",
    icone: "ScrollText",
  },
  {
    id: "locacao",
    nome: "Contrato de Locação",
    descricao: "Locação residencial ou comercial conforme Lei 8.245/91.",
    icone: "Home",
  },
];

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

export interface ImovelPermuta {
  tipo: string;
  descricao: string;
  localizacao: string;
  municipio: string;
  estadoImovel: string;
  areaTotal: string;
  matricula: string;
  registroImoveis: string;
  valorEstimado: string;
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

export interface Locacao {
  finalidade: "residencial" | "comercial";
  valorAluguel: string;
  diaVencimento: string;
  prazoMeses: string;
  indiceReajuste: string;
  caucao: string;
  valorCaucao: string;
  multaRescisao: string;
}

export type PerfilContrato = "blindagem_vendedor" | "blindagem_comprador" | "equilibrado";

export interface PerfilContratoInfo {
  id: PerfilContrato;
  nome: string;
  descricao: string;
  icone: string;
}

export const perfisContrato: PerfilContratoInfo[] = [
  {
    id: "blindagem_vendedor",
    nome: "Blindagem Vendedor",
    descricao: "Máxima proteção ao vendedor: arras não devolvidas em rescisão, proibição de benfeitorias até quitação, cobrança de aluguel em caso de rescisão, sem devolução de valores pagos.",
    icone: "ShieldCheck",
  },
  {
    id: "blindagem_comprador",
    nome: "Blindagem Comprador",
    descricao: "Máxima proteção ao comprador: multa ao vendedor por impossibilidade de escritura, garantia de evicção integral, posse definitiva imediata, devolução com correção em rescisão pelo vendedor.",
    icone: "ShieldAlert",
  },
  {
    id: "equilibrado",
    nome: "Equilibrado",
    descricao: "Contrato balanceado com cláusulas justas para ambas as partes, seguindo boas práticas do mercado imobiliário.",
    icone: "Scale",
  },
];

export interface Contrato {
  tipoContrato: TipoContrato;
  vendedores: Pessoa[];
  compradores: Pessoa[];
  representante?: Pessoa & { creci?: string };
  imovel: Imovel;
  imovelPermuta?: ImovelPermuta;
  pagamento: Pagamento;
  locacao?: Locacao;
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

export function criarImovelVazio(): Imovel {
  return {
    tipo: "",
    descricao: "",
    localizacao: "",
    municipio: "",
    estadoImovel: "",
    lote: "",
    quadra: "",
    areaTotal: "",
    matricula: "",
    registroImoveis: "",
    medidasFrente: "",
    medidasFundos: "",
    medidasLateralEsquerda: "",
    medidasLateralDireita: "",
    caracteristicas: "",
    adCorpus: true,
  };
}

export function criarImovelPermutaVazio(): ImovelPermuta {
  return {
    tipo: "",
    descricao: "",
    localizacao: "",
    municipio: "",
    estadoImovel: "",
    areaTotal: "",
    matricula: "",
    registroImoveis: "",
    valorEstimado: "",
  };
}

export function criarPagamentoVazio(): Pagamento {
  return {
    valorTotal: "",
    parcelas: [
      { id: crypto.randomUUID(), descricao: "Arras confirmatórias no ato da assinatura", valor: "", quantidade: 1, tipo: "arras" },
    ],
    multaMoratoria: "10",
    jurosMora: "1",
    indiceCorrecao: "INPC/IBGE",
    multaContratual: "20",
  };
}

export function criarLocacaoVazia(): Locacao {
  return {
    finalidade: "residencial",
    valorAluguel: "",
    diaVencimento: "10",
    prazoMeses: "30",
    indiceReajuste: "IGPM/FGV",
    caucao: "sim",
    valorCaucao: "",
    multaRescisao: "",
  };
}
