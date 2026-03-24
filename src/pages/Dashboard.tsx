import { useState, useEffect } from "react";
import { FileText, ArrowLeftRight, ScrollText, Home, ClipboardList, Send, Loader2, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { tiposContrato, TipoContrato } from "@/types/contract";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const iconMap: Record<string, React.ElementType> = {
  FileText,
  ArrowLeftRight,
  ScrollText,
  Home,
};

interface Imobiliaria {
  id: string;
  nome: string;
  creci: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoContrato>("promessa_compra_venda");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [creating, setCreating] = useState(false);
  const [imobiliarias, setImobiliarias] = useState<Imobiliaria[]>([]);
  const [selectedImobiliaria, setSelectedImobiliaria] = useState<string>("");

  useEffect(() => {
    const loadImobiliarias = async () => {
      const { data } = await supabase.from("imobiliarias").select("id, nome, creci").order("nome");
      setImobiliarias((data as Imobiliaria[]) || []);
    };
    loadImobiliarias();
  }, []);

  const handleSelect = (tipo: TipoContrato) => {
    navigate(`/contrato/${tipo}`);
  };

  const handleSendWhatsApp = async () => {
    if (!selectedImobiliaria) {
      toast.error("Selecione uma imobiliária.");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          tipo_contrato: novoTipo,
          imobiliaria_id: selectedImobiliaria,
        })
        .select()
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/coleta/${data.token}`;
      const tipoInfo = tiposContrato.find((t) => t.id === novoTipo);
      const imob = imobiliarias.find((i) => i.id === selectedImobiliaria);
      const message = encodeURIComponent(
        `Olá${imob ? ` ${imob.nome}` : ""}! Segue o link para preenchimento dos dados do contrato (${tipoInfo?.nome}):\n\n${link}\n\nPreencha todos os campos e clique em "Enviar Dados" ao final.`
      );

      const phone = whatsappNumber.replace(/\D/g, "");
      const whatsappUrl = `https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${message}`;

      window.open(whatsappUrl, "_blank");
      toast.success("Link criado! WhatsApp aberto.");
      setDialogOpen(false);
      setWhatsappNumber("");
      setSelectedImobiliaria("");
    } catch (err) {
      toast.error("Erro ao criar link.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">ContratoPRO</h1>
              <p className="text-sm text-muted-foreground">Gerador Inteligente de Contratos Imobiliários</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-foreground mb-2">
              Novo Contrato
            </h2>
            <p className="text-muted-foreground text-lg">
              Selecione o tipo de contrato que deseja elaborar.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-success hover:bg-success/90 text-success-foreground">
                <Send className="w-4 h-4 mr-2" />
                Enviar Coleta via WhatsApp
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar Link de Coleta via WhatsApp</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Imobiliária *</Label>
                  <Select value={selectedImobiliaria} onValueChange={setSelectedImobiliaria}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a imobiliária" />
                    </SelectTrigger>
                    <SelectContent>
                      {imobiliarias.map((imob) => (
                        <SelectItem key={imob.id} value={imob.id}>
                          {imob.nome} (CRECI {imob.creci})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {imobiliarias.length === 0 && (
                    <p className="text-xs text-destructive mt-1">
                      Nenhuma imobiliária cadastrada.{" "}
                      <button onClick={() => { setDialogOpen(false); navigate("/imobiliarias"); }} className="underline">
                        Cadastrar agora
                      </button>
                    </p>
                  )}
                </div>
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
                <div>
                  <Label>WhatsApp do Corretor</Label>
                  <Input
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="(00) 00000-0000"
                    type="tel"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Informe o número com DDD</p>
                </div>
                <Button
                  onClick={handleSendWhatsApp}
                  disabled={creating || !whatsappNumber.trim() || !selectedImobiliaria}
                  className="w-full bg-success hover:bg-success/90 text-success-foreground"
                >
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Criar Link e Enviar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {tiposContrato.map((tipo) => {
            const Icon = iconMap[tipo.icone] || FileText;
            return (
              <button
                key={tipo.id}
                onClick={() => handleSelect(tipo.id)}
                className="group border border-border rounded-xl p-6 bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-200 text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground mb-1">
                      {tipo.nome}
                    </h3>
                    {tipo.subcategoria && (
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent mb-2">
                        {tipo.subcategoria}
                      </span>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tipo.descricao}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-8 border-t border-border flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/painel")}>
            <ClipboardList className="w-4 h-4 mr-2" />
            Painel de Coletas
          </Button>
          <Button variant="outline" onClick={() => navigate("/imobiliarias")}>
            <Building2 className="w-4 h-4 mr-2" />
            Imobiliárias
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
