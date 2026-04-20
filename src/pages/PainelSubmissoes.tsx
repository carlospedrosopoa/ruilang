import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Plus, Copy, ExternalLink, Loader2, Clock, CheckCircle, FileCheck, Send, Trash2, BarChart3, Building2, ChevronRight, Users, UserCog, Sparkles, Download } from "lucide-react";
import { tiposContrato, TipoContrato } from "@/types/contract";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";

interface Submission {
  id: string;
  token: string;
  tipo_contrato: string;
  corretor_id?: string | null;
  corretor_nome: string | null;
  corretor_telefone: string | null;
  dados: any;
  proposta_texto?: string | null;
  proposta_gerada_em?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  imobiliarias?: any;
}

interface Corretor {
  id: string;
  nome: string;
  creci: string | null;
  telefone: string | null;
  email: string | null;
}

const statusLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  rascunho: { label: "Rascunho", icon: Clock, color: "text-yellow-500" },
  enviado: { label: "Enviado", icon: CheckCircle, color: "text-green-500" },
  contrato_gerado: { label: "Contrato Gerado", icon: FileCheck, color: "text-primary" },
};

const PainelSubmissoes = () => {
  const navigate = useNavigate();
  const { activeTenantId, isPlatformAdmin, memberships, signOut } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoContrato>("promessa_compra_venda");
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [selectedCorretorId, setSelectedCorretorId] = useState<string | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalSubmissionId, setProposalSubmissionId] = useState<string | null>(null);
  const [proposalText, setProposalText] = useState<string>("");

  const loadData = async () => {
    const subQuery = supabase.from("submissions").select("*, imobiliarias(*)").order("created_at", { ascending: false });

    if (!isPlatformAdmin && activeTenantId) {
      subQuery.eq("imobiliaria_id", activeTenantId);
    }

    const [subRes] = await Promise.all([subQuery]);
    setSubmissions((subRes.data as Submission[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [activeTenantId, isPlatformAdmin]);

  useEffect(() => {
    const loadCorretores = async () => {
      if (!activeTenantId) {
        setCorretores([]);
        setSelectedCorretorId(null);
        return;
      }
      const { data } = await supabase
        .from("corretores")
        .select("id, nome, creci, telefone, email")
        .eq("imobiliaria_id", activeTenantId)
        .order("nome");
      const list = (data as Corretor[]) || [];
      setCorretores(list);
      setSelectedCorretorId(list[0]?.id || null);
    };
    loadCorretores();
  }, [activeTenantId]);

  const handleCreateLink = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária/tenant para criar links.");
      return;
    }
    setCreating(true);
    try {
      const corretor = corretores.find((c) => c.id === selectedCorretorId) || null;
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          tipo_contrato: novoTipo,
          imobiliaria_id: activeTenantId,
          corretor_id: corretor?.id || null,
          corretor_nome: corretor?.nome || null,
          corretor_telefone: corretor?.telefone || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const link = `${window.location.origin}/coleta/${data.token}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link criado e copiado!");
      setDialogOpen(false);
      loadData();
    } catch { toast.error("Erro ao criar link."); } finally { setCreating(false); }
  };

  const copyLink = (path: string, token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/${path}/${token}`);
    toast.success("Link copiado!");
  };

  const handleDeleteSubmission = async (id: string) => {
    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else { toast.success("Excluído!"); setSubmissions((prev) => prev.filter((s) => s.id !== id)); }
  };

  const handleGenerateContract = (submission: Submission) => {
    navigate(`/contrato/${submission.tipo_contrato}?submissionId=${submission.id}`);
  };

  const currentImobiliaria = useMemo(() => {
    if (!activeTenantId) return null;
    const m = memberships.find((x) => x.tenantId === activeTenantId);
    return m?.tenant || null;
  }, [activeTenantId, memberships]);

  const openProposalForSubmission = async (sub: Submission) => {
    setProposalSubmissionId(sub.id);
    setProposalText(sub.proposta_texto || "");
    setProposalOpen(true);
  };

  const generateProposalForSubmission = async (sub: Submission) => {
    setProposalSubmissionId(sub.id);
    setProposalText(sub.proposta_texto || "");
    setProposalOpen(true);
    setProposalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: {
          dados: sub.dados,
          tipoContrato: sub.tipo_contrato,
          imobiliaria: sub.imobiliarias || currentImobiliaria || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const proposta = String(data.proposta || "");
      if (!proposta) throw new Error("Proposta vazia.");

      await supabase.from("submissions").update({
        proposta_texto: proposta,
        proposta_gerada_em: new Date().toISOString(),
      } as any).eq("id", sub.id);

      setProposalText(proposta);
      toast.success("Proposta gerada e salva na coleta.");
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar proposta.");
    } finally {
      setProposalLoading(false);
    }
  };

  const copyProposal = async () => {
    if (!proposalText) return;
    await navigator.clipboard.writeText(proposalText);
    toast.success("Proposta copiada!");
  };

  const downloadProposal = () => {
    if (!proposalText) return;
    const blob = new Blob([proposalText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposta_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/images/logo-sielichow.png" alt="Sielichow Advocacia Empresarial" className="h-9 w-auto" />
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">Sielichow</h1>
              <p className="text-xs text-muted-foreground">Painel Administrativo</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <BarChart3 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/clientes")}>
              <Users className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Clientes</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/corretores")}>
              <UserCog className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Corretores</span>
            </Button>
            {isPlatformAdmin ? (
              <Button variant="ghost" size="sm" onClick={() => navigate("/imobiliarias")}>
                <Building2 className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Imobiliárias</span>
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <ChevronRight className="w-4 h-4 mr-1.5 rotate-180" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="font-display text-xl font-bold text-foreground">Coletas (Contratos)</h2>
              </div>

              <div className="flex gap-2">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline"><Plus className="w-4 h-4 mr-2" />Novo Link de Coleta</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Criar Link de Coleta</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label>Tipo de Contrato</Label>
                        <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as TipoContrato)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {tiposContrato.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Corretor</Label>
                        <Select value={selectedCorretorId || ""} onValueChange={(v) => setSelectedCorretorId(v || null)}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {corretores.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateLink} disabled={creating} className="w-full">
                        {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Criar e Copiar Link
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto" />
                <h3 className="font-display text-xl font-bold text-foreground">Nenhuma coleta ainda</h3>
                <p className="text-muted-foreground">Crie um link de coleta para enviar ao corretor.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((sub) => {
                  const tipoInfo = tiposContrato.find((t) => t.id === sub.tipo_contrato);
                  const statusInfo = statusLabels[sub.status] || statusLabels.rascunho;
                  const StatusIcon = statusInfo.icon;
                  const hasProposal = Boolean(sub.proposta_texto && String(sub.proposta_texto).trim());
                  return (
                    <div key={sub.id} className="border border-border rounded-lg p-5 bg-card hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground truncate">{tipoInfo?.nome}</h3>
                            <span className={`flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />{statusInfo.label}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {sub.corretor_nome ? `Corretor: ${sub.corretor_nome}` : "Aguardando preenchimento"}
                            {sub.corretor_telefone ? ` • ${sub.corretor_telefone}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">Criado: {formatDate(sub.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => copyLink("coleta", sub.token)}>
                            <Copy className="w-4 h-4 mr-1" />Link
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            const link = `${window.location.origin}/coleta/${sub.token}`;
                            const msg = encodeURIComponent(`Olá! Segue o link para preenchimento dos dados do contrato (${tipoInfo?.nome}):\n\n${link}\n\nPreencha todos os campos e clique em "Enviar Dados" ao final.`);
                            window.open(`https://wa.me/?text=${msg}`, "_blank");
                          }}>
                            <Send className="w-4 h-4 mr-1" />WhatsApp
                          </Button>
                          {sub.status === "enviado" ? (
                            <>
                              <Button size="sm" onClick={() => handleGenerateContract(sub)}>
                                <FileText className="w-4 h-4 mr-1" />Gerar Contrato
                              </Button>
                              {hasProposal ? (
                                <Button variant="secondary" size="sm" onClick={() => openProposalForSubmission(sub)}>
                                  <FileText className="w-4 h-4 mr-1" />Ver Proposta
                                </Button>
                              ) : (
                                <Button variant="secondary" size="sm" onClick={() => generateProposalForSubmission(sub)}>
                                  <Sparkles className="w-4 h-4 mr-1" />Gerar Proposta
                                </Button>
                              )}
                            </>
                          ) : null}
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteSubmission(sub.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={proposalOpen} onOpenChange={setProposalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Proposta (Coleta)</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {proposalSubmissionId ? `Coleta: ${proposalSubmissionId}` : ""}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyProposal} disabled={!proposalText}>
                <Copy className="w-4 h-4 mr-1" />Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={downloadProposal} disabled={!proposalText}>
                <Download className="w-4 h-4 mr-1" />Baixar
              </Button>
            </div>
          </div>
          <div className="mt-3 border border-border rounded-lg bg-muted/20 overflow-auto p-3">
            {proposalLoading ? (
              <div className="py-10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-foreground">{proposalText || "Nenhuma proposta gerada ainda."}</pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PainelSubmissoes;
