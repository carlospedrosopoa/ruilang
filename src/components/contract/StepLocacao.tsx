import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Locacao } from "@/types/contract";

interface StepLocacaoProps {
  locacao: Locacao;
  onChange: (locacao: Locacao) => void;
}

const StepLocacao = ({ locacao, onChange }: StepLocacaoProps) => {
  const update = (field: keyof Locacao, value: string) => {
    onChange({ ...locacao, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">
          Condições da Locação
        </h3>
        <p className="text-muted-foreground">
          Defina os termos do contrato de locação.
        </p>
      </div>

      <div className="border border-border rounded-lg p-5 space-y-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Finalidade *</Label>
            <Select value={locacao.finalidade} onValueChange={(v) => update("finalidade", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="residencial">Residencial</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Valor do Aluguel (R$) *</Label>
            <Input value={locacao.valorAluguel} onChange={(e) => update("valorAluguel", e.target.value)} placeholder="Ex: 2.500,00" />
          </div>

          <div>
            <Label>Dia do Vencimento *</Label>
            <Input value={locacao.diaVencimento} onChange={(e) => update("diaVencimento", e.target.value)} placeholder="Ex: 10" />
          </div>

          <div>
            <Label>Prazo (meses) *</Label>
            <Input value={locacao.prazoMeses} onChange={(e) => update("prazoMeses", e.target.value)} placeholder="Ex: 30" />
          </div>

          <div>
            <Label>Índice de Reajuste</Label>
            <Select value={locacao.indiceReajuste} onValueChange={(v) => update("indiceReajuste", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IGPM/FGV">IGPM/FGV</SelectItem>
                <SelectItem value="IPCA/IBGE">IPCA/IBGE</SelectItem>
                <SelectItem value="INPC/IBGE">INPC/IBGE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Caução</Label>
            <Select value={locacao.caucao} onValueChange={(v) => update("caucao", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {locacao.caucao === "sim" && (
            <div>
              <Label>Valor da Caução (R$)</Label>
              <Input value={locacao.valorCaucao} onChange={(e) => update("valorCaucao", e.target.value)} placeholder="Ex: 7.500,00" />
            </div>
          )}

          <div>
            <Label>Multa por Rescisão Antecipada (%)</Label>
            <Input value={locacao.multaRescisao} onChange={(e) => update("multaRescisao", e.target.value)} placeholder="Ex: 3 aluguéis" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepLocacao;
