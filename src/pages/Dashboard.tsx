import { useMemo, useState, useEffect, useRef, type ChangeEvent } from "react";
import { FileText, ArrowLeftRight, ScrollText, Home, ClipboardList, Send, Loader2, Building2, Sparkles, ChevronRight, BarChart3, Users, Plus, FileCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { tiposContrato } from "@/types/contract";
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
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

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

interface CustomTipoContrato {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string;
  label_vendedor: string;
  label_comprador: string;
  modelo_base: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { activeTenantId, isPlatformAdmin, signOut } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState<string>("promessa_compra_venda");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [creating, setCreating] = useState(false);
  const [imobiliarias, setImobiliarias] = useState<Imobiliaria[]>([]);
  const [selectedImobiliaria, setSelectedImobiliaria] = useState<string>("");
  const [customTipos, setCustomTipos] = useState<CustomTipoContrato[]>([]);
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false);
  const [savingTipo, setSavingTipo] = useState(false);
  const [tipoNome, setTipoNome] = useState("");
  const [tipoDescricao, setTipoDescricao] = useState("");
  const [tipoLabelVendedor, setTipoLabelVendedor] = useState("Vendedor");
  const [tipoLabelComprador, setTipoLabelComprador] = useState("Comprador");
  const [tipoModeloBase, setTipoModeloBase] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadImobiliarias = async () => {
      const { data } = await supabase.from("imobiliarias").select("id, nome, creci").order("nome");
      setImobiliarias((data as Imobiliaria[]) || []);
    };
    loadImobiliarias();
  }, []);

  useEffect(() => {
    if (activeTenantId && !selectedImobiliaria) setSelectedImobiliaria(activeTenantId);
  }, [activeTenantId, selectedImobiliaria]);

  useEffect(() => {
    const loadCustomTipos = async () => {
      if (!selectedImobiliaria) {
        setCustomTipos([]);
        return;
      }
      const { data } = await supabase
        .from("tipos_contrato")
        .select("id, nome, descricao, icone, label_vendedor, label_comprador, modelo_base")
        .eq("imobiliaria_id", selectedImobiliaria)
        .eq("ativo", true)
        .order("created_at", { ascending: true });
      setCustomTipos((data as CustomTipoContrato[]) || []);
    };
    loadCustomTipos();
  }, [selectedImobiliaria]);

  const allTipos = useMemo(() => {
    return [
      ...tiposContrato.map((t) => ({ id: t.id as string, nome: t.nome, descricao: t.descricao, icone: t.icone, subcategoria: t.subcategoria })),
      ...customTipos.map((t) => ({ id: t.id, nome: t.nome, descricao: t.descricao || "", icone: t.icone, subcategoria: undefined })),
    ];
  }, [customTipos]);

  const handleSelect = async (tipo: string) => {
    try {
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          tipo_contrato: tipo,
          status: "rascunho",
          imobiliaria_id: selectedImobiliaria || null,
          dados: {},
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      navigate(`/contrato/${tipo}?submissionId=${data.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível criar o registro do contrato.");
      navigate(`/contrato/${tipo}`);
    }
  };

  const openCreateTipo = () => {
    if (!selectedImobiliaria) {
      toast.error("Selecione uma imobiliária para criar tipos personalizados.");
      return;
    }
    setTipoNome("");
    setTipoDescricao("");
    setTipoLabelVendedor("Vendedor");
    setTipoLabelComprador("Comprador");
    setTipoModeloBase("");
    setTipoDialogOpen(true);
  };

  const handleImportText = () => {
    importInputRef.current?.click();
  };

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "txt") {
        toast.error("Por enquanto, a importação suporta apenas arquivos .txt");
        return;
      }
      const text = await file.text();
      setTipoModeloBase(text);
      toast.success("Modelo importado.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const saveTipo = async () => {
    if (!selectedImobiliaria) {
      toast.error("Selecione uma imobiliária.");
      return;
    }
    if (!tipoNome.trim()) {
      toast.error("Informe o nome do tipo de contrato.");
      return;
    }
    setSavingTipo(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const { data, error } = await supabase
        .from("tipos_contrato")
        .insert({
          imobiliaria_id: selectedImobiliaria,
          nome: tipoNome.trim(),
          descricao: tipoDescricao.trim() || null,
          label_vendedor: tipoLabelVendedor.trim() || "Vendedor",
          label_comprador: tipoLabelComprador.trim() || "Comprador",
          modelo_base: tipoModeloBase.trim() || null,
          created_by: userId,
        } as any)
        .select("id, nome, descricao, icone, label_vendedor, label_comprador, modelo_base")
        .single();
      if (error) throw error;
      setCustomTipos((prev) => [...prev, data as any]);
      toast.success("Tipo de contrato criado!");
      setTipoDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar tipo de contrato.");
    } finally {
      setSavingTipo(false);
    }
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
      const tipoInfo = allTipos.find((t) => t.id === novoTipo);
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
      {/* Premium Header */}
      <header className="gradient-primary border-b border-primary/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/images/logo-sielichow.png" alt="Sielichow Advocacia Empresarial" className="h-10 w-auto" />
              <div>
                <h1 className="font-display text-xl font-bold text-primary-foreground tracking-tight">Sielichow</h1>
                <p className="text-xs text-primary-foreground/60 font-medium tracking-wide uppercase">Advocacia Empresarial</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/painel")}
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                <ClipboardList className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Coletas</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                <BarChart3 className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/clientes")}
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Users className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Clientes</span>
              </Button>
              {isPlatformAdmin ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/contratos")}
                    className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    <FileCheck className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">Contratos</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/imobiliarias")}
                    className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    <Building2 className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">Imobiliárias</span>
                  </Button>
                </>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                <ChevronRight className="w-4 h-4 mr-1.5 rotate-180" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="mb-10 animate-fade-in">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs font-semibold text-accent tracking-wide">POWERED BY AI</span>
                </div>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-2 tracking-tight">
                Novo Contrato
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg max-w-lg">
                Selecione o tipo de contrato e gere minutas profissionais em minutos.
              </p>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-card hover:shadow-elevated transition-all duration-200">
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Coleta
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display text-xl">Enviar Link de Coleta</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label className="text-sm font-medium">Imobiliária</Label>
                    <Select value={selectedImobiliaria} onValueChange={setSelectedImobiliaria}>
                      <SelectTrigger className="mt-1.5">
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
                      <p className="text-xs text-destructive mt-1.5">
                        Nenhuma imobiliária cadastrada.{" "}
                        <button onClick={() => { setDialogOpen(false); navigate("/imobiliarias"); }} className="underline font-medium">
                          Cadastrar agora
                        </button>
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Tipo de Contrato</Label>
                    <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allTipos.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">WhatsApp do Corretor</Label>
                    <Input
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="(00) 00000-0000"
                      type="tel"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">Informe o número com DDD</p>
                  </div>
                  <Button
                    onClick={handleSendWhatsApp}
                    disabled={creating || !whatsappNumber.trim() || !selectedImobiliaria}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                  >
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Criar Link e Enviar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Contract Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {allTipos.map((tipo, i) => {
            const Icon = iconMap[tipo.icone] || FileText;
            return (
              <button
                key={tipo.id}
                onClick={() => handleSelect(tipo.id)}
                className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 text-left transition-all duration-300 hover:border-primary/30 hover:shadow-elevated animate-fade-in-up"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
              >
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-accent/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/12 transition-colors duration-300">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display text-lg font-bold text-foreground tracking-tight">
                        {tipo.nome}
                      </h3>
                    </div>
                    {tipo.subcategoria && (
                      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/12 text-accent uppercase tracking-wider mb-2">
                        {tipo.subcategoria}
                      </span>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tipo.descricao}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary/60 group-hover:translate-x-0.5 transition-all duration-300 shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={openCreateTipo} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Novo Tipo de Contrato
          </Button>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept=".txt"
          onChange={onImportFile}
          className="hidden"
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground/60 text-center">
            Sielichow Advocacia Empresarial — Contratos imobiliários gerados com inteligência artificial
          </p>
        </div>
      </footer>

      <Dialog open={tipoDialogOpen} onOpenChange={setTipoDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo Tipo de Contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {isPlatformAdmin ? (
              <div>
                <Label className="text-sm font-medium">Imobiliária</Label>
                <Select value={selectedImobiliaria} onValueChange={setSelectedImobiliaria}>
                  <SelectTrigger className="mt-1.5">
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
              </div>
            ) : null}

            <div>
              <Label>Nome do Tipo</Label>
              <Input value={tipoNome} onChange={(e) => setTipoNome(e.target.value)} placeholder="Ex: Contrato de Comodato, Distrato..." />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={tipoDescricao} onChange={(e) => setTipoDescricao(e.target.value)} placeholder="Breve descrição do tipo de contrato" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Label da Parte 1</Label>
                <Input value={tipoLabelVendedor} onChange={(e) => setTipoLabelVendedor(e.target.value)} placeholder="Vendedor" />
              </div>
              <div>
                <Label>Label da Parte 2</Label>
                <Input value={tipoLabelComprador} onChange={(e) => setTipoLabelComprador(e.target.value)} placeholder="Comprador" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Modelo de Contrato Base (opcional)</Label>
              <Button variant="outline" size="sm" onClick={handleImportText}>Importar .txt</Button>
            </div>
            <Textarea
              value={tipoModeloBase}
              onChange={(e) => setTipoModeloBase(e.target.value)}
              className="min-h-[220px]"
              placeholder="Cole aqui o modelo de contrato base (opcional)..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTipoDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveTipo} disabled={savingTipo || !tipoNome.trim()}>
                {savingTipo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Criar Tipo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
