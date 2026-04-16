import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Plus, Copy, ExternalLink, Loader2, Clock, CheckCircle, FileCheck, Send, Trash2, Briefcase, BarChart3, Building2, ChevronRight } from "lucide-react";
import { tiposContrato, TipoContrato } from "@/types/contract";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";

interface Submission {
  id: string;
  token: string;
  tipo_contrato: string;
  corretor_nome: string | null;
  corretor_telefone: string | null;
  dados: any;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Proposta {
  id: string;
  token: string;
  corretor_nome: string | null;
  corretor_creci: string | null;
  imobiliaria_nome: string | null;
  dados: any;
  status: string;
  created_at: string;
  updated_at: string;
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
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoContrato>("promessa_compra_venda");

  const loadData = async () => {
    const subQuery = supabase.from("submissions").select("*").order("created_at", { ascending: false });
    const propQuery = supabase.from("propostas").select("*").order("created_at", { ascending: false });

    if (!isPlatformAdmin && activeTenantId) {
      subQuery.eq("imobiliaria_id", activeTenantId);
      propQuery.eq("imobiliaria_id", activeTenantId);
    }

    const [subRes, propRes] = await Promise.all([subQuery, propQuery]);
    setSubmissions((subRes.data as Submission[]) || []);
    setPropostas((propRes.data as Proposta[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [activeTenantId, isPlatformAdmin]);

  const handleCreateLink = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária/tenant para criar links.");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("submissions")
        .insert({ tipo_contrato: novoTipo, imobiliaria_id: activeTenantId })
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

  const handleCreateProposalLink = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária/tenant para criar links.");
      return;
    }
    setCreating(true);
    try {
      const activeTenant = memberships.find((m) => m.tenantId === activeTenantId);
      const activeTenantName = activeTenant?.tenant?.nome || null;
      const { data, error } = await supabase
        .from("propostas")
        .insert({ imobiliaria_id: activeTenantId, imobiliaria_nome: activeTenantName })
        .select()
        .single();
      if (error) throw error;
      const link = `${window.location.origin}/proposta/${data.token}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link de proposta criado e copiado!");
      setProposalDialogOpen(false);
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

  const handleDeleteProposta = async (id: string) => {
    const { error } = await supabase.from("propostas").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else { toast.success("Excluído!"); setPropostas((prev) => prev.filter((p) => p.id !== id)); }
  };

  const handleGenerateContract = (submission: Submission) => {
    navigate(`/contrato/${submission.tipo_contrato}?submissionId=${submission.id}`);
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
            <Button variant="ghost" size="sm" onClick={() => navigate("/relatorios")}>
              <BarChart3 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Relatórios</span>
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
          <Tabs defaultValue="propostas" className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <TabsList>
                <TabsTrigger value="propostas" className="gap-2">
                  <Briefcase className="w-4 h-4" /> Propostas
                </TabsTrigger>
                <TabsTrigger value="coletas" className="gap-2">
                  <FileText className="w-4 h-4" /> Coletas (Contratos)
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="w-4 h-4 mr-2" />Novo Link de Proposta</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Criar Link de Proposta</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <p className="text-sm text-muted-foreground">
                        Um link único será criado para o corretor preencher os dados da negociação imobiliária.
                      </p>
                      <Button onClick={handleCreateProposalLink} disabled={creating} className="w-full">
                        {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Criar e Copiar Link
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

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
                      <Button onClick={handleCreateLink} disabled={creating} className="w-full">
                        {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Criar e Copiar Link
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Propostas Tab */}
            <TabsContent value="propostas">
              {propostas.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <Briefcase className="w-16 h-16 text-muted-foreground mx-auto" />
                  <h3 className="font-display text-xl font-bold text-foreground">Nenhuma proposta ainda</h3>
                  <p className="text-muted-foreground">Crie um link de proposta para enviar ao corretor.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {propostas.map((prop) => {
                    const statusInfo = statusLabels[prop.status] || statusLabels.rascunho;
                    const StatusIcon = statusInfo.icon;
                    return (
                      <div key={prop.id} className="border border-border rounded-lg p-5 bg-card hover:border-primary/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">Proposta Imobiliária</h3>
                              <span className={`flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}>
                                <StatusIcon className="w-3.5 h-3.5" />{statusInfo.label}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {prop.corretor_nome ? `Corretor: ${prop.corretor_nome}` : "Aguardando preenchimento"}
                              {prop.corretor_creci ? ` • CRECI ${prop.corretor_creci}` : ""}
                              {prop.imobiliaria_nome ? ` • ${prop.imobiliaria_nome}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">Criado: {formatDate(prop.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => copyLink("proposta", prop.token)}>
                              <Copy className="w-4 h-4 mr-1" />Link
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => {
                              const link = `${window.location.origin}/proposta/${prop.token}`;
                              const msg = encodeURIComponent(`Olá! Segue o link para preenchimento da proposta imobiliária:\n\n${link}\n\nPreencha todos os campos e clique em "Enviar para o Jurídico" ao final.`);
                              window.open(`https://wa.me/?text=${msg}`, "_blank");
                            }}>
                              <Send className="w-4 h-4 mr-1" />WhatsApp
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteProposta(prop.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Coletas Tab */}
            <TabsContent value="coletas">
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
                            {sub.status === "enviado" && (
                              <Button size="sm" onClick={() => handleGenerateContract(sub)}>
                                <FileText className="w-4 h-4 mr-1" />Gerar Contrato
                              </Button>
                            )}
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
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default PainelSubmissoes;
