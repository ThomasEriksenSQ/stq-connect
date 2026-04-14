import { useParams, Navigate } from "react-router-dom";

export default function DesignLabContactDetail() {
  const { id } = useParams();
  return <Navigate to={`/design-lab/kontakter?contact=${id}`} replace />;
}
