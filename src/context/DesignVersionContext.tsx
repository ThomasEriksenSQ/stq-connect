import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";

export type DesignVersion = "v1" | "v2";

const STORAGE_KEY = "designVersion";
const ENABLE_V2 = new Set(["thomas@stacq.no", "jon@stacq.no"]);
const V2_ENABLED = true;

interface DesignVersionContextValue {
  version: DesignVersion;
  effectiveVersion: DesignVersion;
  isV2Active: boolean;
  canUseToggle: boolean;
  setVersion: (version: DesignVersion) => void;
}

const DesignVersionContext = createContext<DesignVersionContextValue | null>(null);

export function DesignVersionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [storedVersion, setStoredVersion] = usePersistentState<DesignVersion>(STORAGE_KEY, "v1");

  const version: DesignVersion = storedVersion === "v2" ? "v2" : "v1";
  const email = user?.email?.toLowerCase() ?? "";
  const canUseToggle = V2_ENABLED && ENABLE_V2.has(email);
  const effectiveVersion: DesignVersion = canUseToggle ? version : "v1";

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
      setVersion: setStoredVersion,
    }),
    [canUseToggle, effectiveVersion, setStoredVersion, version],
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
