import { FileText, ArrowLeftRight, ScrollText, Home, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { tiposContrato, TipoContrato } from "@/types/contract";
import { Button } from "@/components/ui/button";

const iconMap: Record<string, React.ElementType> = {
  FileText,
  ArrowLeftRight,
  ScrollText,
  Home,
};

const Dashboard = () => {
  const navigate = useNavigate();

  const handleSelect = (tipo: TipoContrato) => {
    navigate(`/contrato/${tipo}`);
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
        <div className="mb-8">
          <h2 className="font-display text-3xl font-bold text-foreground mb-2">
            Novo Contrato
          </h2>
          <p className="text-muted-foreground text-lg">
            Selecione o tipo de contrato que deseja elaborar.
          </p>
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
      </main>
    </div>
  );
};

export default Dashboard;
