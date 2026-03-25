import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy,
  Download,
  Sparkles,
  Pencil,
  Eye,
  Save,
  Loader2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

interface ProposalEditorProps {
  proposta: string;
  isGenerating: boolean;
  onRegenerate: () => void;
  onSave: (text: string) => Promise<void>;
  onDownloadDocx: () => void;
}

const ProposalEditor = ({
  proposta,
  isGenerating,
  onRegenerate,
  onSave,
  onDownloadDocx,
}: ProposalEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(proposta);
  const [originalText] = useState(proposta);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasChanges = editedText !== proposta;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(isEditing ? editedText : proposta);
    toast.success("Proposta copiada!");
  }, [isEditing, editedText, proposta]);

  const handleDownloadTxt = useCallback(() => {
    const text = isEditing ? editedText : proposta;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposta_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [isEditing, editedText, proposta]);

  const handleToggleEdit = () => {
    if (isEditing && hasChanges) {
      handleSave();
    } else {
      setIsEditing(!isEditing);
      if (!isEditing) {
        setEditedText(proposta);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedText);
      setIsEditing(false);
      toast.success("Alterações salvas!");
    } catch {
      toast.error("Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = () => {
    setEditedText(originalText);
    toast.info("Texto restaurado ao original.");
  };

  return (
    <div className="border border-border rounded-lg p-6 bg-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Proposta Comercial
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant={isEditing ? "default" : "outline"}
            size="sm"
            onClick={handleToggleEdit}
            disabled={isSaving}
            className="gap-1"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            ) : isEditing ? (
              <><Save className="w-4 h-4" /> Salvar</>
            ) : (
              <><Pencil className="w-4 h-4" /> Modo Advogado</>
            )}
          </Button>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="gap-1">
              <Eye className="w-4 h-4" /> Visualizar
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          ✏️ <strong>Modo Advogado:</strong> Edite o texto da proposta livremente. As alterações serão salvas no sistema.
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="w-4 h-4 mr-1" /> Copiar
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadTxt}>
          <Download className="w-4 h-4 mr-1" /> .txt
        </Button>
        <Button size="sm" onClick={onDownloadDocx} className="bg-primary">
          <Download className="w-4 h-4 mr-1" /> .DOCX
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={isGenerating}
        >
          <Sparkles className="w-4 h-4 mr-1" /> Regerar
        </Button>
        {isEditing && editedText !== originalText && (
          <Button variant="ghost" size="sm" onClick={handleUndo}>
            <Undo2 className="w-4 h-4 mr-1" /> Restaurar Original
          </Button>
        )}
      </div>

      {isEditing ? (
        <Textarea
          ref={textareaRef}
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="min-h-[500px] font-mono text-sm leading-relaxed resize-y"
          placeholder="Edite a proposta..."
        />
      ) : (
        <div className="border border-border rounded-lg p-6 bg-background">
          <pre className="whitespace-pre-wrap text-sm text-foreground font-body leading-relaxed">
            {proposta}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ProposalEditor;
