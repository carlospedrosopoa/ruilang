import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Pessoa, estadosCivis, estadosBR } from "@/types/contract";

interface PessoaFormProps {
  pessoa: Pessoa;
  onChange: (pessoa: Pessoa) => void;
  onRemove?: () => void;
  titulo: string;
  index: number;
}

const PessoaForm = ({ pessoa, onChange, onRemove, titulo, index }: PessoaFormProps) => {
  const update = (field: keyof Pessoa, value: string) => {
    onChange({ ...pessoa, [field]: value });
  };

  return (
    <div className="border border-border rounded-lg p-5 space-y-4 bg-card">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-lg font-semibold text-foreground">
          {titulo} {index + 1}
        </h4>
        {onRemove && (
          <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Nome Completo *</Label>
          <Input value={pessoa.nome} onChange={(e) => update("nome", e.target.value)} placeholder="Nome completo" />
        </div>

        <div>
          <Label>Nacionalidade</Label>
          <Input value={pessoa.nacionalidade} onChange={(e) => update("nacionalidade", e.target.value)} placeholder="brasileira" />
        </div>

        <div>
          <Label>Profissão *</Label>
          <Input value={pessoa.profissao} onChange={(e) => update("profissao", e.target.value)} placeholder="Ex: empresário" />
        </div>

        <div>
          <Label>Estado Civil *</Label>
          <Select value={pessoa.estadoCivil} onValueChange={(v) => update("estadoCivil", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {estadosCivis.map((ec) => (
                <SelectItem key={ec} value={ec}>{ec}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {pessoa.estadoCivil === "Casado(a)" && (
          <div>
            <Label>Regime de Bens</Label>
            <Input value={pessoa.regimeBens || ""} onChange={(e) => update("regimeBens", e.target.value)} placeholder="Ex: comunhão universal" />
          </div>
        )}

        <div>
          <Label>Tipo de Documento</Label>
          <Select value={pessoa.documentoTipo} onValueChange={(v) => update("documentoTipo", v as "rg" | "cnh")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rg">RG</SelectItem>
              <SelectItem value="cnh">CNH</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Nº do Documento *</Label>
          <Input value={pessoa.documentoNumero} onChange={(e) => update("documentoNumero", e.target.value)} placeholder="Número" />
        </div>

        <div>
          <Label>Órgão Expedidor *</Label>
          <Input value={pessoa.documentoOrgao} onChange={(e) => update("documentoOrgao", e.target.value)} placeholder="Ex: SSP/RS" />
        </div>

        <div>
          <Label>CPF *</Label>
          <Input value={pessoa.cpf} onChange={(e) => update("cpf", e.target.value)} placeholder="000.000.000-00" />
        </div>

        <div>
          <Label>Filiação — Pai</Label>
          <Input value={pessoa.filiacaoPai} onChange={(e) => update("filiacaoPai", e.target.value)} placeholder="Nome do pai" />
        </div>

        <div>
          <Label>Filiação — Mãe</Label>
          <Input value={pessoa.filiacaoMae} onChange={(e) => update("filiacaoMae", e.target.value)} placeholder="Nome da mãe" />
        </div>

        <div className="md:col-span-2">
          <Label>Endereço Completo *</Label>
          <Input value={pessoa.endereco} onChange={(e) => update("endereco", e.target.value)} placeholder="Rua, número, complemento" />
        </div>

        <div>
          <Label>Bairro *</Label>
          <Input value={pessoa.bairro} onChange={(e) => update("bairro", e.target.value)} placeholder="Bairro" />
        </div>

        <div>
          <Label>Cidade *</Label>
          <Input value={pessoa.cidade} onChange={(e) => update("cidade", e.target.value)} placeholder="Cidade" />
        </div>

        <div>
          <Label>Estado *</Label>
          <Select value={pessoa.estado} onValueChange={(v) => update("estado", v)}>
            <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              {estadosBR.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>CEP</Label>
          <Input value={pessoa.cep} onChange={(e) => update("cep", e.target.value)} placeholder="00000-000" />
        </div>

        <div>
          <Label>E-mail</Label>
          <Input type="email" value={pessoa.email || ""} onChange={(e) => update("email", e.target.value)} placeholder="email@exemplo.com" />
        </div>

        <div>
          <Label>Telefone</Label>
          <Input value={pessoa.telefone || ""} onChange={(e) => update("telefone", e.target.value)} placeholder="(00) 00000-0000" />
        </div>
      </div>
    </div>
  );
};

export default PessoaForm;
