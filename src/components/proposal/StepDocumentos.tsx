import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Loader2, File } from "lucide-react";
import { PropostaDocumento } from "@/types/proposal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StepDocumentosProps {
  propostaId: string;
  documentos: PropostaDocumento[];
  onChange: (documentos: PropostaDocumento[]) => void;
}

const StepDocumentos = ({ propostaId, documentos, onChange }: StepDocumentosProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    const newDocs: PropostaDocumento[] = [];

    try {
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} excede 20MB`);
          continue;
        }

        const filePath = `${propostaId}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage
          .from("proposta-docs")
          .upload(filePath, file);

        if (error) {
          toast.error(`Erro ao enviar ${file.name}`);
          console.error("Upload error:", error);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("proposta-docs")
          .getPublicUrl(filePath);

        newDocs.push({
          id: crypto.randomUUID(),
          nome: file.name,
          tipo: file.type,
          tamanho: file.size,
          url: urlData.publicUrl,
          uploadedAt: new Date().toISOString(),
        });
      }

      if (newDocs.length > 0) {
        onChange([...documentos, ...newDocs]);
        toast.success(`${newDocs.length} arquivo(s) enviado(s)!`);
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar arquivo(s).");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async (doc: PropostaDocumento) => {
    onChange(documentos.filter((d) => d.id !== doc.id));
    toast.success("Arquivo removido.");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">Documentos</h3>
        <p className="text-muted-foreground">
          Anexe documentos adicionais: contratos anteriores, escrituras, matrículas, etc.
        </p>
      </div>

      <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 bg-primary/5 text-center space-y-4">
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-10 h-10 text-primary/50" />
          <p className="text-sm text-muted-foreground">
            Arraste arquivos aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, imagens, documentos — até 20MB por arquivo
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Selecionar Arquivos
            </>
          )}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFilesSelected}
          className="hidden"
        />
      </div>

      {documentos.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Arquivos Enviados ({documentos.length})
          </h4>
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {doc.tipo.startsWith("image/") ? (
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                ) : (
                  <File className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.nome}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(doc.tamanho)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(doc)}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StepDocumentos;
