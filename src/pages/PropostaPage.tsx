import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  FileText,
  Send,
  Sparkles,
  Download,
  AlertTriangle,
} from "lucide-react";
import ProposalStepIndicator from "@/components/proposal/ProposalStepIndicator";
import StepVendedores from "@/components/contract/StepVendedores";
import StepCompradores from "@/components/contract/StepCompradores";
import StepObjeto from "@/components/contract/StepObjeto";
import StepProposalPagamento from "@/components/proposal/StepProposalPagamento";
import StepDocumentos from "@/components/proposal/StepDocumentos";
import StepRevisao from "@/components/proposal/StepRevisao";
import ProposalEditor from "@/components/proposal/ProposalEditor";
import {
  Pessoa,
  Imovel,
  criarPessoaVazia,
  criarImovelVazio,
} from "@/types/contract";
import { PropostaPagamento, PropostaDocumento, criarPagamentoPropostaVazio } from "@/types/proposal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const steps = [
  { number: 1, label: "Partes" },
  { number: 2, label: "Imóvel" },
  { number: 3, label: "Pagamento" },
  { number: 4, label: "Documentos" },
  { number: 5, label: "Revisão" },
];

const PropostaPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [propostaId, setPropostaId] = useState<string | null>(null);
  const [status, setStatus] = useState("rascunho");
  const [currentStep, setCurrentStep] = useState(0); // 0 = tela inicial
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [stepKey, setStepKey] = useState(0);

  // Corretor
  const [corretorNome, setCorretorNome] = useState("");
  const [corretorCreci, setCorretorCreci] = useState("");
  const [imobiliariaNome, setImobiliariaNome] = useState("");

  // Dados
  const [vendedores, setVendedores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [compradores, setCompradores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [imovel, setImovel] = useState<Imovel>(criarImovelVazio());
  const [pagamento, setPagamento] = useState<PropostaPagamento>(criarPagamentoPropostaVazio());
  const [documentos, setDocumentos] = useState<PropostaDocumento[]>([]);

  // State
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [proposta, setProposta] = useState<string | null>(null);

  const autoAttachExtractFiles = useCallback(async (files: File[]) => {
    if (!propostaId || !token || files.length === 0) return;

    const already = new Set(documentos.map((d) => `${d.nome}::${d.tamanho}`));
    const toUpload = files.filter((f) => !already.has(`${f.name}::${f.size}`));
    if (toUpload.length === 0) return;

    const uploaded: PropostaDocumento[] = [];
    for (const file of toUpload) {
      const filePath = `${propostaId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("proposta-docs").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("proposta-docs").getPublicUrl(filePath);
      uploaded.push({
        id: crypto.randomUUID(),
        nome: file.name,
        tipo: file.type || "application/octet-stream",
        tamanho: file.size,
        url: urlData.publicUrl,
        uploadedAt: new Date().toISOString(),
      });
    }

    if (uploaded.length > 0) {
      const nextDocs = [...documentos, ...uploaded];
      setDocumentos(nextDocs);
      await supabase.functions.invoke("public-proposta", {
        body: { token, update: { documentos: nextDocs as any } },
      });
      toast.success(`${uploaded.length} documento(s) da extração anexado(s) automaticamente.`);
    }
  }, [propostaId, token, documentos]);

  useEffect(() => {
    const load = async () => {
      if (!token) { setLoading(false); return; }

      const { data, error } = await supabase.functions.invoke("public-proposta", {
        body: { token },
      });

      if (error || !data?.proposta) { setLoading(false); return; }

      const propostaRow = data.proposta as any;
      setPropostaId(propostaRow.id);
      setStatus(propostaRow.status);
      setCorretorNome(propostaRow.corretor_nome || "");
      setCorretorCreci(propostaRow.corretor_creci || "");
      setImobiliariaNome(propostaRow.imobiliaria_nome || propostaRow.imobiliarias?.nome || "");

      const dados = propostaRow.dados as any;
      if (dados) {
        if (dados.vendedores?.length) setVendedores(dados.vendedores);
        if (dados.compradores?.length) setCompradores(dados.compradores);
        if (dados.imovel) setImovel(dados.imovel);
        if (dados.pagamento) setPagamento(dados.pagamento);
      }

      const docs = propostaRow.documentos as any;
      if (Array.isArray(docs) && docs.length > 0) setDocumentos(docs);

      if (propostaRow.proposta_texto) setProposta(propostaRow.proposta_texto);

      if (propostaRow.status === "enviado") setSubmitted(true);

      setLoading(false);
    };
    load();
  }, [token]);

  const getDados = useCallback(() => ({
    vendedores,
    compradores,
    imovel,
    pagamento,
  }), [vendedores, compradores, imovel, pagamento]);

  const saveDraft = useCallback(async () => {
    if (!propostaId || !token) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke("public-proposta", {
        body: {
          token,
          update: {
            corretor_nome: corretorNome,
            corretor_creci: corretorCreci,
            imobiliaria_nome: imobiliariaNome,
            dados: getDados() as any,
            documentos: documentos as any,
          },
        },
      });
      if (error) throw error;
    } finally {
      setIsSaving(false);
    }
  }, [propostaId, corretorNome, corretorCreci, imobiliariaNome, getDados, documentos]);

  const next = async () => {
    setDirection("forward");
    setStepKey((k) => k + 1);
    setCurrentStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try { await saveDraft(); } catch {}
  };

  const prev = () => {
    if (currentStep > 1) {
      setDirection("backward");
      setStepKey((k) => k + 1);
      setCurrentStep((s) => s - 1);
    }
  };

  const handleStartProposta = () => {
    if (!corretorNome.trim()) {
      toast.error("Informe o nome do corretor.");
      return;
    }
    if (!corretorCreci.trim()) {
      toast.error("Informe o CRECI.");
      return;
    }
    next();
  };

  const handleSubmit = async () => {
    if (!propostaId || !token) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke("public-proposta", {
        body: {
          token,
          update: {
            corretor_nome: corretorNome,
            corretor_creci: corretorCreci,
            imobiliaria_nome: imobiliariaNome,
            dados: getDados() as any,
            documentos: documentos as any,
            status: "enviado",
          },
        },
      });

      if (error) throw error;
      setSubmitted(true);
      toast.success("Proposta enviada com sucesso para análise jurídica!");
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateProposal = async () => {
    setIsGeneratingProposal(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: {
          dados: getDados(),
          tipoContrato: "promessa_compra_venda",
          imobiliaria: imobiliariaNome ? { nome: imobiliariaNome, creci: corretorCreci } : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProposta(data.proposta);

      // Save proposal text
      if (propostaId && token) {
        await supabase.functions.invoke("public-proposta", {
          body: { token, update: { proposta_texto: data.proposta } },
        });
      }
      toast.success("Proposta gerada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar proposta.");
    } finally {
      setIsGeneratingProposal(false);
    }
  };


  const handleDownloadDocx = async () => {
    if (!proposta) return;
    try {
      const { data, error } = await supabase.functions.invoke("generate-docx", {
        body: { minuta: proposta, tipoContrato: "proposta_comercial" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const byteChars = atob(data.docx);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("DOCX baixado!");
    } catch {
      toast.error("Erro ao gerar DOCX.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!propostaId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto" />
          <h2 className="font-display text-2xl font-bold text-foreground">Link inválido</h2>
          <p className="text-muted-foreground">Este link de proposta não foi encontrado ou expirou.</p>
        </div>
      </div>
    );
  }

  // Submitted view with proposal generation
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-primary border-b border-primary/20">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <img src="/images/logo-sielichow.png" alt="Sielichow" className="h-8 w-auto" />
            <div>
              <h1 className="font-display text-lg font-bold text-primary-foreground">Proposta Imobiliária</h1>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="text-center space-y-3">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
            <h2 className="font-display text-2xl font-bold text-foreground">Proposta Enviada!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Proposta enviada com sucesso para análise jurídica. O advogado responsável será notificado.
            </p>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Gerar Proposta Comercial
            </h3>
            <p className="text-sm text-muted-foreground">
              Gere uma proposta comercial estruturada com os dados preenchidos.
            </p>

            {!proposta ? (
              <Button
                onClick={handleGenerateProposal}
                disabled={isGeneratingProposal}
                className="w-full"
              >
                {isGeneratingProposal ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando Proposta...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Gerar Proposta</>
                )}
              </Button>
            ) : (
              <ProposalEditor
                proposta={proposta}
                isGenerating={isGeneratingProposal}
                onRegenerate={() => { setProposta(null); handleGenerateProposal(); }}
                onSave={async (text) => {
                  setProposta(text);
                  if (propostaId && token) {
                    await supabase.functions.invoke("public-proposta", {
                      body: { token, update: { proposta_texto: text } },
                    });
                  }
                }}
                onDownloadDocx={handleDownloadDocx}
              />
            )}
          </div>

          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-accent/10 border border-accent/20">
            <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              <strong>Aviso:</strong> Este documento não possui validade jurídica como contrato, sendo apenas uma proposta sujeita à análise e formalização por advogado.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Initial screen
  if (currentStep === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-3">
            <img src="/images/logo-sielichow.png" alt="Sielichow Advocacia Empresarial" className="h-16 w-auto mx-auto" />
            <h1 className="font-display text-3xl font-bold text-foreground">Proposta Imobiliária</h1>
            <p className="text-muted-foreground">
              Preencha os dados da negociação para envio ao jurídico
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card shadow-card space-y-5">
            <div>
              <Label>Nome do Corretor *</Label>
              <Input
                value={corretorNome}
                onChange={(e) => setCorretorNome(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div>
              <Label>CRECI *</Label>
              <Input
                value={corretorCreci}
                onChange={(e) => setCorretorCreci(e.target.value)}
                placeholder="Ex: 12345-F"
              />
            </div>
            <div>
              <Label>Imobiliária</Label>
              <Input
                value={imobiliariaNome}
                placeholder="Imobiliária vinculada ao link"
                readOnly
                disabled
              />
            </div>

            <Button onClick={handleStartProposta} className="w-full gap-2 h-12 text-base">
              Iniciar Proposta
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Este documento não constitui contrato, tratando-se apenas de uma proposta e coleta de dados para elaboração jurídica posterior.
          </p>
        </div>
      </div>
    );
  }

  // Wizard steps
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-8">
            <StepVendedores vendedores={vendedores} onChange={setVendedores} onExtractFiles={autoAttachExtractFiles} />
            <div className="border-t border-border pt-8">
              <StepCompradores compradores={compradores} onChange={setCompradores} onExtractFiles={autoAttachExtractFiles} />
            </div>
          </div>
        );
      case 2:
        return <StepObjeto imovel={imovel} onChange={setImovel} onExtractFiles={autoAttachExtractFiles} />;
      case 3:
        return <StepProposalPagamento pagamento={pagamento} onChange={setPagamento} />;
      case 4:
        return <StepDocumentos propostaId={propostaId!} documentos={documentos} onChange={setDocumentos} />;
      case 5:
        return (
          <StepRevisao
            corretorNome={corretorNome}
            corretorCreci={corretorCreci}
            imobiliariaNome={imobiliariaNome}
            vendedores={vendedores}
            compradores={compradores}
            imovel={imovel}
            pagamento={pagamento}
            documentos={documentos}
          />
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === 5;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary border-b border-primary/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/images/logo-sielichow.png" alt="Sielichow" className="h-8 w-auto" />
          <div>
            <h1 className="font-display text-lg font-bold text-primary-foreground">Proposta Imobiliária</h1>
            <p className="text-[10px] text-primary-foreground/60 font-medium">{corretorNome} • CRECI {corretorCreci}</p>
          </div>
          {isSaving && (
            <div className="ml-auto flex items-center gap-1 text-xs text-primary-foreground/50">
              <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <ProposalStepIndicator steps={steps} currentStep={currentStep} />

        <div
          key={stepKey}
          className={`min-h-[400px] mt-10 ${direction === "forward" ? "step-slide-enter-forward" : "step-slide-enter-backward"}`}
        >
          {renderStep()}
        </div>

        <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
          <Button variant="outline" onClick={prev} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </Button>

          {!isLastStep ? (
            <Button onClick={next} className="gap-2">
              Próximo
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="gap-2 bg-primary"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</>
              ) : (
                <><Send className="w-4 h-4" />Enviar para o Jurídico</>
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default PropostaPage;
