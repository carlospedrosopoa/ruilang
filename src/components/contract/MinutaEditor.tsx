import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, AlignLeft, Undo2, Redo2, Save, RefreshCcw, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface MinutaEditorProps {
  minutaOriginal: string;
  minutaEditada?: string;
  onSave?: (conteudo: string) => void;
  onReset?: () => void;
}

const MinutaEditor = ({ minutaOriginal, minutaEditada, onSave, onReset }: MinutaEditorProps) => {
  const [conteudo, setConteudo] = useState<string>(minutaEditada || minutaOriginal);
  const [isDirty, setIsDirty] = useState<boolean>(minutaEditada && minutaEditada !== minutaOriginal);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<string[]>([minutaOriginal]);
  const historyIndexRef = useRef<number>(0);

  useEffect(() => {
    setConteudo(minutaEditada || minutaOriginal);
    setIsDirty(minutaEditada && minutaEditada !== minutaOriginal);
  }, [minutaOriginal, minutaEditada]);

  const handleInput = () => {
    if (editorRef.current) {
      const novoConteudo = editorRef.current.innerText || "";
      setConteudo(novoConteudo);
      setIsDirty(novoConteudo !== minutaOriginal);
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(conteudo);
      toast.success("Edições salvas com sucesso!");
      setIsDirty(false);
      historyRef.current = [...historyRef.current.slice(0, historyIndexRef.current + 1), conteudo];
      historyIndexRef.current = historyRef.current.length - 1;
    }
  };

  const handleReset = () => {
    setConteudo(minutaOriginal);
    setIsDirty(false);
    if (onReset) {
      onReset();
    }
    toast.success("Restaurado para a versão original!");
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const conteudoAnterior = historyRef.current[historyIndexRef.current];
      setConteudo(conteudoAnterior);
      setIsDirty(conteudoAnterior !== minutaOriginal);
      if (editorRef.current) {
        editorRef.current.innerText = conteudoAnterior;
      }
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const conteudoProximo = historyRef.current[historyIndexRef.current];
      setConteudo(conteudoProximo);
      setIsDirty(conteudoProximo !== minutaOriginal);
      if (editorRef.current) {
        editorRef.current.innerText = conteudoProximo;
      }
    }
  };

  const handleFormat = (command: string) => {
    document.execCommand(command, false, null);
    editorRef.current?.focus();
  };

  const renderDiff = () => {
    const originalLines = minutaOriginal.split("\n");
    const editadoLines = conteudo.split("\n");
    const maxLength = Math.max(originalLines.length, editadoLines.length);

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Versão Original</div>
          {originalLines.map((line, i) => (
            <div key={i} className="text-xs py-0.5 px-2 rounded bg-red-50 text-red-800">
              {line || <span className="opacity-50">—</span>}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Versão Editada</div>
          {editadoLines.map((line, i) => (
            <div key={i} className="text-xs py-0.5 px-2 rounded bg-green-50 text-green-800">
              {line || <span className="opacity-50">—</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleFormat('bold')}
            title="Negrito"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleFormat('italic')}
            title="Itálico"
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleFormat('insertUnorderedList')}
            title="Lista"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleFormat('justifyLeft')}
            title="Alinhar à esquerda"
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-2" />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUndo}
            disabled={historyIndexRef.current === 0}
            title="Desfazer"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRedo}
            disabled={historyIndexRef.current === historyRef.current.length - 1}
            title="Refazer"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowDiff(!showDiff)}
            title="Ver alterações"
          >
            <Eye className="w-4 h-4 mr-1.5" />
            {showDiff ? "Ocultar diff" : "Ver alterações"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReset}
            title="Restaurar original"
          >
            <RefreshCcw className="w-4 h-4 mr-1.5" />
            Restaurar
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={!isDirty}
            className="bg-primary"
          >
            <Save className="w-4 h-4 mr-1.5" />
            Salvar Edições
          </Button>
        </div>
      </div>

      {showDiff ? (
        renderDiff()
      ) : (
        <div 
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          className="border border-border rounded-xl p-6 sm:p-8 bg-card shadow-card min-h-[400px] whitespace-pre-wrap text-sm text-foreground font-body leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          dangerouslySetInnerHTML={{ 
            __html: conteudo
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\n/g, '<br>')
              .replace(/(CLÁUSULA [A-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÇ]+(?: – .+)?)/g, '<strong>$1</strong>')
          }}
        />
      )}
    </div>
  );
};

export default MinutaEditor;
