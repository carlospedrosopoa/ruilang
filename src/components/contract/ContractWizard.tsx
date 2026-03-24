import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileText, Sparkles, Copy, Download, FileDown, Loader2 } from "lucide-react";
import StepIndicator from "./StepIndicator";
import StepVendedores from "./StepVendedores";
import StepCompradores from "./StepCompradores";
import StepObjeto from "./StepObjeto";
import StepPagamento from "./StepPagamento";
import StepPermuta from "./StepPermuta";
import StepLocacao from "./StepLocacao";
import StepPerfil from "./StepPerfil";
import {
  TipoContrato,
  tiposContrato,
  Pessoa,
  Imovel,
  ImovelPermuta,
  Pagamento,
  Locacao,
  PerfilContrato,
  perfisContrato,
  criarPessoaVazia,
  criarImovelVazio,
  criarImovelPermutaVazio,
  criarPagamentoVazio,
  criarLocacaoVazia,
} from "@/types/contract";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const labelByTipo: Record<TipoContrato, { vendedor: string; comprador: string }> = {
  promessa_compra_venda: { vendedor: "Vendedor", comprador: "Comprador" },
  promessa_compra_venda_permuta: { vendedor: "Vendedor", comprador: "Comprador" },
  cessao_direitos: { vendedor: "Cedente", comprador: "Cessionário" },
  locacao: { vendedor: "Locador", comprador: "Locatário" },
};

function getSteps(tipo: TipoContrato) {
  const labels = labelByTipo[tipo];
  const steps = [
    { number: 1, label: `${labels.vendedor}(es)` },
    { number: 2, label: `${labels.comprador}(es)` },
    { number: 3, label: "Imóvel" },
  ];

  let stepNumber = 4;

  if (tipo === "promessa_compra_venda_permuta") {
    steps.push({ number: stepNumber++, label: "Permuta" });
  }

  if (tipo === "locacao") {
    steps.push({ number: stepNumber++, label: "Locação" });
  } else {
    steps.push({ number: stepNumber++, label: "Pagamento" });
  }

  steps.push({ number: stepNumber++, label: "Perfil" });
  steps.push({ number: stepNumber, label: "Gerar" });
  return steps;
}

