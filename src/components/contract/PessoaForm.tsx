import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, Upload, FileImage, Loader2, Sparkles, X } from "lucide-react";
import { Pessoa, estadosCivis, estadosBR, criarConjugeVazio } from "@/types/contract";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ConjugeForm from "./ConjugeForm";

interface PessoaFormProps {
  pessoa: Pessoa;
  onChange: (pessoa: Pessoa) => void;
  onRemove?: () => void;
  titulo: string;
  index: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get raw base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PessoaForm = ({ pessoa, onChange, onRemove, titulo, index }: PessoaFormProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsConjuge = (ec: string) => ec === "Casado(a)" || ec === "União Estável";

  const update = (field: keyof Pessoa, value: string) => {
    const updated = { ...pessoa, [field]: value };
    if (field === "estadoCivil") {
      if (needsConjuge(value) && !pessoa.conjuge) {
        updated.conjuge = criarConjugeVazio();
      } else if (!needsConjuge(value)) {
        updated.conjuge = undefined;
      }
    }
    onChange(updated);
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
      const images = await Promise.all(files.map(fileToBase64));

      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: { images },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const dados = data.dados;
      if (!dados) throw new Error("Nenhum dado extraído");

      // Merge extracted data, only overwrite empty fields
      const merged = { ...pessoa };
      for (const [key, value] of Object.entries(dados)) {
        if (value && typeof value === "string" && value.trim() !== "") {
          const pessoaKey = key as keyof Pessoa;
          const currentValue = merged[pessoaKey];
          if (!currentValue || currentValue === "") {
            (merged as any)[pessoaKey] = value;
          }
        }
      }

      onChange(merged);
      toast.success("Dados extraídos com sucesso! Verifique e complete os campos.");
    } catch (err: any) {
      console.error("Extract error:", err);
      toast.error(err.message || "Erro ao extrair dados do documento.");
    } finally {
      setIsExtracting(false);
    }
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

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-1" />
            Anexar Documento
          </Button>
          {files.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={handleExtract}
              disabled={isExtracting}
              className="bg-primary text-primary-foreground"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Extraindo...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Extrair Dados
                </>
              )}
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />
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

        {needsConjuge(pessoa.estadoCivil) && pessoa.conjuge && (
          <div className="md:col-span-2">
            <ConjugeForm
              conjuge={pessoa.conjuge}
              onChange={(c) => onChange({ ...pessoa, conjuge: c })}
              label={pessoa.estadoCivil === "União Estável" ? "Companheiro(a)" : "Cônjuge"}
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
