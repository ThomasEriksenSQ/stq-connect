import { useState } from "react";
import DailyBrief from "@/components/dashboard/DailyBrief";
import OppfolgingerSection from "@/components/dashboard/OppfolgingerSection";
import { DashboardErrorBoundary } from "@/components/dashboard/DashboardErrorBoundary";
import { cn } from "@/lib/utils";

type Tab = "agent" | "oppfolginger";

const Dashboard = () => {
  const [tab, setTab] = useState<Tab>("agent");

  return (
    <div className="space-y-6">

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setTab("agent")}
          className={cn(
            "relative px-4 py-2.5 text-[0.875rem] font-medium transition-colors",
            tab === "agent"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Agent
          {tab === "agent" && (
            <span className="absolute bottom-[-1px] left-4 right-4 h-[2px] bg-primary rounded-full" />
          )}
        </button>
        <button
          onClick={() => setTab("oppfolginger")}
          className={cn(
            "relative px-4 py-2.5 text-[0.875rem] font-medium transition-colors",
            tab === "oppfolginger"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Oppfølginger
          {tab === "oppfolginger" && (
            <span className="absolute bottom-[-1px] left-4 right-4 h-[2px] bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <DashboardErrorBoundary>
        {tab === "agent" && <DailyBrief />}
        {tab === "oppfolginger" && <OppfolgingerSection />}
      </DashboardErrorBoundary>
    </div>
  );
};

export default Dashboard;
