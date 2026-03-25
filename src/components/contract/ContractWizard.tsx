import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileText, Sparkles, Copy, Download, FileDown, Loader2, Check } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tipo = (tipoParam as TipoContrato) || "promessa_compra_venda";
  const tipoInfo = tiposContrato.find((t) => t.id === tipo);
  const labels = labelByTipo[tipo];
  const steps = getSteps(tipo);
  const totalSteps = steps.length;
  const submissionId = searchParams.get("submissionId");

  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [stepKey, setStepKey] = useState(0);
  const [vendedores, setVendedores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [compradores, setCompradores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [imovel, setImovel] = useState<Imovel>(criarImovelVazio());
  const [imovelPermuta, setImovelPermuta] = useState<ImovelPermuta>(criarImovelPermutaVazio());
  const [pagamento, setPagamento] = useState<Pagamento>(criarPagamentoVazio());
  const [locacao, setLocacao] = useState<Locacao>(criarLocacaoVazia());
  const [perfilContrato, setPerfilContrato] = useState<PerfilContrato>("equilibrado");
  const [peculiaridades, setPeculiaridades] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [minuta, setMinuta] = useState<string | null>(null);

  useEffect(() => {
    if (!submissionId) return;
    const loadSubmission = async () => {
      const { data } = await supabase
        .from("submissions")
        .select("dados")
        .eq("id", submissionId)
        .single();

      if (data?.dados) {
        const d = data.dados as any;
        if (d.vendedores?.length) setVendedores(d.vendedores);
        if (d.compradores?.length) setCompradores(d.compradores);
        if (d.imovel) setImovel(d.imovel);
        if (d.imovelPermuta) setImovelPermuta(d.imovelPermuta);
        if (d.pagamento) setPagamento(d.pagamento);
        if (d.locacao) setLocacao(d.locacao);

        const perfilStep = steps.findIndex(s => s.label === "Perfil");
        if (perfilStep >= 0) setCurrentStep(perfilStep + 1);
      }
    };
    loadSubmission();
  }, [submissionId]);

  const next = () => {
    if (currentStep < totalSteps) {
      setDirection("forward");
      setStepKey(k => k + 1);
      setCurrentStep(currentStep + 1);
    }
  };
  const prev = () => {
    if (currentStep > 1) {
      setDirection("backward");
      setStepKey(k => k + 1);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const contrato = {
        tipoContrato: tipo,
        perfilContrato,
        peculiaridades: peculiaridades.trim() || undefined,
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
      toast.success("Minuta copiada!");
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
      return <StepPerfil perfilContrato={perfilContrato} onChange={setPerfilContrato} peculiaridades={peculiaridades} onPeculiaridadesChange={setPeculiaridades} />;
    }
    if (currentStepObj.label === "Gerar") {
      if (minuta) {
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
                    <Check className="w-4 h-4 text-success" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-foreground tracking-tight">Minuta Gerada</h3>
                </div>
                <p className="text-muted-foreground text-sm">Revise o texto e faça os ajustes necessários.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs">
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTxt} className="text-xs">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> .txt
                </Button>
                <Button size="sm" onClick={handleDownloadDocx} disabled={isExportingDocx} className="text-xs bg-primary">
                  {isExportingDocx ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
                  {isExportingDocx ? "Gerando..." : "Baixar .docx"}
                </Button>
              </div>
            </div>
            <div className="border border-border rounded-xl p-6 sm:p-8 bg-card shadow-card">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-body leading-relaxed">{minuta}</pre>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-accent/[0.06] border border-accent/15">
              <Sparkles className="w-4 h-4 text-accent shrink-0" />
              <p className="text-xs text-muted-foreground">
                Esta minuta foi gerada por inteligência artificial e deve ser revisada por um advogado antes da assinatura.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="font-display text-2xl font-bold text-foreground mb-1 tracking-tight">Resumo e Geração</h3>
            <p className="text-muted-foreground">Confira os dados antes de gerar a minuta.</p>
          </div>
          <div className="border border-border rounded-xl p-6 bg-card shadow-card space-y-5">
            <h4 className="font-display font-semibold text-foreground text-sm uppercase tracking-wider text-muted-foreground">Resumo dos Dados</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</span>
                <span className="text-foreground font-medium">{tipoInfo?.nome}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Perfil</span>
                <span className="text-foreground font-medium">{perfisContrato.find(p => p.id === perfilContrato)?.nome}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{labels.vendedor}(es)</span>
                <span className="text-foreground font-medium">{vendedores.map((v) => v.nome || "—").join(", ")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{labels.comprador}(es)</span>
                <span className="text-foreground font-medium">{compradores.map((c) => c.nome || "—").join(", ")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Imóvel</span>
                <span className="text-foreground font-medium">{imovel.localizacao || "—"}, {imovel.municipio || "—"}/{imovel.estadoImovel || "—"}</span>
              </div>
              {tipo !== "locacao" && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor Total</span>
                  <span className="text-foreground font-medium">R$ {pagamento.valorTotal || "—"}</span>
                </div>
              )}
              {tipo === "locacao" && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Aluguel</span>
                  <span className="text-foreground font-medium">R$ {locacao.valorAluguel || "—"}</span>
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent shrink-0" />
                <p className="text-xs text-muted-foreground">
                  A minuta gerada por IA é um modelo e deve ser revisada por um advogado antes da assinatura.
                </p>
              </div>
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
      {/* Premium Header */}
      <header className="gradient-primary border-b border-primary/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-lg bg-accent/20 backdrop-blur-sm flex items-center justify-center border border-accent/30">
              <FileText className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-primary-foreground tracking-tight">ContratoPRO</h1>
              <p className="text-[10px] text-primary-foreground/50 font-medium uppercase tracking-wider">{tipoInfo?.nome || "Contrato"}</p>
            </div>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <StepIndicator steps={steps} currentStep={currentStep} />

        <div
          key={stepKey}
          className={`min-h-[400px] mt-12 ${direction === "forward" ? "step-slide-enter-forward" : "step-slide-enter-backward"}`}
        >
          {renderStep()}
        </div>

        <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
          <Button variant="outline" onClick={currentStep === 1 ? () => navigate("/") : prev} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 1 ? "Voltar" : "Anterior"}
          </Button>

          {!isLastStep ? (
            <Button onClick={next} className="gap-2 bg-primary shadow-card hover:shadow-elevated transition-all">
              Próximo
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : !minuta ? (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-card hover:shadow-elevated transition-all font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analisando dados e gerando contrato...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Minuta com IA
                </>
              )}
            </Button>
          ) : (
            <Button onClick={() => { setMinuta(null); handleGenerate(); }} disabled={isGenerating} variant="outline" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Regerar
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default ContractWizard;
