import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ContactCardContent } from "@/components/ContactCardContent";

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return <p className="text-muted-foreground">Kontakt ikke funnet</p>;

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors mb-3">
        <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
        Tilbake
      </button>
      <ContactCardContent contactId={id} editable />
    </div>
  );
};

export default ContactDetail;
