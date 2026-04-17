import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, FileText, Send, Sparkles, Copy, Download } from "lucide-react";
import StepIndicator from "@/components/contract/StepIndicator";
import StepVendedores from "@/components/contract/StepVendedores";
import StepCompradores from "@/components/contract/StepCompradores";
import StepObjeto from "@/components/contract/StepObjeto";
import StepPagamento from "@/components/contract/StepPagamento";
import StepPermuta from "@/components/contract/StepPermuta";
import StepLocacao from "@/components/contract/StepLocacao";
import {
  TipoContrato,
  tiposContrato,
  Pessoa,
  Imovel,
  ImovelPermuta,
  Pagamento,
  Locacao,
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
    { number: 1, label: "Corretor" },
    { number: 2, label: `${labels.vendedor}(es)` },
    { number: 3, label: `${labels.comprador}(es)` },
    { number: 4, label: "Imóvel" },
  ];

  let stepNumber = 5;

  if (tipo === "promessa_compra_venda_permuta") {
    steps.push({ number: stepNumber++, label: "Permuta" });
  }

  if (tipo === "locacao") {
    steps.push({ number: stepNumber++, label: "Locação" });
  } else {
    steps.push({ number: stepNumber++, label: "Pagamento" });
  }

  steps.push({ number: stepNumber, label: "Enviar" });
  return steps;
}

const ColetaPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoContrato>("promessa_compra_venda");
  const [status, setStatus] = useState("rascunho");
  const [currentStep, setCurrentStep] = useState(1);

  const [corretorNome, setCorretorNome] = useState("");
  const [corretorTelefone, setCorretorTelefone] = useState("");
  const [corretorLocked, setCorretorLocked] = useState(false);
  const [vendedores, setVendedores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [compradores, setCompradores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [imovel, setImovel] = useState<Imovel>(criarImovelVazio());
  const [imovelPermuta, setImovelPermuta] = useState<ImovelPermuta>(criarImovelPermutaVazio());
  const [pagamento, setPagamento] = useState<Pagamento>(criarPagamentoVazio());
  const [locacao, setLocacao] = useState<Locacao>(criarLocacaoVazia());
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Proposal state
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [proposta, setProposta] = useState<string | null>(null);

  // Imobiliaria data
  const [imobiliaria, setImobiliaria] = useState<any>(null);

  const labels = labelByTipo[tipo];
  const steps = getSteps(tipo);
  const totalSteps = steps.length;
  const tipoInfo = tiposContrato.find((t) => t.id === tipo);

  useEffect(() => {
    const loadSubmission = async () => {
      if (!token) return;

      const { data, error } = await supabase.functions.invoke("public-submission", {
        body: { token },
      });

      if (error || !data?.submission) {
        setLoading(false);
        return;
      }

      const submission = data.submission as any;

      setSubmissionId(submission.id);
      setTipo(submission.tipo_contrato as TipoContrato);
      setStatus(submission.status);
      setCorretorNome(submission.corretor_nome || "");
      setCorretorTelefone(submission.corretor_telefone || "");
      setCorretorLocked(Boolean(submission.corretor_id));
      if (submission.imobiliarias) setImobiliaria(submission.imobiliarias);

      const dados = submission.dados as any;
      if (dados) {
        if (dados.vendedores?.length) setVendedores(dados.vendedores);
        if (dados.compradores?.length) setCompradores(dados.compradores);
        if (dados.imovel) setImovel(dados.imovel);
        if (dados.imovelPermuta) setImovelPermuta(dados.imovelPermuta);
        if (dados.pagamento) setPagamento(dados.pagamento);
        if (dados.locacao) setLocacao(dados.locacao);
      }

      if (submission.status === "enviado" || submission.status === "contrato_gerado") {
        setSubmitted(true);
      }

      setLoading(false);
    };

    loadSubmission();
  }, [token]);

  const getDados = () => ({
    vendedores,
    compradores,
    imovel,
    ...(tipo === "promessa_compra_venda_permuta" ? { imovelPermuta } : {}),
    ...(tipo === "locacao" ? { locacao } : { pagamento }),
  });

  const saveDraft = async () => {
    if (!submissionId || !token) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke("public-submission", {
        body: {
          token,
          update: {
            corretor_nome: corretorNome,
            corretor_telefone: corretorTelefone,
            dados: getDados() as any,
          },
        },
      });
      if (error) throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!submissionId || !token) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke("public-submission", {
        body: {
          token,
          update: {
            corretor_nome: corretorNome,
            corretor_telefone: corretorTelefone,
            dados: getDados() as any,
            status: "enviado",
          },
        },
      });

      if (error) throw error;
      setSubmitted(true);
      toast.success("Dados enviados com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateProposal = async () => {
    setIsGeneratingProposal(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: { dados: getDados(), tipoContrato: tipo, imobiliaria },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setProposta(data.proposta);
      toast.success("Proposta gerada com sucesso!");
    } catch (err: any) {
      console.error("Error generating proposal:", err);
      toast.error(err.message || "Erro ao gerar proposta. Tente novamente.");
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  const handleCopyProposal = () => {
    if (proposta) {
      navigator.clipboard.writeText(proposta);
      toast.success("Proposta copiada!");
    }
  };

  const handleDownloadProposal = () => {
    if (proposta) {
      const blob = new Blob([proposta], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta_${tipo}_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const next = async () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Save in background - don't block navigation
    try {
      await saveDraft();
    } catch (err) {
      console.error("Erro ao salvar rascunho:", err);
    }
  };

  const prev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!submissionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto" />
          <h2 className="font-display text-2xl font-bold text-foreground">Link inválido</h2>
          <p className="text-muted-foreground">Este link de coleta não foi encontrado ou expirou.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
            <img src="/images/logo-sielichow.png" alt="Sielichow" className="h-9 w-auto" />
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">Coleta de Dados</h1>
              <p className="text-xs text-muted-foreground">{tipoInfo?.nome || "Contrato"}</p>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center space-y-4 mb-8">
            <CheckCircle className="w-16 h-16 text-success mx-auto" />
            <h2 className="font-display text-2xl font-bold text-foreground">Dados Enviados</h2>
            <p className="text-muted-foreground">
              Os dados foram enviados com sucesso. O responsável pela elaboração do contrato será notificado.
            </p>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card space-y-6">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                <Sparkles className="w-5 h-5 inline mr-2 text-primary" />
                Proposta de Negócio
              </h3>
              <p className="text-sm text-muted-foreground">
                Gere uma proposta de negócio para as partes assinarem previamente, formalizando a intenção de firmar o contrato definitivo.
              </p>
            </div>

            {!proposta ? (
              <Button
                onClick={handleGenerateProposal}
                disabled={isGeneratingProposal}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {isGeneratingProposal ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando Proposta...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Gerar Proposta de Negócio
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleCopyProposal}>
                    <Copy className="w-4 h-4 mr-1" /> Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadProposal}>
                    <Download className="w-4 h-4 mr-1" /> Baixar .txt
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setProposta(null); handleGenerateProposal(); }}
                    disabled={isGeneratingProposal}
                  >
                    <Sparkles className="w-4 h-4 mr-1" /> Regerar
                  </Button>
                </div>

                <div className="border border-border rounded-lg p-6 bg-background">
                  <pre className="whitespace-pre-wrap text-sm text-foreground font-body leading-relaxed">{proposta}</pre>
                </div>

                <p className="text-xs text-muted-foreground italic">
                  ⚠️ Esta proposta foi gerada por inteligência artificial. Ela NÃO substitui o contrato definitivo, que será elaborado por advogado.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  const renderStep = () => {
    const currentStepObj = steps[currentStep - 1];

    if (currentStepObj.label === "Corretor") {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-2xl font-bold text-foreground mb-1">Identificação do Corretor</h3>
            <p className="text-muted-foreground">Informe seus dados para contato.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={corretorNome} onChange={(e) => setCorretorNome(e.target.value)} placeholder="Seu nome completo" readOnly={corretorLocked} disabled={corretorLocked} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={corretorTelefone} onChange={(e) => setCorretorTelefone(e.target.value)} placeholder="(00) 00000-0000" readOnly={corretorLocked} disabled={corretorLocked} />
            </div>
          </div>
        </div>
      );
    }

    if (currentStepObj.label.includes(labels.vendedor)) {
      return (
        <StepVendedores
          vendedores={vendedores}
          onChange={setVendedores}
          titulo={labels.vendedor}
          tituloPlural={`${labels.vendedor}(es)`}
        />
      );
    }

    if (currentStepObj.label.includes(labels.comprador)) {
      return (
        <StepCompradores
          compradores={compradores}
          onChange={setCompradores}
          titulo={labels.comprador}
          tituloPlural={`${labels.comprador}(es)`}
        />
      );
    }

    if (currentStepObj.label === "Imóvel") {
      return <StepObjeto imovel={imovel} onChange={setImovel} />;
    }

    if (currentStepObj.label === "Permuta") {
      return <StepPermuta imovelPermuta={imovelPermuta} onChange={setImovelPermuta} />;
    }

    if (currentStepObj.label === "Locação") {
      return <StepLocacao locacao={locacao} onChange={setLocacao} />;
    }

    if (currentStepObj.label === "Pagamento") {
      return <StepPagamento pagamento={pagamento} onChange={setPagamento} />;
    }

    if (currentStepObj.label === "Enviar") {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-2xl font-bold text-foreground mb-1">Confirmar e Enviar</h3>
            <p className="text-muted-foreground">Revise os dados antes de enviar.</p>
          </div>
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-foreground">Tipo:</span>{" "}
                <span className="text-muted-foreground">{tipoInfo?.nome}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Corretor:</span>{" "}
                <span className="text-muted-foreground">{corretorNome || "—"}</span>
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
          <img src="/images/logo-sielichow.png" alt="Sielichow" className="h-9 w-auto" />
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Coleta de Dados</h1>
            <p className="text-xs text-muted-foreground">{tipoInfo?.nome || "Contrato"}</p>
          </div>
          {isSaving && (
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <StepIndicator steps={steps} currentStep={currentStep} />

        <div className="min-h-[400px]">{renderStep()}</div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button variant="outline" onClick={prev} disabled={currentStep === 1}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          {!isLastStep ? (
            <Button onClick={next}>
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSaving} className="bg-success hover:bg-success/90 text-success-foreground">
              <Send className="w-4 h-4 mr-2" />
              {isSaving ? "Enviando..." : "Enviar Dados"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default ColetaPage;