const ContractWizard = () => {
  const { tipo: tipoParam } = useParams<{ tipo: string }>();
  const navigate = useNavigate();
  const tipo = (tipoParam as TipoContrato) || "promessa_compra_venda";
  const tipoInfo = tiposContrato.find((t) => t.id === tipo);
  const labels = labelByTipo[tipo];
  const steps = getSteps(tipo);
  const totalSteps = steps.length;

  const [currentStep, setCurrentStep] = useState(1);
  const [vendedores, setVendedores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [compradores, setCompradores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [imovel, setImovel] = useState<Imovel>(criarImovelVazio());
  const [imovelPermuta, setImovelPermuta] = useState<ImovelPermuta>(criarImovelPermutaVazio());
  const [pagamento, setPagamento] = useState<Pagamento>(criarPagamentoVazio());
  const [locacao, setLocacao] = useState<Locacao>(criarLocacaoVazia());
  const [perfilContrato, setPerfilContrato] = useState<PerfilContrato>("equilibrado");
  const [isGenerating, setIsGenerating] = useState(false);
  const [minuta, setMinuta] = useState<string | null>(null);

  const next = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };
  const prev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const contrato = {
        tipoContrato: tipo,
        perfilContrato,
        vendedores,
        compradores,
        imovel,
        ...(tipo === "promessa_compra_venda_permuta" ? { imovelPermuta } : {}),
        ...(tipo === "locacao" ? { locacao } : { pagamento }),
      };

      const { data, error } = await supabase.functions.invoke("generate-contract", {
        body: { contrato },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMinuta(data.minuta);
      toast.success("Minuta gerada com sucesso!");
    } catch (err: any) {
      console.error("Error generating contract:", err);
      toast.error(err.message || "Erro ao gerar contrato. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (minuta) {
      navigator.clipboard.writeText(minuta);
      toast.success("Minuta copiada para a área de transferência!");
    }
  };

  const handleDownloadTxt = () => {
    if (minuta) {
      const blob = new Blob([minuta], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato_${tipo}_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const [isExportingDocx, setIsExportingDocx] = useState(false);

  const handleDownloadDocx = async () => {
    if (!minuta) return;
    setIsExportingDocx(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-docx", {
        body: { minuta, tipoContrato: tipo },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const byteChars = atob(data.docx);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato_${tipo}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("DOCX baixado com sucesso!");
    } catch (err: any) {
      console.error("Error exporting DOCX:", err);
      toast.error("Erro ao exportar DOCX. Tente novamente.");
    } finally {
      setIsExportingDocx(false);
    }
  };

  const renderStep = () => {
    if (currentStep === 1) {
      return (
        <StepVendedores
          vendedores={vendedores}
          onChange={setVendedores}
          titulo={labels.vendedor}
          tituloPlural={`${labels.vendedor}(es)`}
        />
      );
    }
    if (currentStep === 2) {
      return (
        <StepCompradores
          compradores={compradores}
          onChange={setCompradores}
          titulo={labels.comprador}
          tituloPlural={`${labels.comprador}(es)`}
        />
      );
    }
    if (currentStep === 3) {
      return <StepObjeto imovel={imovel} onChange={setImovel} />;
    }

    const currentStepObj = steps[currentStep - 1];
    if (currentStepObj.label === "Permuta") {
      return <StepPermuta imovelPermuta={imovelPermuta} onChange={setImovelPermuta} />;
    }
    if (currentStepObj.label === "Locação") {
      return <StepLocacao locacao={locacao} onChange={setLocacao} />;
    }
    if (currentStepObj.label === "Pagamento") {
      return <StepPagamento pagamento={pagamento} onChange={setPagamento} />;
    }
    if (currentStepObj.label === "Perfil") {
      return <StepPerfil perfilContrato={perfilContrato} onChange={setPerfilContrato} />;
    }
    if (currentStepObj.label === "Gerar") {
      if (minuta) {
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-1">Minuta Gerada</h3>
                <p className="text-muted-foreground">Revise o texto e faça os ajustes necessários.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-1" /> Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTxt}>
                  <Download className="w-4 h-4 mr-1" /> .txt
                </Button>
                <Button size="sm" onClick={handleDownloadDocx} disabled={isExportingDocx}>
                  {isExportingDocx ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
                  {isExportingDocx ? "Gerando..." : "Baixar .docx"}
                </Button>
              </div>
            </div>
            <div className="border border-border rounded-lg p-6 bg-card">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-body leading-relaxed">{minuta}</pre>
            </div>
            <p className="text-xs text-muted-foreground italic">
              ⚠️ Esta minuta foi gerada por inteligência artificial e deve ser revisada por um advogado antes da assinatura.
            </p>
          </div>
        );
      }

      return (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-2xl font-bold text-foreground mb-1">Resumo e Geração</h3>
            <p className="text-muted-foreground">Confira os dados antes de gerar a minuta.</p>
          </div>
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <h4 className="font-semibold text-foreground text-sm">Resumo dos Dados</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-foreground">Tipo:</span>{" "}
                <span className="text-muted-foreground">{tipoInfo?.nome}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Perfil:</span>{" "}
                <span className="text-muted-foreground">{perfisContrato.find(p => p.id === perfilContrato)?.nome}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">{labels.vendedor}(es):</span>{" "}
                <span className="text-muted-foreground">{vendedores.map((v) => v.nome || "—").join(", ")}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">{labels.comprador}(es):</span>{" "}
                <span className="text-muted-foreground">{compradores.map((c) => c.nome || "—").join(", ")}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Imóvel:</span>{" "}
                <span className="text-muted-foreground">{imovel.localizacao || "—"}, {imovel.municipio || "—"}/{imovel.estadoImovel || "—"}</span>
              </div>
              {tipo !== "locacao" && (
                <div>
                  <span className="font-semibold text-foreground">Valor Total:</span>{" "}
                  <span className="text-muted-foreground">R$ {pagamento.valorTotal || "—"}</span>
                </div>
              )}
              {tipo === "locacao" && (
                <div>
                  <span className="font-semibold text-foreground">Aluguel:</span>{" "}
                  <span className="text-muted-foreground">R$ {locacao.valorAluguel || "—"}</span>
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground italic">
                ⚠️ A minuta gerada por IA é um modelo e deve ser revisada por um advogado antes da assinatura.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const isLastStep = currentStep === totalSteps;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">ContratoPRO</h1>
              <p className="text-xs text-muted-foreground">{tipoInfo?.nome || "Contrato"}</p>
            </div>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <StepIndicator steps={steps} currentStep={currentStep} />

        <div className="min-h-[400px]">{renderStep()}</div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button variant="outline" onClick={currentStep === 1 ? () => navigate("/") : prev}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {currentStep === 1 ? "Voltar" : "Anterior"}
          </Button>

          {!isLastStep ? (
            <Button onClick={next}>
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : !minuta ? (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isGenerating ? "Gerando..." : "Gerar Minuta com IA"}
            </Button>
          ) : (
            <Button onClick={() => { setMinuta(null); handleGenerate(); }} disabled={isGenerating} variant="outline">
              <Sparkles className="w-4 h-4 mr-2" />
              Regerar
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default ContractWizard;
