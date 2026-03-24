import { ShieldCheck, ShieldAlert, Scale, MessageSquarePlus } from "lucide-react";
import { PerfilContrato, perfisContrato } from "@/types/contract";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

const StepPerfil = ({ perfilContrato, onChange, peculiaridades = "", onPeculiaridadesChange }: StepPerfilProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">
          Perfil de Blindagem do Contrato
        </h3>
        <p className="text-muted-foreground">
          Escolha o nível de proteção jurídica que será aplicado às cláusulas da minuta.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {perfisContrato.map((perfil) => (
          <button
            key={perfil.id}
            onClick={() => onChange(perfil.id)}
            className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all text-left ${
              perfilContrato === perfil.id
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border bg-card hover:border-muted-foreground/30"
            }`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              perfilContrato === perfil.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {perfilIcons[perfil.id]}
            </div>
            <span className="font-semibold text-foreground text-sm text-center">{perfil.nome}</span>
            <span className="text-xs text-muted-foreground text-center leading-relaxed">{perfil.descricao}</span>
            {perfilContrato === perfil.id && (
              <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Campo de peculiaridades */}
      <div className="border-2 border-dashed border-accent/40 rounded-lg p-5 bg-accent/5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquarePlus className="w-5 h-5 text-primary" />
          Este contrato tem alguma peculiaridade?
        </div>
        <p className="text-xs text-muted-foreground">
          Descreva situações especiais, acordos verbais, condições suspensivas ou qualquer detalhe relevante. 
          A IA criará cláusulas personalizadas com base nas suas instruções e nos nossos modelos jurídicos.
        </p>
        <div>
          <Label className="sr-only">Peculiaridades do contrato</Label>
          <Textarea
            value={peculiaridades}
            onChange={(e) => onPeculiaridadesChange?.(e.target.value)}
            placeholder="Ex: O vendedor permanecerá no imóvel por 60 dias após a assinatura sem custos. O comprador assume dívidas de IPTU anteriores a 2024. Há uma servidão de passagem no fundo do terreno..."
            className="min-h-[120px] resize-y"
          />
        </div>
      </div>
    </div>
  );
};

export default StepPerfil;
