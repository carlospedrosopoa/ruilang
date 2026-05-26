import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Upload, FileImage, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pessoa, criarPessoaVazia, Procurador as ProcuradorType, TipoProcuracao } from "@/types/contract";
import PessoaForm from "./PessoaForm";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fileToVisionBase64Images } from "@/lib/imageUtils";

interface ProcuradorFormProps {
  procurador: ProcuradorType;
  onChange: (procurador: ProcuradorType) => void;
  onRemove?: () => void;
  representanteNome: string;
  index: number;
  onExtractFiles?: (files: File[]) => Promise<void> | void;
  errors?: Array<{ field: string; message: string }>;
}

const tipoProcuracaoLabels: Record<TipoProcuracao, string> = {
  publica: "Pública",
  particular_com_firma: "Particular com firma reconhecida",
  particular_sem_firma: "Particular sem firma"
};

const ProcuradorForm = ({ 
  procurador, 
  onChange, 
  onRemove, 
  representanteNome, 
  index,
  onExtractFiles,
  errors 
}: ProcuradorFormProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pessoaData: Pessoa = {
    ...criarPessoaVazia(),
    nome: procurador.nomeCompleto,
    nacionalidade: procurador.nacionalidade || "brasileira",
    profissao: procurador.profissao || "",
    estadoCivil: procurador.estadoCivil || "",
    regimeBens: procurador.regimeBens,
    documentoTipo: procurador.tipoDocumento as "rg" | "cnh" || "rg",
    documentoNumero: procurador.numeroDocumento || "",
    documentoOrgao: procurador.orgaoExpedidor || "",
    cpf: procurador.cpf || "",
    cnpj: procurador.cnpj || "",
    filiacaoPai: procurador.filiacaoPai || "",
    filiacaoMae: procurador.filiacaoMae || "",
    endereco: procurador.enderecoCompleto || "",
    bairro: procurador.bairro || "",
    cidade: procurador.cidade || "",
    estado: procurador.estado || "",
    cep: procurador.cep || "",
    email: procurador.email || "",
    telefone: procurador.telefone || ""
  };

  const handlePessoaChange = (pessoa: Pessoa) => {
    onChange({
      ...procurador,
      nomeCompleto: pessoa.nome,
      nacionalidade: pessoa.nacionalidade,
      profissao: pessoa.profissao,
      estadoCivil: pessoa.estadoCivil,
      regimeBens: pessoa.regimeBens,
      tipoDocumento: pessoa.documentoTipo,
      numeroDocumento: pessoa.documentoNumero,
      orgaoExpedidor: pessoa.documentoOrgao,
      cpf: pessoa.cpf,
      cnpj: pessoa.cnpj,
      filiacaoPai: pessoa.filiacaoPai,
      filiacaoMae: pessoa.filiacaoMae,
      enderecoCompleto: pessoa.endereco,
      bairro: pessoa.bairro,
      cidade: pessoa.cidade,
      estado: pessoa.estado,
      cep: pessoa.cep,
      email: pessoa.email,
      telefone: pessoa.telefone
    });
  };

  const getError = (field: string) => errors?.find(e => e.field === field);

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
        }
      }

      const nested = await Promise.all(files.map((f) => fileToVisionBase64Images(f)));
      const images = nested.flat();

      const { data, error } = await supabase.functions.invoke("extract-person", {
        body: { images, ai: { provider: "openai" } },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const dados = data.dados;
      if (!dados) throw new Error("Nenhum dado extraído");

      const merged = { ...procurador };
      for (const [key, value] of Object.entries(dados)) {
        if (value && typeof value === "string" && value.trim() !== "") {
          const mapKey = key as keyof ProcuradorType;
          const currentValue = merged[mapKey];
          if (!currentValue || currentValue === "") {
            (merged as any)[mapKey] = value;
          }
        }
      }

      onChange(merged);
      toast.success("Dados do procurador extraídos com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao extrair dados do documento.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="border border-orange-200 bg-orange-50/50 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            Procurador de {representanteNome}
          </div>
        </div>
        {onRemove && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <PessoaForm
        pessoa={pessoaData}
        onChange={handlePessoaChange}
        titulo="Dados do Procurador"
        index={index}
        hideEstadoCivil={false}
        errors={errors?.filter(e => !['tipoProcuracao', 'dataProcuracao', 'cartorioLivroFolha', 'poderesOutorgados'].includes(e.field))}
        onExtractFiles={onExtractFiles}
      />

      <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="w-4 h-4" />
          Preenchimento Automático via IA — Procuração
        </div>
        <p className="text-xs text-muted-foreground">
          Anexe a procuração e a IA extrairá os dados do procurador, data e cartório.
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
            Anexar Procuração
          </Button>
          {files.length > 0 && (
            <Button type="button" size="sm" onClick={handleExtract} disabled={isExtracting} className="bg-primary text-primary-foreground">
              {isExtracting ? (
                <><FileImage className="w-4 h-4 mr-1 animate-spin" />Extraindo...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-1" />Extrair Dados</>
              )}
            </Button>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFilesSelected} className="hidden" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/50">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Tipo de Procuração</Label>
            {getError("tipoProcuracao") && <span className="text-xs text-destructive">{getError("tipoProcuracao")?.message}</span>}
          </div>
          <Select 
            value={procurador.tipoProcuracao || ""} 
            onValueChange={(v) => onChange({ ...procurador, tipoProcuracao: v as TipoProcuracao })}
          >
            <SelectTrigger className={getError("tipoProcuracao") ? "border-destructive focus-visible:ring-destructive" : ""}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(tipoProcuracaoLabels) as TipoProcuracao[]).map((tipo) => (
                <SelectItem key={tipo} value={tipo}>{tipoProcuracaoLabels[tipo]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Data da Procuração</Label>
            {getError("dataProcuracao") && <span className="text-xs text-destructive">{getError("dataProcuracao")?.message}</span>}
          </div>
          <Input 
            type="date" 
            value={procurador.dataProcuracao ? new Date(procurador.dataProcuracao).toISOString().split('T')[0] : ""}
            onChange={(e) => onChange({ ...procurador, dataProcuracao: e.target.value ? new Date(e.target.value) : undefined })}
            className={getError("dataProcuracao") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <div className="flex items-center justify-between">
            <Label>Cartório / Livro / Folha</Label>
            {getError("cartorioLivroFolha") && <span className="text-xs text-destructive">{getError("cartorioLivroFolha")?.message}</span>}
          </div>
          <Input 
            value={procurador.cartorioLivroFolha || ""}
            onChange={(e) => onChange({ ...procurador, cartorioLivroFolha: e.target.value })}
            placeholder="Ex: 1º Cartório de Registro de Títulos e Documentos — Livro 10, Folha 25"
            className={getError("cartorioLivroFolha") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <div className="flex items-center justify-between">
            <Label>Poderes Outorgados</Label>
            {getError("poderesOutorgados") && <span className="text-xs text-destructive">{getError("poderesOutorgados")?.message}</span>}
          </div>
          <Textarea 
            value={procurador.poderesOutorgados || ""}
            onChange={(e) => onChange({ ...procurador, poderesOutorgados: e.target.value })}
            placeholder="Descreva os poderes conferidos ao procurador..."
            className={cn("min-h-[100px]", getError("poderesOutorgados") ? "border-destructive focus-visible:ring-destructive" : "")}
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <Label>Anexo da Procuração (URL)</Label>
          <Input 
            value={procurador.anexoProcuracaoUrl || ""}
            onChange={(e) => onChange({ ...procurador, anexoProcuracaoUrl: e.target.value })}
            placeholder="URL do arquivo no storage"
          />
        </div>
      </div>
    </div>
  );
};

export default ProcuradorForm;
