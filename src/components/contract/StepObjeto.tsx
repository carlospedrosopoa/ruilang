import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileImage, Loader2, Sparkles, X, Plus, Trash2, Users } from "lucide-react";
import {
  Imovel,
  estadosBR,
  SituacaoTributaria,
  TipoOnus,
  ProprietarioTabular,
  OnusReal,
  situacaoTributariaLabels,
  tipoOnusLabels,
  Pessoa,
} from "@/types/contract";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fileToVisionBase64Images } from "@/lib/imageUtils";

interface StepObjetoProps {
  imovel: Imovel;
  onChange: (imovel: Imovel) => void;
  onExtractFiles?: (files: File[]) => Promise<void> | void;
  labelObjeto?: string;
  errors?: Array<{ field: string; message: string }>;
  vendedores?: Pessoa[];
}

const StepObjeto = ({ imovel, onChange, onExtractFiles, labelObjeto = "Imóvel", errors, vendedores = [] }: StepObjetoProps) => {
  const getError = (field: string) => errors?.find(e => e.field === field);
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof Imovel, value: any) => {
    onChange({ ...imovel, [field]: value });
  };

  const addProprietarioTabular = () => {
    const novo: ProprietarioTabular = {
      id: crypto.randomUUID(),
      nome: "",
      cpfCnpj: "",
      percentualPropriedade: "100",
    };
    update("proprietariosTabulares", [...imovel.proprietariosTabulares, novo]);
  };

  const updateProprietarioTabular = (index: number, field: keyof ProprietarioTabular, value: string) => {
    const updated = [...imovel.proprietariosTabulares];
    updated[index] = { ...updated[index], [field]: value };
    update("proprietariosTabulares", updated);
  };

  const removeProprietarioTabular = (index: number) => {
    update("proprietariosTabulares", imovel.proprietariosTabulares.filter((_, i) => i !== index));
  };

  const copiarVendedoresParaProprietarios = () => {
    const novos = vendedores.map((v): ProprietarioTabular => ({
      id: crypto.randomUUID(),
      nome: v.nome,
      cpfCnpj: v.cpf || v.cnpj,
      percentualPropriedade: (100 / vendedores.length).toString(),
    }));
    update("proprietariosTabulares", novos);
    toast.success("Proprietários tabulares preenchidos com base nos vendedores!");
  };

  const addOnusReal = () => {
    const novo: OnusReal = {
      id: crypto.randomUUID(),
      tipo: "hipoteca",
      credor: "",
      valor: "",
      numeroRegistro: "",
    };
    update("onusReais", [...imovel.onusReais, novo]);
  };

  const updateOnusReal = (index: number, field: keyof OnusReal, value: string) => {
    const updated = [...imovel.onusReais];
    updated[index] = { ...updated[index], [field]: value };
    update("onusReais", updated);
  };

  const removeOnusReal = (index: number) => {
    update("onusReais", imovel.onusReais.filter((_, i) => i !== index));
  };

  const formatMoneyInput = (input: string) => {
    const digits = String(input || "").replace(/\D/g, "");
    if (!digits) return "";
    const cents = Number.parseInt(digits, 10);
    if (!Number.isFinite(cents)) return "";
    return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} excede 10MB`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      toast.error("Adicione ao menos um documento.");
      return;
    }

    setIsExtracting(true);
    try {
      if (onExtractFiles) {
        try {
          await onExtractFiles(files);
        } catch (uploadErr) {
          console.warn("Auto-attach docs failed:", uploadErr);
          toast.error("Não foi possível anexar automaticamente os arquivos da extração.");
        }
      }

      const nested = await Promise.all(files.map((f) => fileToVisionBase64Images(f)));
      const images = nested.flat();

      const { data, error } = await supabase.functions.invoke("extract-property", {
        body: { images, ai: { provider: "openai" } },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const dados = data.dados;
      if (!dados) throw new Error("Nenhum dado extraído");

      const merged = { ...imovel };
      for (const [key, value] of Object.entries(dados)) {
        if (value && typeof value === "string" && value.trim() !== "") {
          const imovelKey = key as keyof Imovel;
          const currentValue = merged[imovelKey];
          if (!currentValue || currentValue === "") {
            (merged as any)[imovelKey] = value;
          }
        }
      }

      onChange(merged);
      toast.success("Dados do imóvel extraídos com sucesso! Verifique os campos.");
    } catch (err: any) {
      console.error("Extract property error:", err);
      let message = err?.message;
      const ctx = err?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch {}
      }
      toast.error(message || "Erro ao extrair dados do documento.");
    } finally {
      setIsExtracting(false);
    }
  };

  const isApartamentoOuSala = imovel.tipo === "apartamento" || imovel.tipo === "sala_comercial";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">
          {labelObjeto}
        </h3>
        <p className="text-muted-foreground">
          Descreva o objeto do contrato.
        </p>
      </div>

      {/* Document Upload Area */}
      <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="w-4 h-4" />
          Preenchimento Automático via IA
        </div>
        <p className="text-xs text-muted-foreground">
          Anexe fotos da matrícula do imóvel, escritura ou contrato anterior e a IA preencherá os campos automaticamente.
        </p>

        <div className="flex flex-wrap gap-2">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border text-xs">
              <FileImage className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="max-w-[150px] truncate">{file.name}</span>
              <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" />
            Anexar Documento
          </Button>
          {files.length > 0 && (
            <Button type="button" size="sm" onClick={handleExtract} disabled={isExtracting} className="bg-primary text-primary-foreground">
              {isExtracting ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Extraindo...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-1" />Extrair Dados</>
              )}
            </Button>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFilesSelected} className="hidden" />
      </div>

      <div className="border border-border rounded-lg p-5 space-y-5 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between">
              <Label>Tipo do Imóvel *</Label>
              {getError("tipo") && <span className="text-xs text-destructive">{getError("tipo")?.message}</span>}
            </div>
            <Select value={imovel.tipo} onValueChange={(v) => update("tipo", v)}>
              <SelectTrigger className={getError("tipo") ? "border-destructive focus-visible:ring-destructive" : ""}><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="sala_comercial">Sala Comercial</SelectItem>
                <SelectItem value="loja">Loja</SelectItem>
                <SelectItem value="galpao">Galpão</SelectItem>
                <SelectItem value="chacara">Chácara</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Área Total *</Label>
              {getError("areaTotal") && <span className="text-xs text-destructive">{getError("areaTotal")?.message}</span>}
            </div>
            <Input 
              value={imovel.areaTotal} 
              onChange={(e) => update("areaTotal", e.target.value)} 
              placeholder="Ex: 360,00 m²"
              className={getError("areaTotal") ? "border-destructive focus-visible:ring-destructive" : ""}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Localização / Denominação *</Label>
              {getError("localizacao") && <span className="text-xs text-destructive">{getError("localizacao")?.message}</span>}
            </div>
            <Input 
              value={imovel.localizacao} 
              onChange={(e) => update("localizacao", e.target.value)} 
              placeholder="Ex: Praia Camboim"
              className={getError("localizacao") ? "border-destructive focus-visible:ring-destructive" : ""}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Município *</Label>
              {getError("municipio") && <span className="text-xs text-destructive">{getError("municipio")?.message}</span>}
            </div>
            <Input 
              value={imovel.municipio} 
              onChange={(e) => update("municipio", e.target.value)} 
              placeholder="Município"
              className={getError("municipio") ? "border-destructive focus-visible:ring-destructive" : ""}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Estado *</Label>
              {getError("estadoImovel") && <span className="text-xs text-destructive">{getError("estadoImovel")?.message}</span>}
            </div>
            <Select value={imovel.estadoImovel} onValueChange={(v) => update("estadoImovel", v)}>
              <SelectTrigger className={getError("estadoImovel") ? "border-destructive focus-visible:ring-destructive" : ""}><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                {estadosBR.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Lote</Label>
            <Input value={imovel.lote} onChange={(e) => update("lote", e.target.value)} placeholder="Ex: 02" />
          </div>

          <div>
            <Label>Quadra</Label>
            <Input value={imovel.quadra} onChange={(e) => update("quadra", e.target.value)} placeholder='Ex: EE' />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Matrícula nº *</Label>
              {getError("matricula") && <span className="text-xs text-destructive">{getError("matricula")?.message}</span>}
            </div>
            <Input 
              value={imovel.matricula} 
              onChange={(e) => update("matricula", e.target.value)} 
              placeholder="Nº da matrícula"
              className={getError("matricula") ? "border-destructive focus-visible:ring-destructive" : ""}
            />
          </div>

          <div>
            <Label>Registro de Imóveis</Label>
            <Input value={imovel.registroImoveis} onChange={(e) => update("registroImoveis", e.target.value)} placeholder="Ex: 1ª Zona de Torres/RS" />
          </div>
        </div>

        {/* IPTU */}
        <div className="border-t border-border pt-4 space-y-4">
          <h4 className="font-display text-lg font-semibold text-foreground">IPTU e Situação Tributária</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Inscrição Imobiliária / IPTU</Label>
              <Input 
                value={imovel.inscricaoImobiliariaIptu} 
                onChange={(e) => update("inscricaoImobiliariaIptu", e.target.value)} 
                placeholder="Número de inscrição"
              />
            </div>
            <div>
              <Label>Situação Tributária</Label>
              <Select 
                value={imovel.situacaoTributaria} 
                onValueChange={(v) => update("situacaoTributaria", v as SituacaoTributaria)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(situacaoTributariaLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor IPTU Anual (R$)</Label>
              <Input 
                value={imovel.valorIptuAnual} 
                onChange={(e) => update("valorIptuAnual", formatMoneyInput(e.target.value))} 
                placeholder="0,00"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        {/* Proprietários Tabulares */}
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5" />
              Proprietário(s) registrado(s) na matrícula
            </h4>
            <div className="flex gap-2">
              {vendedores.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copiarVendedoresParaProprietarios}
                  className="text-xs"
                >
                  Usar vendedores como proprietários
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={addProprietarioTabular} className="text-xs">
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Proprietário
              </Button>
            </div>
          </div>
          
          {imovel.proprietariosTabulares.map((proprietario, index) => (
            <div key={proprietario.id} className="border border-border rounded-md p-4 space-y-3 bg-background">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Proprietário {index + 1}</span>
                <Button variant="ghost" size="icon" onClick={() => removeProprietarioTabular(index)} className="text-destructive h-8 w-8">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Nome Completo</Label>
                  <Input 
                    value={proprietario.nome} 
                    onChange={(e) => updateProprietarioTabular(index, "nome", e.target.value)} 
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label className="text-xs">CPF/CNPJ</Label>
                  <Input 
                    value={proprietario.cpfCnpj} 
                    onChange={(e) => updateProprietarioTabular(index, "cpfCnpj", e.target.value)} 
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label className="text-xs">Percentual de Propriedade (%)</Label>
                  <Input 
                    value={proprietario.percentualPropriedade} 
                    onChange={(e) => updateProprietarioTabular(index, "percentualPropriedade", e.target.value)} 
                    placeholder="100"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Ônus Reais */}
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={imovel.livreDeOnus}
              onCheckedChange={(v) => update("livreDeOnus", v)}
            />
            <Label className="text-base font-medium cursor-pointer">Imóvel livre de ônus reais e gravames</Label>
          </div>
          
          {!imovel.livreDeOnus && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Liste os ônus reais e gravames registrados na matrícula</p>
                <Button variant="outline" size="sm" onClick={addOnusReal} className="text-xs">
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar Ônus
                </Button>
              </div>
              
              {imovel.onusReais.map((onus, index) => (
                <div key={onus.id} className="border border-border rounded-md p-4 space-y-3 bg-background">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">Ônus {index + 1}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeOnusReal(index)} className="text-destructive h-8 w-8">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select 
                        value={onus.tipo} 
                        onValueChange={(v) => updateOnusReal(index, "tipo", v as TipoOnus)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(tipoOnusLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {onus.tipo === "outro" && (
                      <div>
                        <Label className="text-xs">Especificar</Label>
                        <Input 
                          value={onus.tipoOutro || ""} 
                          onChange={(e) => updateOnusReal(index, "tipoOutro", e.target.value)} 
                          placeholder="Descrição do ônus"
                        />
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">Credor</Label>
                      <Input 
                        value={onus.credor} 
                        onChange={(e) => updateOnusReal(index, "credor", e.target.value)} 
                        placeholder="Nome do credor"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input 
                        value={onus.valor} 
                        onChange={(e) => updateOnusReal(index, "valor", formatMoneyInput(e.target.value))} 
                        placeholder="0,00"
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Número do Registro na Matrícula</Label>
                      <Input 
                        value={onus.numeroRegistro} 
                        onChange={(e) => updateOnusReal(index, "numeroRegistro", e.target.value)} 
                        placeholder="Ex: Livro 123, Folha 45"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Condomínio */}
        {isApartamentoOuSala && (
          <div className="border-t border-border pt-4 space-y-4">
            <h4 className="font-display text-lg font-semibold text-foreground">Condomínio</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Nome do Condomínio</Label>
                <Input 
                  value={imovel.condominio?.nome || ""} 
                  onChange={(e) => update("condominio", { ...imovel.condominio, nome: e.target.value })} 
                  placeholder="Nome do condomínio"
                />
              </div>
              <div>
                <Label>Valor Mensal (R$)</Label>
                <Input 
                  value={imovel.condominio?.valorMensal || ""} 
                  onChange={(e) => update("condominio", { ...imovel.condominio, valorMensal: formatMoneyInput(e.target.value) })} 
                  placeholder="0,00"
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label>Situação</Label>
                <Select 
                  value={imovel.condominio?.situacao || "quitado"} 
                  onValueChange={(v) => update("condominio", { ...imovel.condominio, situacao: v as SituacaoTributaria })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(situacaoTributariaLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Medidas */}
        <h4 className="font-display text-lg font-semibold text-foreground pt-2">Medidas</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Frente</Label>
            <Input value={imovel.medidasFrente} onChange={(e) => update("medidasFrente", e.target.value)} placeholder="Ex: 12,00 metros" />
          </div>
          <div>
            <Label>Fundos</Label>
            <Input value={imovel.medidasFundos} onChange={(e) => update("medidasFundos", e.target.value)} placeholder="Ex: 12,00 metros" />
          </div>
          <div>
            <Label>Lateral Esquerda</Label>
            <Input value={imovel.medidasLateralEsquerda} onChange={(e) => update("medidasLateralEsquerda", e.target.value)} placeholder="Ex: 30,00 metros" />
          </div>
          <div>
            <Label>Lateral Direita</Label>
            <Input value={imovel.medidasLateralDireita} onChange={(e) => update("medidasLateralDireita", e.target.value)} placeholder="Ex: 30,00 metros" />
          </div>
        </div>

        <div>
          <Label>Descrição Detalhada</Label>
          <Textarea
            value={imovel.descricao}
            onChange={(e) => update("descricao", e.target.value)}
            placeholder="Descrição complementar do imóvel, benfeitorias, confrontações..."
            rows={3}
          />
        </div>

        <div>
          <Label>Características Adicionais</Label>
          <Textarea
            value={imovel.caracteristicas}
            onChange={(e) => update("caracteristicas", e.target.value)}
            placeholder="Demais características constantes da matrícula..."
            rows={2}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Switch
            checked={imovel.adCorpus}
            onCheckedChange={(v) => update("adCorpus", v)}
          />
          <Label className="cursor-pointer">
            Venda em caráter <strong>AD CORPUS</strong>
          </Label>
        </div>
      </div>
    </div>
  );
};

export default StepObjeto;
