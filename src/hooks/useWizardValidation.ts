import { useMemo } from "react";
import { Pessoa, Imovel, ImovelPermuta, Pagamento, Locacao } from "@/types/contract";
import {
  validarCPF,
  validarCNPJ,
  validarCEP,
  validarEmail,
  validarTelefone,
  isNotEmpty,
} from "@/lib/validation";

export interface ValidationError {
  field: string;
  message: string;
  index?: number;
  isPessoa?: boolean;
  isImovel?: boolean;
  isImovelPermuta?: boolean;
  isPagamento?: boolean;
  isLocacao?: boolean;
}

export function validatePessoa(pessoa: Pessoa, index: number, emailRequired?: boolean): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNotEmpty(pessoa.nome)) {
    errors.push({ field: "nome", message: "Nome completo é obrigatório", index, isPessoa: true });
  }
  if (!isNotEmpty(pessoa.nacionalidade)) {
    errors.push({ field: "nacionalidade", message: "Nacionalidade é obrigatória", index, isPessoa: true });
  }
  if (!isNotEmpty(pessoa.profissao)) {
    errors.push({ field: "profissao", message: "Profissão é obrigatória", index, isPessoa: true });
  }
  if (!isNotEmpty(pessoa.estadoCivil)) {
    errors.push({ field: "estadoCivil", message: "Estado civil é obrigatório", index, isPessoa: true });
  }
  if ((pessoa.estadoCivil === "Casado(a)" || pessoa.estadoCivil === "União Estável") && !isNotEmpty(pessoa.regimeBens)) {
    errors.push({ field: "regimeBens", message: "Regime é obrigatório", index, isPessoa: true });
  }
  if (!isNotEmpty(pessoa.documentoNumero)) {
    errors.push({ field: "documentoNumero", message: "Número do documento é obrigatório", index, isPessoa: true });
  }
  if (!isNotEmpty(pessoa.documentoOrgao)) {
    errors.push({ field: "documentoOrgao", message: "Órgão expedidor é obrigatório", index, isPessoa: true });
  }
  if (isNotEmpty(pessoa.cpf) && !validarCPF(pessoa.cpf)) {
    errors.push({ field: "cpf", message: "CPF inválido", index, isPessoa: true });
  }
  if (isNotEmpty(pessoa.cnpj) && !validarCNPJ(pessoa.cnpj)) {
    errors.push({ field: "cnpj", message: "CNPJ inválido", index, isPessoa: true });
  }
  if (!isNotEmpty(pessoa.endereco)) {
    errors.push({ field: "endereco", message: "Endereço completo é obrigatório", index, isPessoa: true });
  }
  if (!isNotEmpty(pessoa.bairro)) {
    errors.push({ field: "bairro", message: "Bairro é obrigatório", index, isPessoa: true });
  }
  if (!isNotEmpty(pessoa.cidade)) {
    errors.push({ field: "cidade", message: "Cidade é obrigatória", index, isPessoa: true });
  }
  if (!isNotEmpty(pessoa.estado)) {
    errors.push({ field: "estado", message: "Estado é obrigatório", index, isPessoa: true });
  }
  if (isNotEmpty(pessoa.cep) && !validarCEP(pessoa.cep)) {
    errors.push({ field: "cep", message: "CEP inválido", index, isPessoa: true });
  }
  if (emailRequired && isNotEmpty(pessoa.email) && !validarEmail(pessoa.email)) {
    errors.push({ field: "email", message: "E-mail inválido", index, isPessoa: true });
  }
  if (isNotEmpty(pessoa.telefone) && !validarTelefone(pessoa.telefone)) {
    errors.push({ field: "telefone", message: "Telefone inválido (mínimo 10 dígitos)", index, isPessoa: true });
  }

  return errors;
}

