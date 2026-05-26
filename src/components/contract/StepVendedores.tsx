import { Button } from "@/components/ui/button";
import { UserPlus, Plus } from "lucide-react";
import PessoaForm from "./PessoaForm";
import ProcuradorForm from "./ProcuradorForm";
import AnuenteForm from "./AnuenteForm";
import { Pessoa, criarPessoaVazia, Procurador, Anuente, criarProcuradorVazio, criarAnuenteVazio } from "@/types/contract";

interface StepVendedoresProps {
  vendedores: Pessoa[];
  onChange: (vendedores: Pessoa[]) => void;
  procuradores: Procurador[];
  onProcuradoresChange: (procuradores: Procurador[]) => void;
  anuentes: Anuente[];
  onAnuentesChange: (anuentes: Anuente[]) => void;
  titulo?: string;
  tituloPlural?: string;
  simetricas?: boolean;
  numeroBase?: 1 | 2;
  emailRequired?: boolean;
  onExtractFiles?: (files: File[]) => Promise<void> | void;
  errors?: Array<{ field: string; message: string; index?: number }>;
  submissionId?: string;
}

const needsConjuge = (ec: string) => ec === "Casado(a)" || ec === "União Estável";

const StepVendedores = ({ vendedores, onChange, procuradores, onProcuradoresChange, anuentes, onAnuentesChange, titulo = "Vendedor", tituloPlural = "Vendedor(es)", simetricas, numeroBase = 1, emailRequired, onExtractFiles, errors, submissionId }: StepVendedoresProps) => {
  const addVendedor = () => onChange([...vendedores, criarPessoaVazia()]);
  
  const addProcurador = (parteIndice: number) => {
    if (!submissionId) return;
    onProcuradoresChange([...procuradores, criarProcuradorVazio(submissionId, "vendedor", parteIndice)]);
  };
  
  const addAnuente = () => {
    if (!submissionId) return;
    onAnuentesChange([...anuentes, criarAnuenteVazio(submissionId)]);
  };
  
  const updateProcurador = (index: number, procurador: Procurador) => {
    const updated = [...procuradores];
    updated[index] = procurador;
    onProcuradoresChange(updated);
  };
  
  const removeProcurador = (index: number) => {
    onProcuradoresChange(procuradores.filter((_, i) => i !== index));
  };
  
  const updateAnuente = (index: number, anuente: Anuente) => {
    const updated = [...anuentes];
    updated[index] = anuente;
    onAnuentesChange(updated);
  };
  
  const removeAnuente = (index: number) => {
    onAnuentesChange(anuentes.filter((_, i) => i !== index));
  };

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
        const principalPos = vendedor.conjugeDeId ? null : vendedores.slice(0, index + 1).filter((p) => !p.conjugeDeId).length - 1;
        const displayNumber = vendedor.conjugeDeId
          ? undefined
          : simetricas
            ? principalPos * 2 + (numeroBase === 1 ? 1 : 2)
            : (principalPos + 1);

        const pessoaErrors = errors?.filter(e => e.index === index) || [];
        const isPrincipal = !vendedor.conjugeDeId;
        const principalIndex = isPrincipal ? principalPos : -1;
        
        const procuradoresDoParte = procuradores.filter(p => p.parteTipo === "vendedor" && p.parteIndice === principalIndex);
        
        return (
          <div key={vendedor.id} className="space-y-4">
            <PessoaForm
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
              displayNumber={displayNumber}
              isConjuge={!!vendedor.conjugeDeId}
              hideEstadoCivil={!!vendedor.conjugeDeId}
              emailRequired={emailRequired}
              onExtractFiles={onExtractFiles}
              errors={pessoaErrors}
            />
            
            {isPrincipal && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addProcurador(principalIndex)}
                  className="text-sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Adicionar Procurador deste {titulo}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addAnuente}
                  className="text-sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Adicionar Anuente
                </Button>
              </div>
            )}
            
            {procuradoresDoParte.map((procurador, pIndex) => {
              const globalIndex = procuradores.indexOf(procurador);
              return (
                <ProcuradorForm
                  key={procurador.id}
                  procurador={procurador}
                  onChange={(p) => updateProcurador(globalIndex, p)}
                  onRemove={() => removeProcurador(globalIndex)}
                  representanteNome={vendedor.nome}
                  index={globalIndex}
                  onExtractFiles={onExtractFiles}
                />
              );
            })}
          </div>
        );
      })}

      {anuentes.map((anuente, index) => (
        <AnuenteForm
          key={anuente.id}
          anuente={anuente}
          onChange={(a) => updateAnuente(index, a)}
          onRemove={() => removeAnuente(index)}
          index={index}
          onExtractFiles={onExtractFiles}
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
