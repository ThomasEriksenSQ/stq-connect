import DailyBrief from "@/components/dashboard/DailyBrief";
// import OppfolgingerSection from "@/components/dashboard/OppfolgingerSection";
import MockOppfolgingerSection from "@/components/dashboard/MockOppfolgingerSection";

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <DailyBrief />
      <MockOppfolgingerSection />
    </div>
  );
};

export default Dashboard;