export function validateImovel(imovel: Imovel): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNotEmpty(imovel.tipo)) {
    errors.push({ field: "tipo", message: "Tipo do imóvel é obrigatório", isImovel: true });
  }
  if (!isNotEmpty(imovel.descricao)) {
    errors.push({ field: "descricao", message: "Descrição é obrigatória", isImovel: true });
  }
  if (!isNotEmpty(imovel.localizacao)) {
    errors.push({ field: "localizacao", message: "Localização é obrigatória", isImovel: true });
  }
  if (!isNotEmpty(imovel.municipio)) {
    errors.push({ field: "municipio", message: "Município é obrigatório", isImovel: true });
  }
  if (!isNotEmpty(imovel.estadoImovel)) {
    errors.push({ field: "estadoImovel", message: "Estado é obrigatório", isImovel: true });
  }
  if (!isNotEmpty(imovel.areaTotal)) {
    errors.push({ field: "areaTotal", message: "Área total é obrigatória", isImovel: true });
  }

  return errors;
}

export function validateImovelPermuta(imovel: ImovelPermuta): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNotEmpty(imovel.tipo)) {
    errors.push({ field: "tipo", message: "Tipo do imóvel é obrigatório", isImovelPermuta: true });
  }
  if (!isNotEmpty(imovel.descricao)) {
    errors.push({ field: "descricao", message: "Descrição é obrigatória", isImovelPermuta: true });
  }
  if (!isNotEmpty(imovel.localizacao)) {
    errors.push({ field: "localizacao", message: "Localização é obrigatória", isImovelPermuta: true });
  }
  if (!isNotEmpty(imovel.municipio)) {
    errors.push({ field: "municipio", message: "Município é obrigatório", isImovelPermuta: true });
  }
  if (!isNotEmpty(imovel.estadoImovel)) {
    errors.push({ field: "estadoImovel", message: "Estado é obrigatório", isImovelPermuta: true });
  }
  if (!isNotEmpty(imovel.areaTotal)) {
    errors.push({ field: "areaTotal", message: "Área total é obrigatória", isImovelPermuta: true });
  }

  return errors;
}

export function validatePagamento(pagamento: Pagamento): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNotEmpty(pagamento.valorTotal)) {
    errors.push({ field: "valorTotal", message: "Valor total é obrigatório", isPagamento: true });
  }

  return errors;
}

export function validateLocacao(locacao: Locacao): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNotEmpty(locacao.valorAluguel)) {
    errors.push({ field: "valorAluguel", message: "Valor do aluguel é obrigatório", isLocacao: true });
  }
  if (!isNotEmpty(locacao.diaVencimento)) {
    errors.push({ field: "diaVencimento", message: "Dia de vencimento é obrigatório", isLocacao: true });
  }
  if (!isNotEmpty(locacao.prazoMeses)) {
    errors.push({ field: "prazoMeses", message: "Prazo em meses é obrigatório", isLocacao: true });
  }

  return errors;
}

export function useWizardValidation({
  currentStep,
  steps,
  vendedores,
  compradores,
  imovel,
  imovelPermuta,
  pagamento,
  locacao,
  tipo,
}: {
  currentStep: number;
  steps: { number: number; label: string }[];
  vendedores: Pessoa[];
  compradores: Pessoa[];
  imovel: Imovel;
  imovelPermuta: ImovelPermuta;
  pagamento: Pagamento;
  locacao: Locacao;
  tipo: string;
}) {
  const errors = useMemo(() => {
    const stepObj = steps[currentStep - 1];
    let stepErrors: ValidationError[] = [];

    if (!stepObj) return stepErrors;

    if (currentStep === 1) {
      vendedores.forEach((v, idx) => {
        stepErrors = [...stepErrors, ...validatePessoa(v, idx)];
      });
    } else if (currentStep === 2) {
      compradores.forEach((c, idx) => {
        stepErrors = [...stepErrors, ...validatePessoa(c, idx)];
      });
    } else if (currentStep === 3) {
      stepErrors = validateImovel(imovel);
    } else if (stepObj.label === "Permuta") {
      stepErrors = validateImovelPermuta(imovelPermuta);
    } else if (stepObj.label === "Pagamento") {
      stepErrors = validatePagamento(pagamento);
    } else if (stepObj.label === "Locação") {
      stepErrors = validateLocacao(locacao);
    }

    return stepErrors;
  }, [currentStep, steps, vendedores, compradores, imovel, imovelPermuta, pagamento, locacao, tipo]);

  const hasErrors = errors.length > 0;

  return { errors, hasErrors };
}
