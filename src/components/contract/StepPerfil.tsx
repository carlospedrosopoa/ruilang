import { ShieldCheck, ShieldAlert, Scale, MessageSquarePlus, Check } from "lucide-react";
import { PerfilContrato, perfisContrato } from "@/types/contract";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface StepPerfilProps {
  perfilContrato: PerfilContrato;
  onChange: (perfil: PerfilContrato) => void;
  peculiaridades?: string;
  onPeculiaridadesChange?: (value: string) => void;
}

const perfilIcons: Record<PerfilContrato, React.ReactNode> = {
  blindagem_vendedor: <ShieldCheck className="w-7 h-7" />,
  blindagem_comprador: <ShieldAlert className="w-7 h-7" />,
  equilibrado: <Scale className="w-7 h-7" />,
};

const perfilColors: Record<PerfilContrato, { bg: string; border: string; icon: string; activeBg: string }> = {
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

const StepPerfil = ({ perfilContrato, onChange, peculiaridades = "", onPeculiaridadesChange }: StepPerfilProps) => {
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
        {perfisContrato.map((perfil, i) => {
          const isSelected = perfilContrato === perfil.id;
          const colors = perfilColors[perfil.id];
          
          return (
            <button
              key={perfil.id}
              onClick={() => onChange(perfil.id)}
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
                {perfilIcons[perfil.id]}
              </div>
              
              <div>
                <span className="font-display font-bold text-foreground text-base block mb-1.5">{perfil.nome}</span>
                <span className="text-xs text-muted-foreground leading-relaxed">{perfil.descricao}</span>
              </div>
            </button>
          );
        })}
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
    </div>
  );
};

export default StepPerfil;
