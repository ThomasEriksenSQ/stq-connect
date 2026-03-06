import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ContactCardContent } from "@/components/ContactCardContent";

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) return <p className="text-muted-foreground">Kontakt ikke funnet</p>;

  return (
    <div className="max-w-2xl">
      <Link to="/kontakter" className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
        Kontakter
      </Link>
      <ContactCardContent contactId={id} editable />
    </div>
  );
};

export default ContactDetail;
