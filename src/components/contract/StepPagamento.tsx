import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Building2 } from "lucide-react";
import { Pagamento, Parcela, DadosBancarios } from "@/types/contract";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

interface StepPagamentoProps {
  pagamento: Pagamento;
  onChange: (pagamento: Pagamento) => void;
}

const StepPagamento = ({ pagamento, onChange }: StepPagamentoProps) => {
  const [mostrarBanco, setMostrarBanco] = useState(!!pagamento.dadosBancarios);

  const update = (field: keyof Pagamento, value: string) => {
    onChange({ ...pagamento, [field]: value });
  };

  const addParcela = () => {
    const novaParcela: Parcela = {
      id: crypto.randomUUID(),
      descricao: "",
      valor: "",
      quantidade: 1,
      tipo: "parcela",
      dataVencimento: "",
    };
    onChange({ ...pagamento, parcelas: [...pagamento.parcelas, novaParcela] });
  };

  const updateParcela = (index: number, field: keyof Parcela, value: string | number) => {
    const updated = [...pagamento.parcelas];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...pagamento, parcelas: updated });
  };

  const removeParcela = (index: number) => {
    onChange({ ...pagamento, parcelas: pagamento.parcelas.filter((_, i) => i !== index) });
  };

  const toggleBanco = (checked: boolean) => {
    setMostrarBanco(checked);
    if (checked && !pagamento.dadosBancarios) {
      onChange({
        ...pagamento,
        dadosBancarios: { banco: "", agencia: "", conta: "", tipoConta: "corrente", titular: "", cpfTitular: "", pix: "" },
      });
    } else if (!checked) {
      const { dadosBancarios, ...rest } = pagamento;
      onChange(rest as Pagamento);
    }
  };

  const updateBanco = (field: keyof DadosBancarios, value: string) => {
    onChange({
      ...pagamento,
      dadosBancarios: { ...pagamento.dadosBancarios!, [field]: value },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">
          Preço e Forma de Pagamento
        </h3>
        <p className="text-muted-foreground">
          Defina o valor total, parcelas com datas de vencimento e dados bancários.
        </p>
      </div>

      <div className="border border-border rounded-lg p-5 space-y-5 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Valor Total do Imóvel (R$) *</Label>
            <Input
              value={pagamento.valorTotal}
              onChange={(e) => update("valorTotal", e.target.value)}
              placeholder="Ex: 105.000,00"
            />
          </div>
        </div>

        {/* Parcelas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-lg font-semibold text-foreground">Parcelas</h4>
            <Button variant="outline" size="sm" onClick={addParcela}>
              <Plus className="w-4 h-4 mr-1" /> Parcela
            </Button>
          </div>

          {pagamento.parcelas.map((parcela, index) => (
            <div key={parcela.id} className="border border-border rounded-md p-4 space-y-3 bg-background">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  Parcela {index + 1}
                </span>
                <Button variant="ghost" size="icon" onClick={() => removeParcela(index)} className="text-destructive h-8 w-8">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={parcela.tipo} onValueChange={(v) => updateParcela(index, "tipo", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arras">Arras/Sinal</SelectItem>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="parcela">Parcela</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input value={parcela.valor} onChange={(e) => updateParcela(index, "valor", e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <Label className="text-xs">Quantidade</Label>
                  <Input
                    type="number"
                    min={1}
                    value={parcela.quantidade}
                    onChange={(e) => updateParcela(index, "quantidade", parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Vencimento</Label>
                  <Input
                    type="date"
                    value={parcela.dataVencimento}
                    onChange={(e) => updateParcela(index, "dataVencimento", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input value={parcela.descricao} onChange={(e) => updateParcela(index, "descricao", e.target.value)} placeholder="Detalhes" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dados Bancários */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <h4 className="font-display text-lg font-semibold text-foreground">Dados Bancários do Vendedor</h4>
            </div>
            <Switch checked={mostrarBanco} onCheckedChange={toggleBanco} />
          </div>

          {mostrarBanco && pagamento.dadosBancarios && (
            <div className="border border-border rounded-md p-4 space-y-3 bg-background">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Banco</Label>
                  <Input value={pagamento.dadosBancarios.banco} onChange={(e) => updateBanco("banco", e.target.value)} placeholder="Ex: Banco do Brasil" />
                </div>
                <div>
                  <Label className="text-xs">Agência</Label>
                  <Input value={pagamento.dadosBancarios.agencia} onChange={(e) => updateBanco("agencia", e.target.value)} placeholder="Ex: 1234-5" />
                </div>
                <div>
                  <Label className="text-xs">Conta</Label>
                  <Input value={pagamento.dadosBancarios.conta} onChange={(e) => updateBanco("conta", e.target.value)} placeholder="Ex: 12345-6" />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Conta</Label>
                  <Select value={pagamento.dadosBancarios.tipoConta} onValueChange={(v) => updateBanco("tipoConta", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Titular</Label>
                  <Input value={pagamento.dadosBancarios.titular} onChange={(e) => updateBanco("titular", e.target.value)} placeholder="Nome do titular" />
                </div>
                <div>
                  <Label className="text-xs">CPF do Titular</Label>
                  <Input value={pagamento.dadosBancarios.cpfTitular} onChange={(e) => updateBanco("cpfTitular", e.target.value)} placeholder="000.000.000-00" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Chave PIX (opcional)</Label>
                <Input value={pagamento.dadosBancarios.pix} onChange={(e) => updateBanco("pix", e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
              </div>
            </div>
          )}
        </div>

        {/* Multas e Correção */}
        <h4 className="font-display text-lg font-semibold text-foreground pt-2">Multas e Correção</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Multa Moratória (%)</Label>
            <Input value={pagamento.multaMoratoria} onChange={(e) => update("multaMoratoria", e.target.value)} placeholder="Ex: 10" />
          </div>
          <div>
            <Label>Juros de Mora (% ao mês)</Label>
            <Input value={pagamento.jurosMora} onChange={(e) => update("jurosMora", e.target.value)} placeholder="Ex: 1" />
          </div>
          <div>
            <Label>Índice de Correção</Label>
            <Select value={pagamento.indiceCorrecao} onValueChange={(v) => update("indiceCorrecao", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INPC/IBGE">INPC/IBGE</SelectItem>
                <SelectItem value="IGPM/FGV">IGPM/FGV</SelectItem>
                <SelectItem value="IPCA/IBGE">IPCA/IBGE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Multa Contratual (%)</Label>
            <Input value={pagamento.multaContratual} onChange={(e) => update("multaContratual", e.target.value)} placeholder="Ex: 20" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepPagamento;
