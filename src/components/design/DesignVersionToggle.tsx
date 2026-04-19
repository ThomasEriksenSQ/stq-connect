import { useLocation } from "react-router-dom";

import { useDesignVersion } from "@/context/DesignVersionContext";
import { cn } from "@/lib/utils";

function shouldHideToggle(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/design-lab");
}

export function DesignVersionToggle() {
  const location = useLocation();
  const { canUseToggle, isV2Active, setVersion } = useDesignVersion();

  if (!canUseToggle || shouldHideToggle(location.pathname)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => setVersion(isV2Active ? "v1" : "v2")}
      aria-pressed={isV2Active}
      className={cn(
        "fixed bottom-5 right-5 z-[9999] inline-flex items-center rounded-full px-4 py-2 text-[0.8125rem] font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
        isV2Active
          ? "border border-transparent bg-[#2563EB] text-white hover:bg-[#1D4ED8] focus:ring-[#2563EB]"
          : "border border-[#DDE0E7] bg-[#F4F5F8] text-[#5C636E] hover:bg-[#ECEFF4] focus:ring-[#DDE0E7]",
      )}
    >
      {isV2Active ? "V2 · Bytt til V1 ←" : "V1 · Bytt til V2 →"}
    </button>
  );
}
