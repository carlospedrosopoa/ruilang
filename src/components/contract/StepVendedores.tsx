import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import PessoaForm from "./PessoaForm";
import { Pessoa, criarPessoaVazia } from "@/types/contract";

interface StepVendedoresProps {
  vendedores: Pessoa[];
  onChange: (vendedores: Pessoa[]) => void;
  titulo?: string;
  tituloPlural?: string;
  emailRequired?: boolean;
  onExtractFiles?: (files: File[]) => Promise<void> | void;
}

const needsConjuge = (ec: string) => ec === "Casado(a)" || ec === "União Estável";

const StepVendedores = ({ vendedores, onChange, titulo = "Vendedor", tituloPlural = "Vendedor(es)", emailRequired, onExtractFiles }: StepVendedoresProps) => {
  const addVendedor = () => onChange([...vendedores, criarPessoaVazia()]);

  const updateVendedor = (index: number, pessoa: Pessoa) => {
    const updated = [...vendedores];
    const old = updated[index];
    updated[index] = pessoa;

    // Se mudou para casado/união estável e não tinha cônjuge vinculado, adiciona automaticamente
    if (needsConjuge(pessoa.estadoCivil) && !needsConjuge(old.estadoCivil)) {
      const conjugeExiste = updated.some(p => p.conjugeDeId === pessoa.id);
      if (!conjugeExiste) {
        const conjuge = criarPessoaVazia();
        conjuge.conjugeDeId = pessoa.id;
        conjuge.estadoCivil = pessoa.estadoCivil;
        conjuge.regimeBens = pessoa.regimeBens;
        // Herda endereço
        conjuge.endereco = pessoa.endereco;
        conjuge.bairro = pessoa.bairro;
        conjuge.cidade = pessoa.cidade;
        conjuge.estado = pessoa.estado;
        conjuge.cep = pessoa.cep;
        // Insere logo após a pessoa
        updated.splice(index + 1, 0, conjuge);
      }
    }

    // Se mudou de casado/união estável para outro estado civil, remove cônjuge vinculado
    if (!needsConjuge(pessoa.estadoCivil) && needsConjuge(old.estadoCivil)) {
      const conjugeIdx = updated.findIndex(p => p.conjugeDeId === pessoa.id);
      if (conjugeIdx !== -1) {
        updated.splice(conjugeIdx, 1);
      }
    }

    // Sincroniza regime de bens e estado civil com cônjuge vinculado
    if (needsConjuge(pessoa.estadoCivil)) {
      const conjugeIdx = updated.findIndex(p => p.conjugeDeId === pessoa.id);
      if (conjugeIdx !== -1) {
        updated[conjugeIdx] = {
          ...updated[conjugeIdx],
          estadoCivil: pessoa.estadoCivil,
          regimeBens: pessoa.regimeBens,
        };
      }
    }

    onChange(updated);
  };

  const removeVendedor = (index: number) => {
    const pessoa = vendedores[index];
    let updated = vendedores.filter((_, i) => i !== index);
    // Se remover a pessoa principal, remove o cônjuge vinculado também
    if (!pessoa.conjugeDeId) {
      updated = updated.filter(p => p.conjugeDeId !== pessoa.id);
    }
    if (updated.length === 0) updated = [criarPessoaVazia()];
    onChange(updated);
  };

  const canRemove = (pessoa: Pessoa) => {
    // Cônjuge vinculado não pode ser removido diretamente
    if (pessoa.conjugeDeId) return false;
    return vendedores.filter(p => !p.conjugeDeId).length > 1;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">
          {tituloPlural}
        </h3>
        <p className="text-muted-foreground">
          Informe os dados de qualificação. Cônjuges e companheiros são adicionados automaticamente como partes plenas do contrato.
        </p>
      </div>

      {vendedores.map((vendedor, index) => {
        const pessoaPrincipal = vendedor.conjugeDeId
          ? vendedores.find(p => p.id === vendedor.conjugeDeId)
          : undefined;

        return (
          <PessoaForm
            key={vendedor.id}
            pessoa={vendedor}
            onChange={(p) => updateVendedor(index, p)}
            onRemove={canRemove(vendedor) ? () => removeVendedor(index) : undefined}
            titulo={
              vendedor.conjugeDeId
                ? pessoaPrincipal?.estadoCivil === "União Estável"
                  ? `Companheiro(a) de ${pessoaPrincipal?.nome || titulo}`
                  : `Cônjuge de ${pessoaPrincipal?.nome || titulo}`
                : titulo
            }
            index={index}
            isConjuge={!!vendedor.conjugeDeId}
            hideEstadoCivil={!!vendedor.conjugeDeId}
            emailRequired={emailRequired}
            onExtractFiles={onExtractFiles}
          />
        );
      })}

      <Button variant="outline" onClick={addVendedor} className="w-full border-dashed">
        <UserPlus className="w-4 h-4 mr-2" />
        Adicionar {titulo}
      </Button>
    </div>
  );
};

export default StepVendedores;
