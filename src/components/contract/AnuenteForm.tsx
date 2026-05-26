import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { X, Upload, FileImage, Sparkles } from "lucide-react";
import { Pessoa, criarPessoaVazia, Anuente as AnuenteType, QualificacaoNoNegocio } from "@/types/contract";
import PessoaForm from "./PessoaForm";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fileToVisionBase64Images } from "@/lib/imageUtils";

interface AnuenteFormProps {
  anuente: AnuenteType;
  onChange: (anuente: AnuenteType) => void;
  onRemove?: () => void;
  index: number;
  onExtractFiles?: (files: File[]) => Promise<void> | void;
  errors?: Array<{ field: string; message: string }>;
}

const qualificacaoLabels: Record<QualificacaoNoNegocio, string> = {
  conjuge_meeiro: "Cônjuge meeiro",
  ex_conjuge: "Ex-cônjuge",
  herdeiro: "Herdeiro",
  condomino: "Condômino",
  fiador: "Fiador",
  interveniente_garantidor: "Interveniente garantidor",
  outro: "Outro"
};

const AnuenteForm = ({ 
  anuente, 
  onChange, 
  onRemove, 
  index,
  onExtractFiles,
  errors 
}: AnuenteFormProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pessoaData: Pessoa = {
    ...criarPessoaVazia(),
    nome: anuente.nomeCompleto,
    nacionalidade: anuente.nacionalidade || "brasileira",
    profissao: anuente.profissao || "",
    estadoCivil: anuente.estadoCivil || "",
    regimeBens: anuente.regimeBens,
    documentoTipo: anuente.tipoDocumento as "rg" | "cnh" || "rg",
    documentoNumero: anuente.numeroDocumento || "",
    documentoOrgao: anuente.orgaoExpedidor || "",
    cpf: anuente.cpf || "",
    cnpj: anuente.cnpj || "",
    filiacaoPai: anuente.filiacaoPai || "",
    filiacaoMae: anuente.filiacaoMae || "",
    endereco: anuente.enderecoCompleto || "",
    bairro: anuente.bairro || "",
    cidade: anuente.cidade || "",
    estado: anuente.estado || "",
    cep: anuente.cep || "",
    email: anuente.email || "",
    telefone: anuente.telefone || ""
  };

  const handlePessoaChange = (pessoa: Pessoa) => {
    onChange({
      ...anuente,
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

      const merged = { ...anuente };
      for (const [key, value] of Object.entries(dados)) {
        if (value && typeof value === "string" && value.trim() !== "") {
          const mapKey = key as keyof AnuenteType;
          const currentValue = merged[mapKey];
          if (!currentValue || currentValue === "") {
            (merged as any)[mapKey] = value;
          }
        }
      }

      onChange(merged);
      toast.success("Dados do anuente extraídos com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao extrair dados do documento.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="border border-yellow-200 bg-yellow-50/50 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
            Anuente — {qualificacaoLabels[anuente.qualificacaoNoNegocio]}
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
        titulo="Dados do Anuente"
        index={index}
        hideEstadoCivil={false}
        errors={errors?.filter(e => !['qualificacaoNoNegocio', 'qualificacaoOutro', 'motivoAnuencia', 'assinaContrato'].includes(e.field))}
        onExtractFiles={onExtractFiles}
      />

      <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="w-4 h-4" />
          Preenchimento Automático via IA — Anuente
        </div>
        <p className="text-xs text-muted-foreground">
          Anexe documentos do anuente (RG, CPF, etc.) e a IA extrairá os dados automaticamente.
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
            Anexar Documentos
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
        <div className="md:col-span-2 space-y-1">
          <div className="flex items-center justify-between">
            <Label>Qualificação no Negócio *</Label>
            {getError("qualificacaoNoNegocio") && <span className="text-xs text-destructive">{getError("qualificacaoNoNegocio")?.message}</span>}
          </div>
          <Select 
            value={anuente.qualificacaoNoNegocio} 
            onValueChange={(v) => onChange({ ...anuente, qualificacaoNoNegocio: v as QualificacaoNoNegocio })}
          >
            <SelectTrigger className={getError("qualificacaoNoNegocio") ? "border-destructive focus-visible:ring-destructive" : ""}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(qualificacaoLabels) as QualificacaoNoNegocio[]).map((qualif) => (
                <SelectItem key={qualif} value={qualif}>{qualificacaoLabels[qualif]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {anuente.qualificacaoNoNegocio === "outro" && (
          <div className="md:col-span-2 space-y-1">
            <div className="flex items-center justify-between">
              <Label>Especificar *</Label>
              {getError("qualificacaoOutro") && <span className="text-xs text-destructive">{getError("qualificacaoOutro")?.message}</span>}
            </div>
            <Input 
              value={anuente.qualificacaoOutro || ""}
              onChange={(e) => onChange({ ...anuente, qualificacaoOutro: e.target.value })}
              placeholder="Descreva a qualificação..."
              className={getError("qualificacaoOutro") ? "border-destructive focus-visible:ring-destructive" : ""}
            />
          </div>
        )}

        <div className="md:col-span-2 space-y-1">
          <Label>Motivo da Anuência (opcional)</Label>
          <Textarea 
            value={anuente.motivoAnuencia || ""}
            onChange={(e) => onChange({ ...anuente, motivoAnuencia: e.target.value })}
            placeholder="Descreva o motivo da anuência..."
            className="min-h-[80px]"
          />
        </div>

        <div className="flex items-center gap-3">
          <Switch 
            checked={anuente.assinaContrato}
            onCheckedChange={(v) => onChange({ ...anuente, assinaContrato: v })}
          />
          <Label className="cursor-pointer">Assina o contrato</Label>
        </div>
      </div>
    </div>
  );
};

export default AnuenteForm;
