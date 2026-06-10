import StepVendedores from "./StepVendedores";
import { Pessoa, Procurador, Anuente } from "@/types/contract";

interface StepCompradoresProps {
  compradores: Pessoa[];
  onChange: (compradores: Pessoa[]) => void;
  procuradores?: Procurador[];
  onProcuradoresChange?: (procuradores: Procurador[]) => void;
  anuentes?: Anuente[];
  onAnuentesChange?: (anuentes: Anuente[]) => void;
  titulo?: string;
  tituloPlural?: string;
  simetricas?: boolean;
  numeroBase?: 1 | 2;
  emailRequired?: boolean;
  onExtractFiles?: (files: File[]) => Promise<void> | void;
  errors?: Array<{ field: string; message: string; index?: number }>;
  submissionId?: string;
}

const StepCompradores = ({
  compradores,
  onChange,
  procuradores = [],
  onProcuradoresChange,
  anuentes = [],
  onAnuentesChange,
  titulo = "Comprador",
  tituloPlural = "Comprador(es)",
  simetricas = true,
  numeroBase = 2,
  emailRequired,
  onExtractFiles,
  errors,
  submissionId,
}: StepCompradoresProps) => {
  return (
    <StepVendedores
      vendedores={compradores}
      onChange={onChange}
      procuradores={procuradores}
      onProcuradoresChange={onProcuradoresChange}
      anuentes={anuentes}
      onAnuentesChange={onAnuentesChange}
      titulo={titulo}
      tituloPlural={tituloPlural}
      simetricas={simetricas}
      numeroBase={numeroBase}
      emailRequired={emailRequired}
      onExtractFiles={onExtractFiles}
      errors={errors}
      submissionId={submissionId}
    />
  );
};

export default StepCompradores;
