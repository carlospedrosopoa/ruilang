export type TipoContrato =
  | "promessa_compra_venda"
  | "promessa_compra_venda_permuta"
  | "cessao_direitos"
  | "locacao"
  | (string & {});

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

export interface Conjuge {
  nome: string;
  nacionalidade: string;
  profissao: string;
  documentoTipo: "rg" | "cnh";
  documentoNumero: string;
  documentoOrgao: string;
  cpf: string;
}

export function criarConjugeVazio(): Conjuge {
  return {
    nome: "",
    nacionalidade: "brasileira",
    profissao: "",
    documentoTipo: "rg",
    documentoNumero: "",
    documentoOrgao: "",
    cpf: "",
  };
}

export interface Pessoa {
  id: string;
  nome: string;
  nacionalidade: string;
  profissao: string;
  estadoCivil: string;
  regimeBens?: string;
  conjuge?: Conjuge;
  /** ID da pessoa à qual este cônjuge/companheiro está vinculado */
  conjugeDeId?: string;
  documentoTipo: "rg" | "cnh";
  documentoNumero: string;
  documentoOrgao: string;
  cpf: string;
  cnpj: string;
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

export type SituacaoTributaria = "quitado" | "parcelado" | "em_debito";
export type TipoOnus = "hipoteca" | "alienacao_fiduciaria" | "penhora" | "arresto" | "sequestro" | "indisponibilidade" | "outro";

export interface ProprietarioTabular {
  id: string;
  nome: string;
  cpfCnpj: string;
  percentualPropriedade: string;
}

export interface OnusReal {
  id: string;
  tipo: TipoOnus;
  tipoOutro?: string;
  credor: string;
  valor: string;
  numeroRegistro: string;
}

export interface Condominio {
  nome: string;
  valorMensal: string;
  situacao: SituacaoTributaria;
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
  
  // Novos campos
  inscricaoImobiliariaIptu: string;
  situacaoTributaria: SituacaoTributaria;
  valorIptuAnual: string;
  proprietariosTabulares: ProprietarioTabular[];
  livreDeOnus: boolean;
  onusReais: OnusReal[];
  condominio?: Condominio;
}

export const situacaoTributariaLabels: Record<SituacaoTributaria, string> = {
  quitado: "Quitado",
  parcelado: "Parcelado",
  em_debito: "Em débito",
};

export const tipoOnusLabels: Record<TipoOnus, string> = {
  hipoteca: "Hipoteca",
  alienacao_fiduciaria: "Alienação Fiduciária",
  penhora: "Penhora",
  arresto: "Arresto",
  sequestro: "Sequestro",
  indisponibilidade: "Indisponibilidade",
  outro: "Outro",
};

export interface Testemunha {
  id: string;
  nome: string;
  cpf: string;
  rg?: string;
  profissao?: string;
  endereco?: string;
}

export function criarTestemunhaVazia(): Testemunha {
  return {
    id: crypto.randomUUID(),
    nome: "",
    cpf: "",
  };
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

export type TipoParcela =
  | "sinal"
  | "entrada"
  | "parcela"
  | "parcela_final"
  | "financiamento"
  | "fgts"
  | "permuta"
  | "consorcio"
  | "cheque_promissoria";

export type NaturezaSinal = "confirmatorias" | "penitenciais";
export type FrequenciaParcela = "mensal" | "semanal" | "anual";
export type ModalidadeFinanciamento = "sbpe" | "sfh" | "carteira" | "pro_cotista";
export type IndiceCorrecao = "igpm" | "ipca" | "incc" | "inpc" | "igp_di" | "tr";

export interface Parcela {
  id: string;
  tipo: TipoParcela;
  valor: string;
  quantidade: number;
  frequencia?: FrequenciaParcela;
  dataVencimento: string;
  descricao: string;
  observacoes?: string;
  
  // Sinal
  naturezaSinal?: NaturezaSinal;
  
  // Financiamento
  bancoFinanciamento?: string;
  agenciaFinanciamento?: string;
  modalidadeFinanciamento?: ModalidadeFinanciamento;
  valorAprovadoFinanciamento?: string;
  previsaoLiberacaoFinanciamento?: string;
  
  // FGTS
  valorFgts?: string;
  previsaoLiberacaoFgts?: string;
  
  // Permuta
  descricaoBemPermuta?: string;
  valorAvaliadoPermuta?: string;
  
  // Consórcio
  administradoraConsorcio?: string;
  valorCartaCreditoConsorcio?: string;
  previsaoContemplacaoConsorcio?: string;
  
  // Cheque/Promissória
  numeroChequePromissoria?: string;
  bancoChequePromissoria?: string;
  dataChequePromissoria?: string;
}

export interface DadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: "corrente" | "poupanca";
  titular: string;
  cpfTitular: string;
  pix: string;
}

export interface CorrecaoMonetaria {
  aplicar: boolean;
  indice?: IndiceCorrecao;
  carenciaMeses?: number;
}

export interface EncargosAtraso {
  multaMoratoria: string;
  jurosMora: string;
}

export interface Pagamento {
  valorTotal: string;
  valorHonorarios?: string;
  parcelas: Parcela[];
  multaMoratoria: string;
  jurosMora: string;
  indiceCorrecao: string;
  multaContratual: string;
  dadosBancarios?: DadosBancarios;
  correcaoMonetaria?: CorrecaoMonetaria;
  encargosAtraso?: EncargosAtraso;
}

export const tipoParcelaLabels: Record<TipoParcela, string> = {
  sinal: "Sinal (Arras)",
  entrada: "Entrada",
  parcela: "Parcela",
  parcela_final: "Parcela Final / Resíduo",
  financiamento: "Financiamento Bancário",
  fgts: "FGTS",
  permuta: "Permuta",
  consorcio: "Consórcio",
  cheque_promissoria: "Cheque / Promissória",
};

export const naturezaSinalLabels: Record<NaturezaSinal, string> = {
  confirmatorias: "Confirmatórias",
  penitenciais: "Penitenciais",
};

export const frequenciaParcelaLabels: Record<FrequenciaParcela, string> = {
  mensal: "Mensal",
  semanal: "Semanal",
  anual: "Anual",
};

export const modalidadeFinanciamentoLabels: Record<ModalidadeFinanciamento, string> = {
  sbpe: "SBPE",
  sfh: "SFH",
  carteira: "Carteira",
  pro_cotista: "Pró-Cotista",
};

export const indiceCorrecaoLabels: Record<IndiceCorrecao, string> = {
  igpm: "IGPM",
  ipca: "IPCA",
  incc: "INCC",
  inpc: "INPC",
  igp_di: "IGP-DI",
  tr: "TR",
};

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

export type PerfilContrato = "blindagem_vendedor" | "blindagem_comprador" | "equilibrado" | (string & {});

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
  perfilContrato: PerfilContrato;
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
    cnpj: "",
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
    inscricaoImobiliariaIptu: "",
    situacaoTributaria: "quitado",
    valorIptuAnual: "",
    proprietariosTabulares: [],
    livreDeOnus: true,
    onusReais: [],
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
    valorHonorarios: "",
    parcelas: [
      { 
        id: crypto.randomUUID(), 
        descricao: "Sinal no ato da assinatura", 
        valor: "", 
        quantidade: 1, 
        tipo: "sinal", 
        dataVencimento: "",
        naturezaSinal: "confirmatorias"
      },
    ],
    multaMoratoria: "10",
    jurosMora: "1",
    indiceCorrecao: "INPC/IBGE",
    multaContratual: "20",
    correcaoMonetaria: {
      aplicar: false,
    },
    encargosAtraso: {
      multaMoratoria: "10",
      jurosMora: "1",
    },
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

export type ParteTipo = "vendedor" | "comprador";
export type TipoProcuracao = "publica" | "particular_com_firma" | "particular_sem_firma";
export type QualificacaoNoNegocio = 
  | "conjuge_meeiro" 
  | "ex_conjuge" 
  | "herdeiro" 
  | "condomino" 
  | "fiador" 
  | "interveniente_garantidor" 
  | "outro";

export interface Procurador {
  id?: string;
  submissionId: string;
  parteTipo: ParteTipo;
  parteIndice: number;
  
