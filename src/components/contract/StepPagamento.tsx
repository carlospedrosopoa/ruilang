import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Building2 } from "lucide-react";
import {
  Pagamento,
  Parcela,
  DadosBancarios,
  TipoParcela,
  NaturezaSinal,
  FrequenciaParcela,
  ModalidadeFinanciamento,
  IndiceCorrecao,
  tipoParcelaLabels,
  naturezaSinalLabels,
  frequenciaParcelaLabels,
  modalidadeFinanciamentoLabels,
  indiceCorrecaoLabels,
} from "@/types/contract";
import { useState } from "react";

interface StepPagamentoProps {
  pagamento: Pagamento;
  onChange: (pagamento: Pagamento) => void;
  labelParteA?: string;
}

const StepPagamento = ({ pagamento, onChange, labelParteA = "Vendedor" }: StepPagamentoProps) => {
  const [mostrarBanco, setMostrarBanco] = useState(!!pagamento.dadosBancarios);

  const update = (field: keyof Pagamento, value: any) => {
    onChange({ ...pagamento, [field]: value });
  };

  const formatMoneyInput = (input: string) => {
    const digits = String(input || "").replace(/\D/g, "");
    if (!digits) return "";
    const cents = Number.parseInt(digits, 10);
    if (!Number.isFinite(cents)) return "";
    return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const addParcela = () => {
    const novaParcela: Parcela = {
      id: crypto.randomUUID(),
      tipo: "parcela",
      valor: "",
      quantidade: 1,
      frequencia: "mensal",
      dataVencimento: "",
      descricao: "",
    };
    onChange({ ...pagamento, parcelas: [...pagamento.parcelas, novaParcela] });
  };

  const updateParcela = (index: number, field: keyof Parcela, value: any) => {
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

  const updateCorrecaoMonetaria = (field: keyof Pagamento["correcaoMonetaria"], value: any) => {
    onChange({
      ...pagamento,
      correcaoMonetaria: { ...pagamento.correcaoMonetaria!, [field]: value },
    });
  };

  const updateEncargosAtraso = (field: keyof Pagamento["encargosAtraso"], value: string) => {
    onChange({
      ...pagamento,
      encargosAtraso: { ...pagamento.encargosAtraso!, [field]: value },
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
            <Label>Valor Total do Imóvel (R$)</Label>
            <Input
              value={pagamento.valorTotal}
              onChange={(e) => update("valorTotal", formatMoneyInput(e.target.value))}
              placeholder="Ex: 105.000,00"
              inputMode="numeric"
            />
          </div>
          <div>
            <Label>Valor de Honorários (R$)</Label>
            <Input
              value={pagamento.valorHonorarios || ""}
              onChange={(e) => update("valorHonorarios", formatMoneyInput(e.target.value))}
              placeholder="Ex: 2.500,00"
              inputMode="numeric"
            />
          </div>
        </div>

        {/* Parcelas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-lg font-semibold text-foreground">Parcelas</h4>
            <Button variant="outline" size="sm" onClick={addParcela}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Parcela
            </Button>
          </div>

          {pagamento.parcelas.map((parcela, index) => (
            <div key={parcela.id} className="border border-border rounded-md p-4 space-y-4 bg-background">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  {tipoParcelaLabels[parcela.tipo]} {index + 1}
                </span>
                <Button variant="ghost" size="icon" onClick={() => removeParcela(index)} className="text-destructive h-8 w-8">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={parcela.tipo}
                    onValueChange={(v) => updateParcela(index, "tipo", v as TipoParcela)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(tipoParcelaLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    value={parcela.valor}
                    onChange={(e) => updateParcela(index, "valor", formatMoneyInput(e.target.value))}
                    placeholder="0,00"
                    inputMode="numeric"
                  />
                </div>
                {parcela.tipo === "parcela" && (
                  <div>
                    <Label className="text-xs">Quantidade</Label>
                    <Input
                      type="number"
                      min={1}
                      value={parcela.quantidade}
                      onChange={(e) => updateParcela(index, "quantidade", parseInt(e.target.value) || 1)}
                    />
                  </div>
                )}
              </div>

              {/* Campos específicos por tipo */}
              {parcela.tipo === "sinal" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Natureza do Sinal</Label>
                    <Select
                      value={parcela.naturezaSinal || ""}
                      onValueChange={(v) => updateParcela(index, "naturezaSinal", v as NaturezaSinal)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(naturezaSinalLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Vencimento</Label>
                    <Input
                      type="date"
                      value={parcela.dataVencimento}
                      onChange={(e) => updateParcela(index, "dataVencimento", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {parcela.tipo === "parcela" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Frequência</Label>
                    <Select
                      value={parcela.frequencia || ""}
                      onValueChange={(v) => updateParcela(index, "frequencia", v as FrequenciaParcela)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(frequenciaParcelaLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">
                      {parcela.quantidade > 1 ? "Vencimento 1ª parcela" : "Vencimento"}
                    </Label>
                    <Input
                      type="date"
                      value={parcela.dataVencimento}
                      onChange={(e) => updateParcela(index, "dataVencimento", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={parcela.descricao}
                      onChange={(e) => updateParcela(index, "descricao", e.target.value)}
                      placeholder="Detalhes"
                    />
                  </div>
                </div>
              )}

              {parcela.tipo === "financiamento" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Banco</Label>
                    <Input
                      value={parcela.bancoFinanciamento || ""}
                      onChange={(e) => updateParcela(index, "bancoFinanciamento", e.target.value)}
                      placeholder="Ex: Banco do Brasil"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Agência</Label>
                    <Input
                      value={parcela.agenciaFinanciamento || ""}
                      onChange={(e) => updateParcela(index, "agenciaFinanciamento", e.target.value)}
                      placeholder="Ex: 1234-5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Modalidade</Label>
                    <Select
                      value={parcela.modalidadeFinanciamento || ""}
                      onValueChange={(v) => updateParcela(index, "modalidadeFinanciamento", v as ModalidadeFinanciamento)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(modalidadeFinanciamentoLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Valor Aprovado (R$)</Label>
                    <Input
                      value={parcela.valorAprovadoFinanciamento || ""}
                      onChange={(e) => updateParcela(index, "valorAprovadoFinanciamento", formatMoneyInput(e.target.value))}
                      placeholder="0,00"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Previsão de Liberação</Label>
                    <Input
                      type="date"
                      value={parcela.previsaoLiberacaoFinanciamento || ""}
                      onChange={(e) => updateParcela(index, "previsaoLiberacaoFinanciamento", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {parcela.tipo === "fgts" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valor FGTS (R$)</Label>
                    <Input
                      value={parcela.valorFgts || ""}
                      onChange={(e) => updateParcela(index, "valorFgts", formatMoneyInput(e.target.value))}
                      placeholder="0,00"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Previsão de Liberação</Label>
                    <Input
                      type="date"
                      value={parcela.previsaoLiberacaoFgts || ""}
                      onChange={(e) => updateParcela(index, "previsaoLiberacaoFgts", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {parcela.tipo === "permuta" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Descrição do Bem</Label>
                    <Input
                      value={parcela.descricaoBemPermuta || ""}
                      onChange={(e) => updateParcela(index, "descricaoBemPermuta", e.target.value)}
                      placeholder="Ex: Veículo Honda Civic 2020"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor Avaliado (R$)</Label>
                    <Input
                      value={parcela.valorAvaliadoPermuta || ""}
                      onChange={(e) => updateParcela(index, "valorAvaliadoPermuta", formatMoneyInput(e.target.value))}
                      placeholder="0,00"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              )}

              {parcela.tipo === "consorcio" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Administradora</Label>
                    <Input
                      value={parcela.administradoraConsorcio || ""}
                      onChange={(e) => updateParcela(index, "administradoraConsorcio", e.target.value)}
                      placeholder="Ex: Consórcio XYZ"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor da Carta de Crédito (R$)</Label>
                    <Input
                      value={parcela.valorCartaCreditoConsorcio || ""}
                      onChange={(e) => updateParcela(index, "valorCartaCreditoConsorcio", formatMoneyInput(e.target.value))}
                      placeholder="0,00"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Previsão de Contemplação</Label>
                    <Input
                      type="date"
                      value={parcela.previsaoContemplacaoConsorcio || ""}
                      onChange={(e) => updateParcela(index, "previsaoContemplacaoConsorcio", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {parcela.tipo === "cheque_promissoria" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Número</Label>
                    <Input
                      value={parcela.numeroChequePromissoria || ""}
                      onChange={(e) => updateParcela(index, "numeroChequePromissoria", e.target.value)}
                      placeholder="Ex: 123456"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Banco</Label>
                    <Input
                      value={parcela.bancoChequePromissoria || ""}
                      onChange={(e) => updateParcela(index, "bancoChequePromissoria", e.target.value)}
                      placeholder="Ex: Itaú"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input
                      type="date"
                      value={parcela.dataChequePromissoria || ""}
                      onChange={(e) => updateParcela(index, "dataChequePromissoria", e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Observações</Label>
                <Input
                  value={parcela.observacoes || ""}
                  onChange={(e) => updateParcela(index, "observacoes", e.target.value)}
                  placeholder="Informações adicionais"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Correção Monetária */}
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={pagamento.correcaoMonetaria?.aplicar || false}
              onCheckedChange={(checked) => updateCorrecaoMonetaria("aplicar", checked)}
            />
            <Label className="text-base font-medium">Aplicar correção monetária</Label>
          </div>
          {pagamento.correcaoMonetaria?.aplicar && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Índice</Label>
                <Select
                  value={pagamento.correcaoMonetaria.indice || ""}
                  onValueChange={(v) => updateCorrecaoMonetaria("indice", v as IndiceCorrecao)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(indiceCorrecaoLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Carência (meses)</Label>
                <Input
                  type="number"
                  min={0}
                  value={pagamento.correcaoMonetaria.carenciaMeses || ""}
                  onChange={(e) => updateCorrecaoMonetaria("carenciaMeses", parseInt(e.target.value) || 0)}
                  placeholder="Ex: 6"
                />
              </div>
            </div>
          )}
        </div>

        {/* Encargos por Atraso */}
        <div className="border-t border-border pt-4 space-y-4">
          <h4 className="font-display text-lg font-semibold text-foreground">Encargos por Atraso</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Multa Moratória (%)</Label>
              <Input
                value={pagamento.encargosAtraso?.multaMoratoria || pagamento.multaMoratoria}
                onChange={(e) => updateEncargosAtraso("multaMoratoria", e.target.value)}
                placeholder="Ex: 10"
              />
            </div>
            <div>
              <Label>Juros de Mora (% ao mês)</Label>
              <Input
                value={pagamento.encargosAtraso?.jurosMora || pagamento.jurosMora}
                onChange={(e) => updateEncargosAtraso("jurosMora", e.target.value)}
                placeholder="Ex: 1"
              />
            </div>
          </div>
        </div>

        {/* Dados Bancários */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <h4 className="font-display text-lg font-semibold text-foreground">Dados Bancários do {labelParteA}</h4>
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
      </div>
    </div>
  );
};

export default StepPagamento;
