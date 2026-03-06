import { useState } from "react";
import { cleanDescription } from "@/lib/cleanDescription";

interface DescriptionTextProps {
  text: string | null | undefined;
  /** Max lines before truncation. Default 2 */
  maxLines?: number;
  className?: string;
}

export function DescriptionText({ text, maxLines = 2, className = "" }: DescriptionTextProps) {
  const [expanded, setExpanded] = useState(false);
  const cleaned = cleanDescription(text);
  if (!cleaned) return null;

  return (
    <div className={className}>
      <p
        className={`text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap ${
          !expanded ? `line-clamp-${maxLines}` : ""
        }`}
        style={!expanded ? { WebkitLineClamp: maxLines, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}
      >
        {cleaned}
      </p>
      {cleaned.length > 120 && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="text-[0.75rem] text-primary hover:underline mt-0.5"
        >
          {expanded ? "Vis mindre" : "Vis mer"}
        </button>
      )}
    </div>
  );
}
