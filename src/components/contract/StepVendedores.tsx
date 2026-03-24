import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import PessoaForm from "./PessoaForm";
import { Pessoa, criarPessoaVazia } from "@/types/contract";

interface StepVendedoresProps {
  vendedores: Pessoa[];
  onChange: (vendedores: Pessoa[]) => void;
  titulo?: string;
  tituloPlural?: string;
}

const StepVendedores = ({ vendedores, onChange, titulo = "Vendedor", tituloPlural = "Vendedor(es)" }: StepVendedoresProps) => {
  const addVendedor = () => onChange([...vendedores, criarPessoaVazia()]);

  const updateVendedor = (index: number, pessoa: Pessoa) => {
    const updated = [...vendedores];
    updated[index] = pessoa;
    onChange(updated);
  };

  const removeVendedor = (index: number) => {
    if (vendedores.length <= 1) return;
    onChange(vendedores.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">
          {tituloPlural}
        </h3>
        <p className="text-muted-foreground">
          Informe os dados de qualificação.
        </p>
      </div>

      {vendedores.map((vendedor, index) => (
        <PessoaForm
          key={vendedor.id}
          pessoa={vendedor}
          onChange={(p) => updateVendedor(index, p)}
          onRemove={vendedores.length > 1 ? () => removeVendedor(index) : undefined}
          titulo={titulo}
          index={index}
        />
      ))}

      <Button variant="outline" onClick={addVendedor} className="w-full border-dashed">
        <UserPlus className="w-4 h-4 mr-2" />
        Adicionar {titulo}
      </Button>
    </div>
  );
};

export default StepVendedores;
