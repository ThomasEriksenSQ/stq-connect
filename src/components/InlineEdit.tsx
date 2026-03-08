import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  type?: "text" | "url" | "email" | "tel";
  mono?: boolean;
  multiline?: boolean;
  className?: string;
}

const InlineEdit = ({ value, onSave, placeholder = "—", type = "text", mono, multiline, className }: InlineEditProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) save();
    if (e.key === "Escape") cancel();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className={cn(
              "flex-1 rounded-lg border border-primary/30 bg-background px-2.5 py-1.5 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none",
              mono && "font-mono",
              className
            )}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex-1 rounded-lg border border-primary/30 bg-background px-2.5 py-1.5 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary/40 min-w-0",
              mono && "font-mono",
              className
            )}
          />
        )}
        <button onClick={save} className="p-1 rounded-md hover:bg-primary/10 text-primary transition-colors">
          <Check className="h-3.5 w-3.5 stroke-[2]" />
        </button>
        <button onClick={cancel} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground transition-colors">
          <X className="h-3.5 w-3.5 stroke-[2]" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "group inline-flex items-center gap-1.5 text-[14px] font-medium hover:text-foreground/60 transition-colors text-left max-w-full",
        !value && "text-muted-foreground/40 italic",
        mono && "font-mono",
        className
      )}
    >
      <span className="truncate">{value || placeholder}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
    </button>
  );
};

export default InlineEdit;
