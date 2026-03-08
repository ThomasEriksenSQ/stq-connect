import DailyBrief from "@/components/dashboard/DailyBrief";
import OppfolgingerSection from "@/components/dashboard/OppfolgingerSection";
import FornyelsesVarsel from "@/components/dashboard/FornyelsesVarsel";

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <DailyBrief />
      <FornyelsesVarsel />
      <OppfolgingerSection />
    </div>
  );
};

export default Dashboard;
