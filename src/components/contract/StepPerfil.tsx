import { ShieldCheck, ShieldAlert, Scale, MessageSquarePlus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PerfilContrato, TipoContrato, perfisContrato } from "@/types/contract";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StepPerfilProps {
  tipoContrato: TipoContrato;
  perfilContrato: PerfilContrato;
  onChange: (perfil: PerfilContrato) => void;
  peculiaridades?: string;
  onPeculiaridadesChange?: (value: string) => void;
  imobiliariaId?: string | null;
}

type PerfilItem = {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  instructions_ia?: string | null;
  origem: "builtin" | "custom";
};

const perfilIcons: Record<string, React.ReactNode> = {
  blindagem_vendedor: <ShieldCheck className="w-7 h-7" />,
  blindagem_comprador: <ShieldAlert className="w-7 h-7" />,
  equilibrado: <Scale className="w-7 h-7" />,
};

const iconByName: Record<string, React.ReactNode> = {
  ShieldCheck: <ShieldCheck className="w-7 h-7" />,
  ShieldAlert: <ShieldAlert className="w-7 h-7" />,
  Scale: <Scale className="w-7 h-7" />,
};

const perfilColors: Record<string, { bg: string; border: string; icon: string; activeBg: string }> = {
  blindagem_vendedor: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: "bg-orange-100 text-orange-600",
    activeBg: "bg-orange-50 border-orange-400 shadow-[0_0_0_1px_hsl(25,95%,53%,0.3)]",
  },
  blindagem_comprador: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "bg-blue-100 text-blue-600",
    activeBg: "bg-blue-50 border-blue-400 shadow-[0_0_0_1px_hsl(220,91%,54%,0.3)]",
  },
  equilibrado: {
    bg: "bg-secondary",
    border: "border-border",
    icon: "bg-muted text-muted-foreground",
    activeBg: "bg-primary/5 border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]",
  },
};

