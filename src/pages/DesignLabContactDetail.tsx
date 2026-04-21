import { useParams, Navigate } from "react-router-dom";
import { getModernContactPath } from "@/lib/crmNavigation";

export default function DesignLabContactDetail() {
  const { id } = useParams();
  return <Navigate to={id ? getModernContactPath(id, "design-lab") : "/design-lab/kontakter"} replace />;
}
