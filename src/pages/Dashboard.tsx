import DailyBrief from "@/components/dashboard/DailyBrief";
import OppfolgingerSection from "@/components/dashboard/OppfolgingerSection";

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <DailyBrief />
      <OppfolgingerSection />
    </div>
  );
};

export default Dashboard;