const StepPerfil = ({ tipoContrato, perfilContrato, onChange, peculiaridades = "", onPeculiaridadesChange, imobiliariaId }: StepPerfilProps) => {
  const { isPlatformAdmin } = useAuth();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateText, setTemplateText] = useState("");
  const [instructionsIa, setInstructionsIa] = useState("");
  const [hasActiveTemplate, setHasActiveTemplate] = useState(false);
  const [customPerfis, setCustomPerfis] = useState<PerfilItem[]>([]);
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [perfilNome, setPerfilNome] = useState("");
  const [perfilDescricao, setPerfilDescricao] = useState("");
  const [perfilIcone, setPerfilIcone] = useState("Scale");
  const [perfilInstructions, setPerfilInstructions] = useState("");

  const selectedPerfilLabel = useMemo(() => {
    const builtin = perfisContrato.find((p) => p.id === perfilContrato);
    if (builtin) return builtin.nome;
    const custom = customPerfis.find((p) => p.id === perfilContrato);
    return custom?.nome || "Perfil";
  }, [perfilContrato]);

  const allPerfis = useMemo<PerfilItem[]>(() => {
    const base = perfisContrato.map((p) => ({
      id: p.id as string,
      nome: p.nome,
      descricao: p.descricao,
      icone: p.icone,
      origem: "builtin" as const,
    }));
    return [...base, ...customPerfis];
  }, [customPerfis]);

  useEffect(() => {
    const loadCustom = async () => {
      if (!imobiliariaId) {
        setCustomPerfis([]);
        return;
      }
      const { data } = await supabase
        .from("perfis_contrato")
        .select("id, nome, descricao, icone, instructions_ia")
        .eq("imobiliaria_id", imobiliariaId)
        .eq("ativo", true)
        .order("created_at", { ascending: true });

      const list = ((data as any[]) || []).map((r) => ({
        id: r.id,
        nome: r.nome,
        descricao: r.descricao || "",
        icone: r.icone || "Scale",
        instructions_ia: r.instructions_ia || null,
        origem: "custom" as const,
      }));
      setCustomPerfis(list);
    };
    loadCustom();
  }, [imobiliariaId]);

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    const { data, error } = await supabase
      .from("contract_templates")
      .select("template_text, instructions_ia, active")
      .eq("tipo_contrato", tipoContrato)
      .eq("perfil", perfilContrato)
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setHasActiveTemplate(false);
      setTemplateText("");
      setInstructionsIa("");
      setLoadingTemplate(false);
      return;
    }

    setHasActiveTemplate(Boolean(data?.active));
    setTemplateText(data?.template_text || "");
    setInstructionsIa(data?.instructions_ia || "");
    setLoadingTemplate(false);
  };

  useEffect(() => {
    if (!templateOpen) return;
    loadTemplate();
  }, [templateOpen, tipoContrato, perfilContrato]);

  useEffect(() => {
    const refreshBadge = async () => {
      const { data } = await supabase
        .from("contract_templates")
        .select("id")
        .eq("tipo_contrato", tipoContrato)
        .eq("perfil", perfilContrato)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      setHasActiveTemplate(Boolean(data?.id));
    };
    refreshBadge();
  }, [tipoContrato, perfilContrato]);

  const save = async () => {
    if (!isPlatformAdmin) {
      toast.error("Apenas o administrador da plataforma pode alterar o modelo base.");
      return;
    }
    if (!templateText.trim()) {
      toast.error("Informe o texto do modelo base.");
      return;
    }

    setSavingTemplate(true);
    try {
      const last = await supabase
        .from("contract_templates")
        .select("version")
        .eq("tipo_contrato", tipoContrato)
        .eq("perfil", perfilContrato)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last.error) throw last.error;

      const nextVersion = (last.data?.version || 0) + 1;

      await supabase
        .from("contract_templates")
        .update({ active: false })
        .eq("tipo_contrato", tipoContrato)
        .eq("perfil", perfilContrato);

      const { error: insErr } = await supabase.from("contract_templates").insert({
        tipo_contrato: tipoContrato,
        perfil: perfilContrato,
        provider: "manual",
        model: null,
        version: nextVersion,
        active: true,
        template_text: templateText.trim(),
        instructions_ia: instructionsIa.trim() || null,
        updated_at: new Date().toISOString(),
      } as any);

      if (insErr) throw insErr;
      toast.success("Modelo base atualizado.");
      setTemplateOpen(false);
      setHasActiveTemplate(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar modelo base.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const openCreatePerfil = () => {
    if (!imobiliariaId) {
      toast.error("Selecione uma imobiliária para criar perfis.");
      return;
    }
    setPerfilNome("");
    setPerfilDescricao("");
    setPerfilIcone("Scale");
    setPerfilInstructions("");
    setPerfilDialogOpen(true);
  };

  const savePerfil = async () => {
    if (!imobiliariaId) {
      toast.error("Selecione uma imobiliária.");
      return;
    }
    if (!perfilNome.trim()) {
      toast.error("Informe o nome do perfil.");
      return;
    }
    setSavingPerfil(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const { data, error } = await supabase
        .from("perfis_contrato")
        .insert({
          imobiliaria_id: imobiliariaId,
          nome: perfilNome.trim(),
          descricao: perfilDescricao.trim() || null,
          icone: perfilIcone,
          instructions_ia: perfilInstructions.trim() || null,
          created_by: userId,
        } as any)
        .select("id, nome, descricao, icone, instructions_ia")
        .single();
      if (error) throw error;

      const created = {
        id: data.id,
        nome: data.nome,
        descricao: data.descricao || "",
        icone: data.icone || "Scale",
        instructions_ia: data.instructions_ia || null,
        origem: "custom" as const,
      };
      setCustomPerfis((prev) => [...prev, created]);
      onChange(created.id as any);
      toast.success("Perfil criado!");
      setPerfilDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar perfil.");
    } finally {
      setSavingPerfil(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1 tracking-tight">
          Perfil de Blindagem
        </h3>
        <p className="text-muted-foreground">
          Escolha o nível de proteção jurídica aplicado às cláusulas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {allPerfis.map((perfil, i) => {
          const isSelected = perfilContrato === (perfil.id as any);
          const colors = perfilColors[perfil.id] || perfilColors.equilibrado;
          
          return (
            <button
              key={perfil.id}
              onClick={() => onChange(perfil.id as any)}
              className={cn(
                "relative flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all duration-300 text-center group animate-fade-in-up",
                isSelected ? colors.activeBg : `border-border bg-card hover:${colors.border} hover:shadow-card`
              )}
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-scale-in">
                  <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />
                </div>
              )}

              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
                isSelected ? colors.icon : "bg-muted text-muted-foreground group-hover:bg-muted/80"
              )}>
                {perfilIcons[perfil.id] || iconByName[perfil.icone] || <Scale className="w-7 h-7" />}
              </div>
              
              <div>
                <span className="font-display font-bold text-foreground text-base block mb-1.5">{perfil.nome}</span>
                <span className="text-xs text-muted-foreground leading-relaxed">{perfil.descricao}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={openCreatePerfil}>
          <Plus className="w-4 h-4 mr-2" />
          Criar Novo Perfil
        </Button>
      </div>

      {/* Peculiaridades */}
      <div className="rounded-xl border border-accent/25 bg-accent/[0.04] p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
            <MessageSquarePlus className="w-4 h-4 text-accent" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground block">Peculiaridades do Contrato</span>
            <span className="text-xs text-muted-foreground">Opcional — descreva situações especiais</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Descreva acordos verbais, condições suspensivas ou detalhes relevantes. 
          A IA criará cláusulas personalizadas com base nas suas instruções.
        </p>
        <div>
          <Label className="sr-only">Peculiaridades do contrato</Label>
          <Textarea
            value={peculiaridades}
            onChange={(e) => onPeculiaridadesChange?.(e.target.value)}
            placeholder="Ex: O vendedor permanecerá no imóvel por 60 dias após a assinatura sem custos. O comprador assume dívidas de IPTU anteriores a 2024..."
            className="min-h-[120px] resize-y bg-card border-border/60 focus:border-accent/40"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="font-semibold text-foreground">Modelo Base</h4>
            <p className="text-sm text-muted-foreground">
              Contrato base usado para manter a minuta consistente. Perfil: {selectedPerfilLabel}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs px-2 py-1 rounded-md border", hasActiveTemplate ? "border-success/30 text-success" : "border-border text-muted-foreground")}>
              {hasActiveTemplate ? "Configurado" : "Padrão (IA)"}
            </span>
            <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
              Configurar
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Configurar Modelo Base</DialogTitle>
          </DialogHeader>
          {loadingTemplate ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label>Texto do Modelo Base</Label>
                  <Textarea
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    className="min-h-[260px]"
                    placeholder="Cole aqui o texto do contrato base (sem peculiaridades)."
                  />
                </div>
                <div>
                  <Label>Instruções adicionais para IA (opcional)</Label>
                  <Textarea
                    value={instructionsIa}
                    onChange={(e) => setInstructionsIa(e.target.value)}
                    className="min-h-[120px]"
                    placeholder="Ex.: Não alterar valores fixos; manter redação do modelo; inserir peculiaridades como cláusulas adicionais."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={savingTemplate}>
                  {savingTemplate ? "Salvando..." : "Salvar"}
                </Button>
              </div>
              {!isPlatformAdmin ? (
                <p className="text-xs text-muted-foreground">
                  Apenas o administrador da plataforma pode salvar alterações do modelo base.
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={perfilDialogOpen} onOpenChange={setPerfilDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome</Label>
                <Input value={perfilNome} onChange={(e) => setPerfilNome(e.target.value)} placeholder="Ex: Blindagem Máxima" />
              </div>
              <div>
                <Label>Ícone</Label>
                <Select value={perfilIcone} onValueChange={setPerfilIcone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ShieldCheck">ShieldCheck</SelectItem>
                    <SelectItem value="ShieldAlert">ShieldAlert</SelectItem>
                    <SelectItem value="Scale">Scale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={perfilDescricao} onChange={(e) => setPerfilDescricao(e.target.value)} placeholder="Breve descrição do perfil" />
            </div>
            <div>
              <Label>Instruções para IA (opcional)</Label>
              <Textarea
                value={perfilInstructions}
                onChange={(e) => setPerfilInstructions(e.target.value)}
                className="min-h-[160px]"
                placeholder="Ex.: Priorizar cláusulas favoráveis ao vendedor; impor condições mais rígidas em caso de inadimplemento..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPerfilDialogOpen(false)}>Cancelar</Button>
              <Button onClick={savePerfil} disabled={savingPerfil || !perfilNome.trim()}>
                {savingPerfil ? "Salvando..." : "Criar Perfil"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StepPerfil;
