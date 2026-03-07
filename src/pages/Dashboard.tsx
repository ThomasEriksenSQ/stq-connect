import DailyBrief from "@/components/dashboard/DailyBrief";
import ForesporslerTable from "@/components/dashboard/ForesporslerTable";
import OppfolgingerSection from "@/components/dashboard/OppfolgingerSection";

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <DailyBrief />
      <ForesporslerTable />
      <OppfolgingerSection />
    </div>
  );
};

export default Dashboard;
