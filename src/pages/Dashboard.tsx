import DailyBrief from "@/components/dashboard/DailyBrief";
import OppfolgingerSection from "@/components/dashboard/OppfolgingerSection";
import FornyelsesVarsel from "@/components/dashboard/FornyelsesVarsel";
import { DashboardErrorBoundary } from "@/components/dashboard/DashboardErrorBoundary";

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <DashboardErrorBoundary>
        <DailyBrief />
      </DashboardErrorBoundary>
      <DashboardErrorBoundary>
        <FornyelsesVarsel />
      </DashboardErrorBoundary>
      <DashboardErrorBoundary>
        <OppfolgingerSection />
      </DashboardErrorBoundary>
    </div>
  );
};

export default Dashboard;
