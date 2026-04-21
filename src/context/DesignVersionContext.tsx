import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";

export type DesignVersion = "v1" | "v2";

const DEFAULT_VERSION: DesignVersion = "v2";

interface DesignVersionContextValue {
  version: DesignVersion;
  effectiveVersion: DesignVersion;
  isV2Active: boolean;
  canUseToggle: boolean;
  setVersion: (version: DesignVersion) => void;
}

const DesignVersionContext = createContext<DesignVersionContextValue | null>(null);

export function DesignVersionProvider({ children }: { children: ReactNode }) {
  useAuth();

  const version: DesignVersion = DEFAULT_VERSION;
  const canUseToggle = false;
  const effectiveVersion: DesignVersion = DEFAULT_VERSION;

  useEffect(() => {
    document.documentElement.dataset.design = effectiveVersion;

    return () => {
      delete document.documentElement.dataset.design;
    };
  }, [effectiveVersion]);

  const value = useMemo<DesignVersionContextValue>(
    () => ({
      version,
      effectiveVersion,
      isV2Active: effectiveVersion === "v2",
      canUseToggle,
      setVersion: () => {},
    }),
    [canUseToggle, effectiveVersion, version],
  );

  return (
    <DesignVersionContext.Provider value={value}>
      {children}
    </DesignVersionContext.Provider>
  );
}

export function useDesignVersion() {
  const context = useContext(DesignVersionContext);

  if (!context) {
    throw new Error("useDesignVersion must be used within a DesignVersionProvider");
  }

  return context;
}
