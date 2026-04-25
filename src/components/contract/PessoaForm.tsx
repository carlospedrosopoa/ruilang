import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, Upload, FileImage, Loader2, Sparkles, X, Camera, Heart, Link, FileText } from "lucide-react";
import { Pessoa, estadosCivis, estadosBR } from "@/types/contract";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fileToVisionBase64Images } from "@/lib/imageUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface PessoaFormProps {
  pessoa: Pessoa;
  onChange: (pessoa: Pessoa) => void;
  onRemove?: () => void;
  titulo: string;
  index: number;
  isConjuge?: boolean;
  hideEstadoCivil?: boolean;
  emailRequired?: boolean;
  onExtractFiles?: (files: File[]) => Promise<void> | void;
}

const UF_REGEX = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i;

function cleanAddressValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseAddressParts(fullAddress: string) {
  const text = cleanAddressValue(fullAddress);
  if (!text) return { bairro: "", cidade: "", estado: "", cep: "" };

  const cep = text.match(/\b\d{5}-?\d{3}\b/)?.[0] || "";
  const estado = text.match(UF_REGEX)?.[0]?.toUpperCase() || "";

  let bairro = text.match(/(?:\bbairro\b\s*[:\-]?\s*)([^,;/]+)/i)?.[1]?.trim() || "";
  let cidade =
    text.match(/(?:\bmunic[ií]pio\b|\bcidade\b)\s*[:\-]?\s*([^,;/]+)/i)?.[1]?.trim() || "";

  if (!cidade) {
    const cityState = text.match(/(?:,\s*|-\s*)([^,;/]+?)\s*[-/]\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
    if (cityState?.[1]) cidade = cityState[1].trim();
  }

  if (bairro) bairro = cleanAddressValue(bairro);
  if (cidade) cidade = cleanAddressValue(cidade);

  return { bairro, cidade, estado, cep };
}

const PessoaForm = ({ pessoa, onChange, onRemove, titulo, index, isConjuge, hideEstadoCivil, emailRequired, onExtractFiles }: PessoaFormProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textToExtract, setTextToExtract] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof Pessoa, value: string) => {
    onChange({ ...pessoa, [field]: value });
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

      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: { images, ai: { provider: "openai" } },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const dados = data.dados;
      if (!dados) throw new Error("Nenhum dado extraído");

      const merged = { ...pessoa };
      for (const [key, value] of Object.entries(dados)) {
        if (value && typeof value === "string" && value.trim() !== "") {
          const pessoaKey = key as keyof Pessoa;
          if (pessoaKey in merged) (merged as any)[pessoaKey] = value.trim();
        }
      }

      const explicitBairro = typeof dados.bairro === "string" && dados.bairro.trim() !== "";
      const explicitCidade = typeof dados.cidade === "string" && dados.cidade.trim() !== "";
      const explicitEstado = typeof dados.estado === "string" && dados.estado.trim() !== "";
      const explicitCep = typeof dados.cep === "string" && dados.cep.trim() !== "";

      const parsed = parseAddressParts(merged.endereco || "");
      if (parsed.bairro && !explicitBairro) merged.bairro = parsed.bairro;
      if (parsed.cidade && !explicitCidade) merged.cidade = parsed.cidade;
      if (parsed.estado && !explicitEstado) merged.estado = parsed.estado;
      if (parsed.cep && !explicitCep) merged.cep = parsed.cep;

      onChange(merged);
      toast.success("Dados extraídos com sucesso! Verifique e complete os campos.");
    } catch (err: any) {
      console.error("Extract error:", err);
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

  const handleExtractFromText = async () => {
    if (!textToExtract.trim()) {
      toast.error("Cole um texto para extração.");
      return;
    }

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: { text: textToExtract.trim(), ai: { provider: "openai" } },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const dados = data.dados;
      if (!dados) throw new Error("Nenhum dado extraído");

      const merged = { ...pessoa };
      for (const [key, value] of Object.entries(dados)) {
        if (value && typeof value === "string" && value.trim() !== "") {
          const pessoaKey = key as keyof Pessoa;
          if (pessoaKey in merged) (merged as any)[pessoaKey] = value.trim();
        }
      }

      const explicitBairro = typeof dados.bairro === "string" && dados.bairro.trim() !== "";
      const explicitCidade = typeof dados.cidade === "string" && dados.cidade.trim() !== "";
      const explicitEstado = typeof dados.estado === "string" && dados.estado.trim() !== "";
      const explicitCep = typeof dados.cep === "string" && dados.cep.trim() !== "";

      const parsed = parseAddressParts(merged.endereco || "");
      if (parsed.bairro && !explicitBairro) merged.bairro = parsed.bairro;
      if (parsed.cidade && !explicitCidade) merged.cidade = parsed.cidade;
      if (parsed.estado && !explicitEstado) merged.estado = parsed.estado;
      if (parsed.cep && !explicitCep) merged.cep = parsed.cep;

      onChange(merged);
      toast.success("Dados extraídos com sucesso! Verifique e complete os campos.");
      setTextDialogOpen(false);
    } catch (err: any) {
      console.error("Extract from text error:", err);
      let message = err?.message;
      const ctx = err?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch {}
      }
      toast.error(message || "Erro ao extrair dados do texto.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className={`border rounded-lg p-5 space-y-4 bg-card ${isConjuge ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConjuge && <Heart className="w-4 h-4 text-primary" />}
          <h4 className="font-display text-lg font-semibold text-foreground">
            {titulo} {!isConjuge && index + 1}
          </h4>
          {isConjuge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
              <Link className="w-3 h-3" />
              Parte plena no contrato
            </span>
          )}
        </div>
        {onRemove && (
          <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Document Upload Area */}
      <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="w-4 h-4" />
          Preenchimento Automático via IA
        </div>
        <p className="text-xs text-muted-foreground">
          Anexe fotos de documentos (RG, CNH, CPF, comprovante de endereço) e a IA preencherá os campos automaticamente.
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

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" />
            Anexar Documento
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}>
            <Camera className="w-4 h-4 mr-1" />
            Tirar Foto
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setTextDialogOpen(true)}>
            <FileText className="w-4 h-4 mr-1" />
            Colar Texto
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

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,.pdf" multiple onChange={handleFilesSelected} className="hidden" />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFilesSelected} className="hidden" />
      </div>

      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Colar Texto para Extração</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-4 pt-2">
              <div>
                <Label>Texto</Label>
                <Textarea
                  value={textToExtract}
                  onChange={(e) => setTextToExtract(e.target.value)}
                  className="min-h-[260px]"
                  placeholder="Cole aqui o texto digitado, OCR ou dados copiados. A IA tentará identificar nome, CPF, documento, filiação e endereço."
                />
              </div>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-2 border-t border-border">
            <Button variant="outline" onClick={() => setTextDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleExtractFromText} disabled={isExtracting || !textToExtract.trim()}>
              {isExtracting ? "Extraindo..." : "Extrair"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

        {!hideEstadoCivil && (
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
        )}

        {hideEstadoCivil && (
          <div>
            <Label>Estado Civil</Label>
            <Input value={pessoa.estadoCivil} readOnly className="bg-muted" />
          </div>
        )}

        {pessoa.estadoCivil === "Casado(a)" && (
          <div>
            <Label>Regime de Bens</Label>
            <Input
              value={pessoa.regimeBens || ""}
              onChange={(e) => update("regimeBens", e.target.value)}
              placeholder="Ex: comunhão universal"
              readOnly={!!isConjuge}
              className={isConjuge ? "bg-muted" : ""}
            />
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
          <Label>E-mail{emailRequired ? " *" : ""}</Label>
          <Input
            type="email"
            required={!!emailRequired}
            value={pessoa.email || ""}
            onChange={(e) => update("email", e.target.value)}
            placeholder="email@exemplo.com"
          />
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
