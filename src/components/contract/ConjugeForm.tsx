import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Conjuge } from "@/types/contract";
import { Heart } from "lucide-react";

interface ConjugeFormProps {
  conjuge: Conjuge;
  onChange: (conjuge: Conjuge) => void;
  label: string;
}

const ConjugeForm = ({ conjuge, onChange, label }: ConjugeFormProps) => {
  const update = (field: keyof Conjuge, value: string) => {
    onChange({ ...conjuge, [field]: value });
  };

  return (
    <div className="border border-primary/20 rounded-lg p-4 space-y-4 bg-primary/5">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Heart className="w-4 h-4" />
        Dados do(a) {label}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Nome Completo</Label>
          <Input value={conjuge.nome} onChange={(e) => update("nome", e.target.value)} placeholder="Nome completo" />
        </div>

        <div>
          <Label>Nacionalidade</Label>
          <Input value={conjuge.nacionalidade} onChange={(e) => update("nacionalidade", e.target.value)} placeholder="brasileira" />
        </div>

        <div>
          <Label>Profissão</Label>
          <Input value={conjuge.profissao} onChange={(e) => update("profissao", e.target.value)} placeholder="Ex: empresária" />
        </div>

        <div>
          <Label>Tipo de Documento</Label>
          <Select value={conjuge.documentoTipo} onValueChange={(v) => update("documentoTipo", v as "rg" | "cnh")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rg">RG</SelectItem>
              <SelectItem value="cnh">CNH</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Nº do Documento</Label>
          <Input value={conjuge.documentoNumero} onChange={(e) => update("documentoNumero", e.target.value)} placeholder="Número" />
        </div>

        <div>
          <Label>Órgão Expedidor</Label>
          <Input value={conjuge.documentoOrgao} onChange={(e) => update("documentoOrgao", e.target.value)} placeholder="Ex: SSP/RS" />
        </div>

        <div>
          <Label>CPF</Label>
          <Input value={conjuge.cpf} onChange={(e) => update("cpf", e.target.value)} placeholder="000.000.000-00" />
        </div>
      </div>
    </div>
  );
};

export default ConjugeForm;
