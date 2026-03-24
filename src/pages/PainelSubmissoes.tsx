import { useState, useEffect } from "react";
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
import { FileText, Plus, Copy, ArrowLeft, ExternalLink, Loader2, Clock, CheckCircle, FileCheck } from "lucide-react";
import { tiposContrato, TipoContrato } from "@/types/contract";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const statusLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  rascunho: { label: "Rascunho", icon: Clock, color: "text-yellow-500" },
  enviado: { label: "Enviado", icon: CheckCircle, color: "text-green-500" },
  contrato_gerado: { label: "Contrato Gerado", icon: FileCheck, color: "text-primary" },
};

const PainelSubmissoes = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoContrato>("promessa_compra_venda");

  const loadSubmissions = async () => {
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });

    setSubmissions((data as Submission[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const handleCreateLink = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("submissions")
        .insert({ tipo_contrato: novoTipo })
        .select()
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/coleta/${data.token}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link criado e copiado para a área de transferência!");
      setDialogOpen(false);
      loadSubmissions();
    } catch (err: any) {
      toast.error("Erro ao criar link.");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/coleta/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleGenerateContract = (submission: Submission) => {
    // Navigate to contract wizard pre-filled with submission data
    navigate(`/contrato/${submission.tipo_contrato}?submissionId=${submission.id}`);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-foreground">ContratoPRO</h1>
                <p className="text-xs text-muted-foreground">Painel de Coletas</p>
              </div>
            </button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Link de Coleta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Link de Coleta</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Tipo de Contrato</Label>
                  <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as TipoContrato)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposContrato.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
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
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : submissions.length === 0 ? (
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
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {sub.corretor_nome ? `Corretor: ${sub.corretor_nome}` : "Aguardando preenchimento"}
                        {sub.corretor_telefone ? ` • ${sub.corretor_telefone}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Criado: {formatDate(sub.created_at)}
                        {sub.updated_at !== sub.created_at && ` • Atualizado: ${formatDate(sub.updated_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => copyLink(sub.token)}>
                        <Copy className="w-4 h-4 mr-1" />
                        Link
                      </Button>
                      {sub.status === "enviado" && (
                        <Button size="sm" onClick={() => handleGenerateContract(sub)}>
                          <FileText className="w-4 h-4 mr-1" />
                          Gerar Contrato
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default PainelSubmissoes;
