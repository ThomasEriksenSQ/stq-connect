import { Navigate } from "react-router-dom";

// Detail view is now integrated as a sheet panel in DesignLabContacts
export default function DesignLabContactDetail() {
  return <Navigate to="/design-lab/kontakter" replace />;
}
