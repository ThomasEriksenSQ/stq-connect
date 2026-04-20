import type { CSSProperties, ReactNode } from "react";

import { C } from "@/components/designlab/theme";

export interface DesignLabSectionHeaderProps {
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * V2 seksjonsheader: liten tittel + valgfri meta-linje + valgfri høyre-aksjon.
 * Konsoliderer mønsteret som flere DesignLab-sider bruker ad-hoc.
 */
export function DesignLabSectionHeader({
  title,
  meta,
  right,
  className,
  style,
}: DesignLabSectionHeaderProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        paddingBottom: 12,
        borderBottom: `1px solid ${C.borderLight}`,
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.text,
            margin: 0,
            letterSpacing: 0,
          }}
        >
          {title}
        </h2>
        {meta ? (
          <div
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: C.textFaint,
              marginTop: 4,
            }}
          >
            {meta}
          </div>
        ) : null}
      </div>
      {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
    </div>
  );
}
