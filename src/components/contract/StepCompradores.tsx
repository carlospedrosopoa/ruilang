import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import PessoaForm from "./PessoaForm";
import { Pessoa, criarPessoaVazia } from "@/types/contract";

interface StepCompradoresProps {
  compradores: Pessoa[];
  onChange: (compradores: Pessoa[]) => void;
  titulo?: string;
  tituloPlural?: string;
}

const StepCompradores = ({ compradores, onChange, titulo = "Comprador", tituloPlural = "Comprador(es)" }: StepCompradoresProps) => {
  const add = () => onChange([...compradores, criarPessoaVazia()]);

  const update = (index: number, pessoa: Pessoa) => {
    const updated = [...compradores];
    updated[index] = pessoa;
    onChange(updated);
  };

  const remove = (index: number) => {
    if (compradores.length <= 1) return;
    onChange(compradores.filter((_, i) => i !== index));
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

      {compradores.map((comprador, index) => (
        <PessoaForm
          key={comprador.id}
          pessoa={comprador}
          onChange={(p) => update(index, p)}
          onRemove={compradores.length > 1 ? () => remove(index) : undefined}
          titulo={titulo}
          index={index}
        />
      ))}

      <Button variant="outline" onClick={add} className="w-full border-dashed">
        <UserPlus className="w-4 h-4 mr-2" />
        Adicionar {titulo}
      </Button>
    </div>
  );
};

export default StepCompradores;
