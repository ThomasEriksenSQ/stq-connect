import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

import { C } from "@/components/designlab/theme";

export type DesignLabMediaFrameRatio = "16:9" | "4:3" | "1:1" | "3:2";

const RATIO_PADDING: Record<DesignLabMediaFrameRatio, string> = {
  "16:9": "56.25%",
  "4:3": "75%",
  "1:1": "100%",
  "3:2": "66.6667%",
};

export interface DesignLabMediaFrameProps {
  src?: string | null;
  alt?: string;
  ratio?: DesignLabMediaFrameRatio;
  fallback?: ReactNode;
  rounded?: number;
  bordered?: boolean;
  className?: string;
  style?: CSSProperties;
  imgStyle?: CSSProperties;
}

/**
 * V2 media-container med fast aspect-ratio og fallback når bildet
 * mangler eller feiler. Brukes for nyhetsbilder, konsulentkort og
 * andre flater hvor layout shift må unngås.
 */
export function DesignLabMediaFrame({
  src,
  alt,
  ratio = "16:9",
  fallback,
  rounded = 4,
  bordered = true,
  className,
  style,
  imgStyle,
}: DesignLabMediaFrameProps) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(src) && !errored;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        paddingTop: RATIO_PADDING[ratio],
        background: C.surfaceAlt,
        borderRadius: rounded,
        border: bordered ? `1px solid ${C.borderLight}` : undefined,
        overflow: "hidden",
        ...style,
      }}
    >
      {showImage ? (
        <img
          src={src!}
          alt={alt ?? ""}
          loading="lazy"
          onError={() => setErrored(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            ...imgStyle,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.textFaint,
            fontSize: 12,
            padding: 16,
            textAlign: "center",
          }}
        >
          {fallback ?? alt ?? ""}
        </div>
      )}
    </div>
  );
}
