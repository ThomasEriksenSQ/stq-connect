import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { ClipboardList, ExternalLink } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

export default function Soknad() {
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["website_applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[1.5rem] font-bold">Søknader</h1>
      </div>

      {/* Stat card */}
      <div className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-sm">
        <ClipboardList className="h-5 w-5 text-primary" />
        <div>
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Totalt søknader
          </p>
          <p className="text-[1.25rem] font-bold text-foreground">
            {isLoading ? "–" : applications.length}
          </p>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-[0.9375rem]">Laster søknader...</p>
      ) : applications.length === 0 ? (
        <p className="text-muted-foreground text-[0.9375rem]">Ingen søknader ennå.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[0.75rem]">Dato</TableHead>
                <TableHead className="text-[0.75rem]">Fullt navn</TableHead>
                <TableHead className="text-[0.75rem]">E-post</TableHead>
                <TableHead className="text-[0.75rem]">Telefon</TableHead>
                <TableHead className="text-[0.75rem]">CV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="text-[0.8125rem] text-muted-foreground whitespace-nowrap">
                    {format(new Date(app.created_at), "dd.MM.yyyy HH:mm", { locale: nb })}
                  </TableCell>
                  <TableCell className="text-[0.8125rem] font-medium text-foreground">
                    {app.full_name}
                  </TableCell>
                  <TableCell className="text-[0.8125rem]">
                    <a
                      href={`mailto:${app.email}`}
                      className="text-primary hover:underline"
                    >
                      {app.email}
                    </a>
                  </TableCell>
                  <TableCell className="text-[0.8125rem] text-foreground/70">
                    {app.phone || "–"}
                  </TableCell>
                  <TableCell className="text-[0.8125rem]">
                    {app.cv_url ? (
                      <a
                        href={app.cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Last ned CV
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
