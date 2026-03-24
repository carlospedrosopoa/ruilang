import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import StepIndicator from "./StepIndicator";
import StepVendedores from "./StepVendedores";
import StepCompradores from "./StepCompradores";
import StepObjeto from "./StepObjeto";
import StepPagamento from "./StepPagamento";
import { Pessoa, Imovel, Pagamento, criarPessoaVazia } from "@/types/contract";
import { toast } from "sonner";

const steps = [
  { number: 1, label: "Vendedores" },
  { number: 2, label: "Compradores" },
  { number: 3, label: "Imóvel" },
  { number: 4, label: "Pagamento" },
];

const ContractWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);

  const [vendedores, setVendedores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [compradores, setCompradores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [imovel, setImovel] = useState<Imovel>({
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
  });
  const [pagamento, setPagamento] = useState<Pagamento>({
    valorTotal: "",
    parcelas: [
      { id: crypto.randomUUID(), descricao: "Arras confirmatórias no ato da assinatura", valor: "", quantidade: 1, tipo: "arras" },
    ],
    multaMoratoria: "10",
    jurosMora: "1",
    indiceCorrecao: "INPC/IBGE",
    multaContratual: "20",
  });

  const next = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleFinish = () => {
    toast.success("Dados coletados com sucesso! Funcionalidade de geração do contrato em breve.");
    console.log({ vendedores, compradores, imovel, pagamento });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">ContratoPRO</h1>
            <p className="text-xs text-muted-foreground">Gerador de Contratos Imobiliários</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <StepIndicator steps={steps} currentStep={currentStep} />

        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <StepVendedores vendedores={vendedores} onChange={setVendedores} />
          )}
          {currentStep === 2 && (
            <StepCompradores compradores={compradores} onChange={setCompradores} />
          )}
          {currentStep === 3 && (
            <StepObjeto imovel={imovel} onChange={setImovel} />
          )}
          {currentStep === 4 && (
            <StepPagamento pagamento={pagamento} onChange={setPagamento} />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={prev}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          {currentStep < 4 ? (
            <Button onClick={next}>
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleFinish} className="bg-success hover:bg-success/90 text-success-foreground">
              <FileText className="w-4 h-4 mr-2" />
              Gerar Contrato
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default ContractWizard;
