import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileImage, Loader2, Sparkles, X } from "lucide-react";
import { Imovel, estadosBR } from "@/types/contract";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImageToBase64 } from "@/lib/imageUtils";

interface StepObjetoProps {
  imovel: Imovel;
  onChange: (imovel: Imovel) => void;
}

const StepObjeto = ({ imovel, onChange }: StepObjetoProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof Imovel, value: string | boolean) => {
    onChange({ ...imovel, [field]: value });
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

      const { data, error } = await supabase.functions.invoke("extract-property", {
        body: { images },
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
      toast.error(err.message || "Erro ao extrair dados do documento.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">
          Objeto do Contrato
        </h3>
        <p className="text-muted-foreground">
          Descreva o imóvel objeto da transação.
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

      <div className="border border-border rounded-lg p-5 space-y-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tipo do Imóvel *</Label>
            <Select value={imovel.tipo} onValueChange={(v) => update("tipo", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
            <Label>Área Total *</Label>
            <Input value={imovel.areaTotal} onChange={(e) => update("areaTotal", e.target.value)} placeholder="Ex: 360,00 m²" />
          </div>

          <div>
            <Label>Localização / Denominação *</Label>
            <Input value={imovel.localizacao} onChange={(e) => update("localizacao", e.target.value)} placeholder="Ex: Praia Camboim" />
          </div>

          <div>
            <Label>Município *</Label>
            <Input value={imovel.municipio} onChange={(e) => update("municipio", e.target.value)} placeholder="Município" />
          </div>

          <div>
            <Label>Estado *</Label>
            <Select value={imovel.estadoImovel} onValueChange={(v) => update("estadoImovel", v)}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
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
            <Label>Matrícula nº *</Label>
            <Input value={imovel.matricula} onChange={(e) => update("matricula", e.target.value)} placeholder="Nº da matrícula" />
          </div>

          <div>
            <Label>Registro de Imóveis</Label>
            <Input value={imovel.registroImoveis} onChange={(e) => update("registroImoveis", e.target.value)} placeholder="Ex: 1ª Zona de Torres/RS" />
          </div>
        </div>

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
