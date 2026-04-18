import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { CompanyCardContent } from "@/components/CompanyCardContent";
import { RenderErrorBoundary } from "@/components/RenderErrorBoundary";

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) return <p className="text-muted-foreground">Selskap ikke funnet</p>;

  return (
    <div className="max-w-5xl">
      <Link to="/selskaper" className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors mb-3">
        <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
        Selskaper
      </Link>
      <RenderErrorBoundary
        resetKey={id}
        fallbackMessage="Kunne ikke laste selskapskortet. Prøv å laste siden på nytt."
      >
        <CompanyCardContent companyId={id} editable />
      </RenderErrorBoundary>
    </div>
  );
};

export default CompanyDetail;