  nomeCompleto: string;
  nacionalidade?: string;
  profissao?: string;
  estadoCivil?: string;
  regimeBens?: string;
  
  tipoDocumento?: string;
  numeroDocumento?: string;
  orgaoExpedidor?: string;
  cpf?: string;
  cnpj?: string;
  
  filiacaoPai?: string;
  filiacaoMae?: string;
  
  enderecoCompleto?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  email?: string;
  telefone?: string;
  
  tipoProcuracao?: TipoProcuracao;
  dataProcuracao?: Date;
  cartorioLivroFolha?: string;
  poderesOutorgados?: string;
  anexoProcuracaoUrl?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Anuente {
  id?: string;
  submissionId: string;
  
  nomeCompleto: string;
  nacionalidade?: string;
  profissao?: string;
  estadoCivil?: string;
  regimeBens?: string;
  
  tipoDocumento?: string;
  numeroDocumento?: string;
  orgaoExpedidor?: string;
  cpf?: string;
  cnpj?: string;
  
  filiacaoPai?: string;
  filiacaoMae?: string;
  
  enderecoCompleto?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  email?: string;
  telefone?: string;
  
  qualificacaoNoNegocio: QualificacaoNoNegocio;
  qualificacaoOutro?: string;
  motivoAnuencia?: string;
  assinaContrato: boolean;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export function criarProcuradorVazio(submissionId: string, parteTipo: ParteTipo, parteIndice: number): Procurador {
  return {
    id: crypto.randomUUID(),
    submissionId,
    parteTipo,
    parteIndice,
    nomeCompleto: "",
    nacionalidade: "brasileira",
  } as Procurador;
}

export function criarAnuenteVazio(submissionId: string): Anuente {
  return {
    id: crypto.randomUUID(),
    submissionId,
    nomeCompleto: "",
    nacionalidade: "brasileira",
    qualificacaoNoNegocio: "outro",
    assinaContrato: true,
  } as Anuente;
}
