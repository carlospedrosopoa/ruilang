import { TextareaHTMLAttributes, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TemplateEditorProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

const TemplateEditor = ({ value, onChange, className, ...props }: TemplateEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    if (highlightRef.current) {
      let highlighted = value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

      // Highlight cláusula opening tags
      highlighted = highlighted.replace(
        /(&lt;!--\s*CLAUSULA\s+id=&quot;[^&]+&quot;(?:\s+titulo=&quot;[^&]*&quot;)?\s*--&gt;)/g,
        '<span class="bg-green-100 text-green-800 rounded px-1">$1</span>'
      );

      // Highlight cláusula closing tags
      highlighted = highlighted.replace(
        /(&lt;!--\s*\/CLAUSULA\s*--&gt;)/g,
        '<span class="bg-green-100 text-green-800 rounded px-1">$1</span>'
      );

      // Highlight references
      highlighted = highlighted.replace(
        /({{(REF|NUM|TITULO):[^}]+}})/g,
        '<span class="bg-blue-100 text-blue-800 rounded px-1">$1</span>'
      );

      highlightRef.current.innerHTML = highlighted;
    }
  }, [value]);

  return (
    <div className="relative w-full">
      <div
        ref={highlightRef}
        className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none whitespace-pre-wrap break-words p-3 text-sm font-mono"
        aria-hidden="true"
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        className={cn(
          "w-full min-h-[260px] resize-y bg-transparent relative z-10 font-mono text-sm",
          className
        )}
        {...props}
      />
    </div>
  );
};

export default TemplateEditor;
