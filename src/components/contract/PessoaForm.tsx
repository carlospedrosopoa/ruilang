import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, Upload, FileImage, Loader2, Sparkles, X, Camera, Heart, Link, FileText, UserCheck } from "lucide-react";
import { Pessoa, estadosCivis, estadosBR } from "@/types/contract";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fileToVisionBase64Images } from "@/lib/imageUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getRegimesByEstadoCivil } from "@/lib/regimeBens";
import { validarCPF, validarCNPJ, digitsOnly } from "@/lib/validation";
import { useAuth } from "@/auth/AuthProvider";

interface PessoaFormProps {
  pessoa: Pessoa;
  onChange: (pessoa: Pessoa) => void;
  onRemove?: () => void;
  titulo: string;
  index: number;
  displayNumber?: number;
  isConjuge?: boolean;
  hideEstadoCivil?: boolean;
  emailRequired?: boolean;
  onExtractFiles?: (files: File[]) => Promise<void> | void;
  errors?: Array<{ field: string; message: string }>;
}

const UF_REGEX = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i;

function cleanAddressValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function guessLogradouroFromEndereco(endereco: string) {
  const text = cleanAddressValue(endereco);
  if (!text) return "";
  const beforeComma = text.split(",")[0] || text;
  const withoutNumber = beforeComma.replace(/\b\d{1,6}\b/g, " ").replace(/\s+/g, " ").trim();
  return withoutNumber;
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

async function viaCepByCep(cep: string) {
  const c = digitsOnly(cep);
  if (c.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${c}/json/`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.erro) return null;
  return data as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; cep?: string };
}

async function viaCepByAddress(uf: string, cidade: string, logradouro: string) {
  const u = String(uf || "").trim().toUpperCase();
  const c = String(cidade || "").trim();
  const l = String(logradouro || "").trim();
  if (!u || !c || !l) return null;
  const url = `https://viacep.com.br/ws/${encodeURIComponent(u)}/${encodeURIComponent(c)}/${encodeURIComponent(l)}/json/`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data)) return null;
  const list = data.filter((x) => x && !x.erro);
  if (list.length === 1) return list[0] as any;
  return null;
}

const PessoaForm = ({ pessoa, onChange, onRemove, titulo, index, displayNumber, isConjuge, hideEstadoCivil, emailRequired, onExtractFiles, errors }: PessoaFormProps) => {
  const { activeTenantId } = useAuth();
  const getError = (field: string) => errors?.find(e => e.field === field);
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textToExtract, setTextToExtract] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [clienteEncontrado, setClienteEncontrado] = useState<any>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  const update = (field: keyof Pessoa, value: string) => {
    onChange({ ...pessoa, [field]: value });
  };

  const tryEnrichAddress = async (base: Pessoa) => {
    const next = { ...base };

    const parsed = parseAddressParts(next.endereco || "");
    if (parsed.bairro && !next.bairro.trim()) next.bairro = parsed.bairro;
    if (parsed.cidade && !next.cidade.trim()) next.cidade = parsed.cidade;
    if (parsed.estado && !next.estado.trim()) next.estado = parsed.estado;
    if (parsed.cep && !next.cep.trim()) next.cep = parsed.cep;

    const cepDigits = digitsOnly(next.cep);
    if (cepDigits.length === 8) {
      const data = await viaCepByCep(cepDigits);
      if (data) {
        if (!next.estado.trim() && data.uf) next.estado = String(data.uf).trim();
        if (!next.cidade.trim() && data.localidade) next.cidade = String(data.localidade).trim();
        if (!next.bairro.trim() && data.bairro) next.bairro = String(data.bairro).trim();
        if (!next.endereco.trim() && data.logradouro) next.endereco = String(data.logradouro).trim();
        if (!next.cep.trim() && data.cep) next.cep = String(data.cep).trim();
      }
      return next;
    }

    if (next.estado.trim() && next.cidade.trim() && next.endereco.trim() && (!next.bairro.trim() || !next.cep.trim())) {
      const logradouro = guessLogradouroFromEndereco(next.endereco);
      const data = await viaCepByAddress(next.estado, next.cidade, logradouro);
      if (data) {
        if (!next.bairro.trim() && data.bairro) next.bairro = String(data.bairro).trim();
        if (!next.cep.trim() && data.cep) next.cep = String(data.cep).trim();
      }
    }

    return next;
  };

  const handleEnderecoBlur = async () => {
    try {
      const enriched = await tryEnrichAddress(pessoa);
      if (
        enriched.endereco !== pessoa.endereco ||
        enriched.bairro !== pessoa.bairro ||
        enriched.cidade !== pessoa.cidade ||
        enriched.estado !== pessoa.estado ||
        enriched.cep !== pessoa.cep
      ) {
        onChange(enriched);
      }
    } catch {}
  };

  const handleCepBlur = async () => {
    try {
      const cepDigits = digitsOnly(pessoa.cep);
      if (cepDigits.length !== 8) return;
      const data = await viaCepByCep(cepDigits);
      if (!data) return;
      const enriched = { ...pessoa };
      if (!enriched.estado.trim() && data.uf) enriched.estado = String(data.uf).trim();
      if (!enriched.cidade.trim() && data.localidade) enriched.cidade = String(data.localidade).trim();
      if (!enriched.bairro.trim() && data.bairro) enriched.bairro = String(data.bairro).trim();
      if (!enriched.endereco.trim() && data.logradouro) enriched.endereco = String(data.logradouro).trim();
      if (!enriched.cep.trim() && data.cep) enriched.cep = String(data.cep).trim();
      onChange(enriched);
    } catch {}
  };

  useEffect(() => {
    const buscarCliente = async () => {
      if (!activeTenantId) return;

      let docToSearch = null;
      if (pessoa.cpf && validarCPF(pessoa.cpf)) {
        docToSearch = { cpf: digitsOnly(pessoa.cpf) };
      } else if (pessoa.cnpj && validarCNPJ(pessoa.cnpj)) {
        docToSearch = { cnpj: digitsOnly(pessoa.cnpj) };
      }

      if (!docToSearch) {
        setClienteEncontrado(null);
        return;
      }

      setBuscandoCliente(true);
      try {
        const query = supabase.from("clientes").select("*").eq("imobiliaria_id", activeTenantId);
        if (docToSearch.cpf) {
          query.ilike("cpf", `%${docToSearch.cpf}%`);
        } else if (docToSearch.cnpj) {
          query.ilike("cnpj", `%${docToSearch.cnpj}%`);
        }
        const { data, error } = await query.limit(1).maybeSingle();
        if (error) throw error;
        setClienteEncontrado(data || null);
      } catch (err) {
        console.error("Erro ao buscar cliente:", err);
        setClienteEncontrado(null);
      } finally {
        setBuscandoCliente(false);
      }
    };

    buscarCliente();
  }, [pessoa.cpf, pessoa.cnpj, activeTenantId]);

  const carregarDadosCliente = () => {
    if (!clienteEncontrado) return;
    const dados: Partial<Pessoa> = {
      nome: clienteEncontrado.nome_completo?.toUpperCase() || "",
      cpf: clienteEncontrado.cpf || "",
      cnpj: clienteEncontrado.cnpj || "",
      documentoNumero: clienteEncontrado.documento_numero || "",
      documentoTipo: clienteEncontrado.documento_tipo === "rg" ? "rg" : "cnh",
      endereco: clienteEncontrado.endereco || "",
      bairro: clienteEncontrado.bairro || "",
      cidade: clienteEncontrado.cidade || "",
      estado: clienteEncontrado.estado || "",
      cep: clienteEncontrado.cep || "",
      email: clienteEncontrado.email || "",
      telefone: clienteEncontrado.telefone || "",
    };
    onChange({ ...pessoa, ...dados });
    setClienteEncontrado(null);
    toast.success("Dados do cliente carregados com sucesso!");
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
          if (pessoaKey in merged) {
            const nextValue = value.trim();
            (merged as any)[pessoaKey] = pessoaKey === "nome" ? nextValue.toUpperCase() : nextValue;
          }
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

      const enriched = await tryEnrichAddress(merged);
      onChange(enriched);
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
          if (pessoaKey in merged) {
            const nextValue = value.trim();
            (merged as any)[pessoaKey] = pessoaKey === "nome" ? nextValue.toUpperCase() : nextValue;
          }
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

      const enriched = await tryEnrichAddress(merged);
      onChange(enriched);
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
            {titulo} {!isConjuge && (typeof displayNumber === "number" ? displayNumber : index + 1)}
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
          <div className="flex items-center justify-between">
            <Label>Nome Completo *</Label>
            {getError("nome") && <span className="text-xs text-destructive">{getError("nome")?.message}</span>}
          </div>
          <Input 
            value={pessoa.nome} 
            onChange={(e) => update("nome", e.target.value)} 
            placeholder="Nome completo"
            className={getError("nome") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Nacionalidade</Label>
            {getError("nacionalidade") && <span className="text-xs text-destructive">{getError("nacionalidade")?.message}</span>}
          </div>
          <Input 
            value={pessoa.nacionalidade} 
            onChange={(e) => update("nacionalidade", e.target.value)} 
            placeholder="brasileira"
            className={getError("nacionalidade") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Profissão *</Label>
            {getError("profissao") && <span className="text-xs text-destructive">{getError("profissao")?.message}</span>}
          </div>
          <Input 
            value={pessoa.profissao} 
            onChange={(e) => update("profissao", e.target.value)} 
            placeholder="Ex: empresário"
            className={getError("profissao") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        {!hideEstadoCivil && (
          <div>
            <div className="flex items-center justify-between">
              <Label>Estado Civil *</Label>
              {getError("estadoCivil") && <span className="text-xs text-destructive">{getError("estadoCivil")?.message}</span>}
            </div>
            <Select value={pessoa.estadoCivil} onValueChange={(v) => update("estadoCivil", v)}>
              <SelectTrigger className={getError("estadoCivil") ? "border-destructive focus-visible:ring-destructive" : ""}><SelectValue placeholder="Selecione" /></SelectTrigger>
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

        {(pessoa.estadoCivil === "Casado(a)" || pessoa.estadoCivil === "União Estável") && (
          <div>
            <div className="flex items-center justify-between">
              <Label>
                {pessoa.estadoCivil === "União Estável" ? "Regime do pacto (se houver)" : "Regime de Bens"} *
              </Label>
              {getError("regimeBens") && <span className="text-xs text-destructive">{getError("regimeBens")?.message}</span>}
            </div>
            {isConjuge ? (
              <Input
                value={pessoa.regimeBens ? getRegimesByEstadoCivil(pessoa.estadoCivil).find(r => r.id === pessoa.regimeBens)?.label : ""}
                readOnly
                className="bg-muted"
              />
            ) : (
              <Select
                value={pessoa.regimeBens || ""}
                onValueChange={(v) => update("regimeBens", v)}
              >
                <SelectTrigger className={getError("regimeBens") ? "border-destructive focus-visible:ring-destructive" : ""}>
                  <SelectValue placeholder="Selecione o regime" />
                </SelectTrigger>
                <SelectContent>
                  {getRegimesByEstadoCivil(pessoa.estadoCivil).map((regime) => (
                    <SelectItem key={regime.id} value={regime.id}>
                      {regime.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
          <div className="flex items-center justify-between">
            <Label>Nº do Documento *</Label>
            {getError("documentoNumero") && <span className="text-xs text-destructive">{getError("documentoNumero")?.message}</span>}
          </div>
          <Input 
            value={pessoa.documentoNumero} 
            onChange={(e) => update("documentoNumero", e.target.value)} 
            placeholder="Número"
            className={getError("documentoNumero") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Órgão Expedidor *</Label>
            {getError("documentoOrgao") && <span className="text-xs text-destructive">{getError("documentoOrgao")?.message}</span>}
          </div>
          <Input 
            value={pessoa.documentoOrgao} 
            onChange={(e) => update("documentoOrgao", e.target.value)} 
            placeholder="Ex: SSP/RS"
            className={getError("documentoOrgao") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>CPF</Label>
            {getError("cpf") && <span className="text-xs text-destructive">{getError("cpf")?.message}</span>}
          </div>
          <Input 
            value={pessoa.cpf} 
            onChange={(e) => update("cpf", e.target.value)} 
            placeholder="000.000.000-00"
            className={getError("cpf") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        {clienteEncontrado && (
          <div className="md:col-span-2 p-4 rounded-lg border-2 border-primary/40 bg-primary/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Cliente já cadastrado: <span className="font-bold">{clienteEncontrado.nome_completo}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {clienteEncontrado.cpf || clienteEncontrado.cnpj || ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setClienteEncontrado(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                Ignorar
              </Button>
              <Button 
                size="sm" 
                onClick={carregarDadosCliente}
                className="bg-primary"
              >
                Carregar dados
              </Button>
            </div>
          </div>
        )}

        {!isConjuge && (
          <div>
            <div className="flex items-center justify-between">
              <Label>CNPJ</Label>
              {getError("cnpj") && <span className="text-xs text-destructive">{getError("cnpj")?.message}</span>}
            </div>
            <Input 
              value={pessoa.cnpj} 
              onChange={(e) => update("cnpj", e.target.value)} 
              placeholder="00.000.000/0000-00"
              className={getError("cnpj") ? "border-destructive focus-visible:ring-destructive" : ""}
            />
          </div>
        )}

        <div>
          <Label>Filiação — Pai</Label>
          <Input value={pessoa.filiacaoPai} onChange={(e) => update("filiacaoPai", e.target.value)} placeholder="Nome do pai" />
        </div>

        <div>
          <Label>Filiação — Mãe</Label>
          <Input value={pessoa.filiacaoMae} onChange={(e) => update("filiacaoMae", e.target.value)} placeholder="Nome da mãe" />
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between">
            <Label>Endereço Completo *</Label>
            {getError("endereco") && <span className="text-xs text-destructive">{getError("endereco")?.message}</span>}
          </div>
          <Input
            value={pessoa.endereco}
            onChange={(e) => update("endereco", e.target.value)}
            onBlur={handleEnderecoBlur}
            placeholder="Rua, número, complemento"
            className={getError("endereco") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Bairro *</Label>
            {getError("bairro") && <span className="text-xs text-destructive">{getError("bairro")?.message}</span>}
          </div>
          <Input 
            value={pessoa.bairro} 
            onChange={(e) => update("bairro", e.target.value)} 
            placeholder="Bairro"
            className={getError("bairro") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Cidade *</Label>
            {getError("cidade") && <span className="text-xs text-destructive">{getError("cidade")?.message}</span>}
          </div>
          <Input 
            value={pessoa.cidade} 
            onChange={(e) => update("cidade", e.target.value)} 
            placeholder="Cidade"
            className={getError("cidade") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Estado *</Label>
            {getError("estado") && <span className="text-xs text-destructive">{getError("estado")?.message}</span>}
          </div>
          <Select value={pessoa.estado} onValueChange={(v) => update("estado", v)}>
            <SelectTrigger className={getError("estado") ? "border-destructive focus-visible:ring-destructive" : ""}><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              {estadosBR.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>CEP</Label>
            {getError("cep") && <span className="text-xs text-destructive">{getError("cep")?.message}</span>}
          </div>
          <Input 
            value={pessoa.cep} 
            onChange={(e) => update("cep", e.target.value)} 
            onBlur={handleCepBlur} 
            placeholder="00000-000"
            className={getError("cep") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>E-mail{emailRequired ? " *" : ""}</Label>
            {getError("email") && <span className="text-xs text-destructive">{getError("email")?.message}</span>}
          </div>
          <Input
            type="email"
            required={!!emailRequired}
            value={pessoa.email || ""}
            onChange={(e) => update("email", e.target.value)}
            placeholder="email@exemplo.com"
            className={getError("email") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Telefone</Label>
            {getError("telefone") && <span className="text-xs text-destructive">{getError("telefone")?.message}</span>}
          </div>
          <Input 
            value={pessoa.telefone || ""} 
            onChange={(e) => update("telefone", e.target.value)} 
            placeholder="(00) 00000-0000"
            className={getError("telefone") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>
      </div>
    </div>
  );
};

export default PessoaForm;
