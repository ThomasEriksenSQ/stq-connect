import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const NettsideLeads = () => {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["website-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_leads")
        .select("id, email, consultant_name, message, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.5rem] font-bold text-foreground">
            Nettside-leads
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Tilgjengelighetsforespørsler fra stacq.no
          </p>
        </div>
        <span className="text-[0.8125rem] text-muted-foreground">
          {leads.length} leads
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          Ingen leads ennå
        </p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[140px_1fr_1fr_2fr] gap-4 px-4 py-2.5 bg-muted text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <span>Dato</span>
            <span>E-post</span>
            <span>Konsulent</span>
            <span>Melding</span>
          </div>
          <div className="divide-y divide-border">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="grid grid-cols-[140px_1fr_1fr_2fr] gap-4 px-4 py-3 text-[0.8125rem] text-foreground"
              >
                <span className="text-muted-foreground">
                  {lead.created_at
                    ? format(new Date(lead.created_at), "d. MMM yyyy HH:mm", { locale: nb })
                    : "—"}
                </span>
                <span>
                  {lead.email || "—"}
                </span>
                <span>
                  {lead.consultant_name || "—"}
                </span>
                <span className="text-foreground/70">
                  {lead.message || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NettsideLeads;
