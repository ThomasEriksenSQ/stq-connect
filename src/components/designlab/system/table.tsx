import { ChevronDown, ChevronUp } from "lucide-react";

import { C } from "@/components/designlab/theme";
import { cn } from "@/lib/utils";

export function DesignLabColumnHeader<TField extends string>({
  label,
  field,
  sort,
  onSort,
  className,
}: {
  label: string;
  field: TField;
  sort: { field: TField; dir: "asc" | "desc" };
  onSort: (field: TField) => void;
  className?: string;
}) {
  const active = sort.field === field;

  return (
    <button
      onClick={() => onSort(field)}
      className={cn("flex items-center gap-0.5 transition-colors", className)}
      style={{
        fontSize: 11,
        fontWeight: active ? 600 : 500,
        letterSpacing: "0.01em",
        color: active ? C.text : C.textMuted,
      }}
    >
      {label}
      {active
        ? sort.dir === "asc"
          ? <ChevronUp style={{ width: 12, height: 12 }} />
          : <ChevronDown style={{ width: 12, height: 12 }} />
        : null}
    </button>
  );
}
