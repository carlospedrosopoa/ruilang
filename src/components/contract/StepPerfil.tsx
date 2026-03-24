import { ShieldCheck, ShieldAlert, Scale } from "lucide-react";
import { PerfilContrato, perfisContrato } from "@/types/contract";

interface StepPerfilProps {
  perfilContrato: PerfilContrato;
  onChange: (perfil: PerfilContrato) => void;
}

const perfilIcons: Record<PerfilContrato, React.ReactNode> = {
  blindagem_vendedor: <ShieldCheck className="w-7 h-7" />,
  blindagem_comprador: <ShieldAlert className="w-7 h-7" />,
  equilibrado: <Scale className="w-7 h-7" />,
};

const StepPerfil = ({ perfilContrato, onChange }: StepPerfilProps) => {
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
    </div>
  );
};

export default StepPerfil;
