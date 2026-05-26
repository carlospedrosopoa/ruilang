import StepVendedores from "./StepVendedores";
import { Pessoa, Procurador, Anuente } from "@/types/contract";

interface StepCompradoresProps {
  compradores: Pessoa[];
  onChange: (compradores: Pessoa[]) => void;
  procuradores: Procurador[];
  onProcuradoresChange: (procuradores: Procurador[]) => void;
  anuentes: Anuente[];
  onAnuentesChange: (anuentes: Anuente[]) => void;
  emailRequired?: boolean;
  onExtractFiles?: (files: File[]) => Promise<void> | void;
  errors?: Array<{ field: string; message: string; index?: number }>;
  submissionId?: string;
}

const StepCompradores = ({ compradores, onChange, procuradores, onProcuradoresChange, anuentes, onAnuentesChange, emailRequired, onExtractFiles, errors, submissionId }: StepCompradoresProps) => {
  return (
    <StepVendedores
      vendedores={compradores}
      onChange={onChange}
      procuradores={procuradores}
      onProcuradoresChange={onProcuradoresChange}
      anuentes={anuentes}
      onAnuentesChange={onAnuentesChange}
      titulo="Comprador"
      tituloPlural="Comprador(es)"
      simetricas
      numeroBase={2}
      emailRequired={emailRequired}
      onExtractFiles={onExtractFiles}
      errors={errors}
      submissionId={submissionId}
    />
  );
};

export default StepCompradores;
