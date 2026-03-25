import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PropostaPagamento } from "@/types/proposal";

interface StepProposalPagamentoProps {
  pagamento: PropostaPagamento;
  onChange: (pagamento: PropostaPagamento) => void;
}

const StepProposalPagamento = ({ pagamento, onChange }: StepProposalPagamentoProps) => {
  const update = (field: keyof PropostaPagamento, value: string | number) => {
    onChange({ ...pagamento, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">Pagamento</h3>
        <p className="text-muted-foreground">Informe o valor e as condições de pagamento.</p>
      </div>

      <div className="border border-border rounded-lg p-5 space-y-5 bg-card">
        <div>
          <Label>Valor Total (R$) *</Label>
          <Input
            value={pagamento.valorTotal}
            onChange={(e) => update("valorTotal", e.target.value)}
            placeholder="Ex: 350.000,00"
            className="text-lg"
          />
        </div>

        <div className="space-y-3">
          <Label>Forma de Pagamento</Label>
          <RadioGroup
            value={pagamento.formaPagamento}
            onValueChange={(v) => update("formaPagamento", v)}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="avista" id="avista" />
              <Label htmlFor="avista" className="cursor-pointer font-normal">À vista</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="parcelado" id="parcelado" />
              <Label htmlFor="parcelado" className="cursor-pointer font-normal">Parcelado</Label>
            </div>
          </RadioGroup>
        </div>

        {pagamento.formaPagamento === "parcelado" && (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Valor de Entrada (R$)</Label>
                <Input
                  value={pagamento.valorEntrada || ""}
                  onChange={(e) => update("valorEntrada", e.target.value)}
                  placeholder="Ex: 50.000,00"
                />
              </div>
              <div>
                <Label>Nº de Parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  value={pagamento.numeroParcelas || ""}
                  onChange={(e) => update("numeroParcelas", parseInt(e.target.value) || 0)}
                  placeholder="Ex: 12"
                />
              </div>
              <div>
                <Label>Data da 1ª Parcela</Label>
                <Input
                  type="date"
                  value={pagamento.dataPrimeiraParcela || ""}
                  onChange={(e) => update("dataPrimeiraParcela", e.target.value)}
                />
              </div>
            </div>
            {pagamento.numeroParcelas && pagamento.numeroParcelas > 1 && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                📅 As demais parcelas vencem mensalmente nas datas subsequentes.
              </p>
            )}
          </div>
        )}

        <div className="pt-2">
          <Label>Observações sobre pagamento</Label>
          <Textarea
            value={pagamento.observacoes || ""}
            onChange={(e) => update("observacoes", e.target.value)}
            placeholder="Informações adicionais sobre as condições de pagamento..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
};

export default StepProposalPagamento;
