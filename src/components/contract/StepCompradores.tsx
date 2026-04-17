import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import PessoaForm from "./PessoaForm";
import { Pessoa, criarPessoaVazia } from "@/types/contract";

interface StepCompradoresProps {
  compradores: Pessoa[];
  onChange: (compradores: Pessoa[]) => void;
  titulo?: string;
  tituloPlural?: string;
  onExtractFiles?: (files: File[]) => Promise<void> | void;
}

const needsConjuge = (ec: string) => ec === "Casado(a)" || ec === "União Estável";

const StepCompradores = ({ compradores, onChange, titulo = "Comprador", tituloPlural = "Comprador(es)", onExtractFiles }: StepCompradoresProps) => {
  const add = () => onChange([...compradores, criarPessoaVazia()]);

  const update = (index: number, pessoa: Pessoa) => {
    const updated = [...compradores];
    const old = updated[index];
    updated[index] = pessoa;

    if (needsConjuge(pessoa.estadoCivil) && !needsConjuge(old.estadoCivil)) {
      const conjugeExiste = updated.some(p => p.conjugeDeId === pessoa.id);
      if (!conjugeExiste) {
        const conjuge = criarPessoaVazia();
        conjuge.conjugeDeId = pessoa.id;
        conjuge.estadoCivil = pessoa.estadoCivil;
        conjuge.regimeBens = pessoa.regimeBens;
        conjuge.endereco = pessoa.endereco;
        conjuge.bairro = pessoa.bairro;
        conjuge.cidade = pessoa.cidade;
        conjuge.estado = pessoa.estado;
        conjuge.cep = pessoa.cep;
        updated.splice(index + 1, 0, conjuge);
      }
    }

    if (!needsConjuge(pessoa.estadoCivil) && needsConjuge(old.estadoCivil)) {
      const conjugeIdx = updated.findIndex(p => p.conjugeDeId === pessoa.id);
      if (conjugeIdx !== -1) {
        updated.splice(conjugeIdx, 1);
      }
    }

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

  const remove = (index: number) => {
    const pessoa = compradores[index];
    let updated = compradores.filter((_, i) => i !== index);
    if (!pessoa.conjugeDeId) {
      updated = updated.filter(p => p.conjugeDeId !== pessoa.id);
    }
    if (updated.length === 0) updated = [criarPessoaVazia()];
    onChange(updated);
  };

  const canRemove = (pessoa: Pessoa) => {
    if (pessoa.conjugeDeId) return false;
    return compradores.filter(p => !p.conjugeDeId).length > 1;
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

      {compradores.map((comprador, index) => {
        const pessoaPrincipal = comprador.conjugeDeId
          ? compradores.find(p => p.id === comprador.conjugeDeId)
          : undefined;

        return (
          <PessoaForm
            key={comprador.id}
            pessoa={comprador}
            onChange={(p) => update(index, p)}
            onRemove={canRemove(comprador) ? () => remove(index) : undefined}
            titulo={
              comprador.conjugeDeId
                ? pessoaPrincipal?.estadoCivil === "União Estável"
                  ? `Companheiro(a) de ${pessoaPrincipal?.nome || titulo}`
                  : `Cônjuge de ${pessoaPrincipal?.nome || titulo}`
                : titulo
            }
            index={index}
            isConjuge={!!comprador.conjugeDeId}
            hideEstadoCivil={!!comprador.conjugeDeId}
            onExtractFiles={onExtractFiles}
          />
        );
      })}

      <Button variant="outline" onClick={add} className="w-full border-dashed">
        <UserPlus className="w-4 h-4 mr-2" />
        Adicionar {titulo}
      </Button>
    </div>
  );
};

export default StepCompradores;
