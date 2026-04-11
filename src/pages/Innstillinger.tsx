import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Mail, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { VarslingsInnstillinger } from "@/components/VarslingsInnstillinger";

export default function Innstillinger() {
  const [connecting, setConnecting] = useState(false);

  const { data: outlookStatus, isLoading: outlookLoading } = useQuery({
    queryKey: ["outlook-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { connected: false };
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://kbvzpcebfopqqrvmbiap.supabase.co"}/functions/v1/outlook-auth?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4Mjg3NDEsImV4cCI6MjA1ODQwNDc0MX0.8jzJm3oQ9GsA_j-mBYHbXPunEZs4jFd5VYNb-rNRHRE",
          },
        }
      );
      if (!res.ok) return { connected: false };
      return await res.json() as { connected: boolean };
    },
  });

  const handleConnectOutlook = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ikke innlogget");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://kbvzpcebfopqqrvmbiap.supabase.co"}/functions/v1/outlook-auth?action=login`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4Mjg3NDEsImV4cCI6MjA1ODQwNDc0MX0.8jzJm3oQ9GsA_j-mBYHbXPunEZs4jFd5VYNb-rNRHRE",
          },
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setConnecting(false);
    }
  };

  return (
    <div>
      <h1 className="text-[1.375rem] font-bold mb-6">Innstillinger</h1>

      {/* Outlook section */}
      <div className="mb-8">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
          Outlook-tilkobling
        </p>
        <div className="border border-border rounded-xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.07)] max-w-md">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[0.9375rem] font-semibold text-foreground">Microsoft Outlook</p>
              <p className="text-[0.8125rem] text-muted-foreground mt-1">
                Koble til Outlook for å synkronisere e-post og kalender.
              </p>
              <div className="mt-3 flex items-center gap-2">
                {outlookLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : outlookStatus?.connected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-[0.8125rem] text-emerald-600 font-medium">Tilkoblet</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[0.8125rem] text-muted-foreground">Ikke tilkoblet</span>
                  </>
                )}
              </div>
              <button
                onClick={handleConnectOutlook}
                disabled={connecting}
                className="mt-4 bg-primary text-primary-foreground h-9 px-4 rounded-lg text-[0.8125rem] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {connecting
                  ? "Kobler til..."
                  : outlookStatus?.connected
                    ? "Koble til på nytt"
                    : "Koble til Outlook"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Varslingsinnstillinger */}
      <div>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
          Varslingsinnstillinger
        </p>
        <VarslingsInnstillinger />
      </div>
    </div>
  );
}
