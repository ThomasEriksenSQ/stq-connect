import { useEffect, useState } from "react";
import { AlertCircle, ClipboardList, Flame, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { extractCategory } from "@/lib/categoryUtils";
import { Skeleton } from "@/components/ui/skeleton";

interface BriefData {
  overdueCount: number;
  foresporslerCount: number;
  foresporslerNames: string[];
  behovNaCount: number;
  behovNaNames: string[];
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "God morgen";
  if (h < 18) return "God ettermiddag";
  return "God kveld";
}

const DailyBrief = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [data, setData] = useState<BriefData | null>(null);
  const [aiSentence, setAiSentence] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setAiSentence(null);

    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();

      const [profileRes, overdueRes, foresporslerRes, foresporslerCountRes, activitiesRes, contactsRes] =
        await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).single(),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("status", "open")
            .lt("due_date", todayStr)
            .eq("assigned_to", user.id),
          supabase
            .from("foresporsler")
            .select("selskap_navn")
            .gte("created_at", fortyFiveDaysAgo)
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("foresporsler")
            .select("id", { count: "exact", head: true })
            .gte("created_at", fortyFiveDaysAgo),
          supabase
            .from("activities")
            .select("contact_id, subject, description, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("contacts")
            .select("id, first_name, last_name, updated_at"),
        ]);

      if (profileRes.data) setProfile(profileRes.data);

      const overdueCount = overdueRes.count ?? 0;
      const foresporslerCount = foresporslerCountRes.count ?? 0;
      const foresporslerNames = (foresporslerRes.data ?? []).map((f) => f.selskap_navn);

      // Compute "Behov nå" contacts from activities
      const activities = activitiesRes.data ?? [];
      const contacts = contactsRes.data ?? [];

      const actByContact = new Map<string, typeof activities>();
      for (const a of activities) {
        if (!a.contact_id) continue;
        const list = actByContact.get(a.contact_id) || [];
        list.push(a);
        actByContact.set(a.contact_id, list);
      }

      const behovNaContacts: { name: string; updated_at: string }[] = [];
      for (const c of contacts) {
        const cActs = actByContact.get(c.id) || [];
        const sorted = [...cActs].sort((a, b) => b.created_at.localeCompare(a.created_at));
        for (const act of sorted) {
          const cat = extractCategory(act.subject, act.description);
          if (cat === "Behov nå") {
            behovNaContacts.push({
              name: `${c.first_name} ${c.last_name}`.trim(),
              updated_at: c.updated_at,
            });
            break;
          }
          if (cat) break; // Different signal found first
        }
      }

      behovNaContacts.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

      const briefData: BriefData = {
        overdueCount,
        foresporslerCount,
        foresporslerNames,
        behovNaCount: behovNaContacts.length,
        behovNaNames: behovNaContacts.slice(0, 2).map((c) => c.name),
      };

      setData(briefData);
      setFetchedAt(new Date());
      setLoading(false);

      // Fetch AI sentence (non-blocking)
      fetchAiSentence(briefData);
    } catch (e) {
      console.error("DailyBrief fetch error:", e);
      setLoading(false);
    }
  };

  const fetchAiSentence = async (d: BriefData) => {
    setAiLoading(true);
    try {
      const resp = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Forfalt: ${d.overdueCount}, Forespørsler siste 45 dager: ${d.foresporslerCount}, Kontakter med behov nå: ${d.behovNaCount}`,
            },
          ],
          system:
            "Du er en norsk CRM-assistent for STACQ, et IT-konsulentbyrå. Skriv én kort, naturlig norsk setning (maks 20 ord) som oppsummerer dagens situasjon basert på dataene. Vær direkte og handlingsorientert.",
        },
      });

      if (resp.data?.text) {
        setAiSentence(resp.data.text);
      }
    } catch {
      // Fail silently
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  const timeStr = fetchedAt
    ? `Oppdatert kl. ${fetchedAt.getHours().toString().padStart(2, "0")}:${fetchedAt.getMinutes().toString().padStart(2, "0")}`
    : "";

  const formatNameList = (names: string[], total: number) => {
    if (names.length === 0) return "";
    const shown = names.join(", ");
    const remaining = total - names.length;
    return remaining > 0 ? `${shown} +${remaining} til` : shown;
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden px-5 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-[1.25rem] font-bold text-foreground">
          {getGreeting()}, {firstName} 👋
        </h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            AI-generert
          </span>
          <button
            onClick={fetchData}
            className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors"
            title="Oppdater"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* AI sentence */}
      {(aiLoading || loading) && <Skeleton className="h-4 w-3/4 mb-3" />}
      {aiSentence && !aiLoading && !loading && (
        <p className="text-sm italic text-muted-foreground mb-3 animate-in fade-in duration-500">
          {aiSentence}
        </p>
      )}

      {/* Data rows */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-2">
          {data.overdueCount > 0 && (
            <div className="flex items-center gap-3 py-2">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-[0.875rem] text-foreground">
                <span className="font-semibold">{data.overdueCount}</span> oppfølginger er forfalt
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 py-2">
            <ClipboardList className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-[0.875rem] text-foreground">
              <span className="font-semibold">{data.foresporslerCount}</span> forespørsler
              {data.foresporslerNames.length > 0 && (
                <span className="text-muted-foreground">
                  {" — "}
                  {formatNameList(data.foresporslerNames, data.foresporslerCount)}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3 py-2">
            <Flame className="h-4 w-4 text-[hsl(var(--warning))] flex-shrink-0" />
            <span className="text-[0.875rem] text-foreground">
              <span className="font-semibold">{data.behovNaCount}</span> kontakter har aktivt behov nå
              {data.behovNaNames.length > 0 && (
                <span className="text-muted-foreground">
                  {" — "}
                  {formatNameList(data.behovNaNames, data.behovNaCount)}
                </span>
              )}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Kunne ikke laste data.
        </div>
      )}

      {/* Footer */}
      {timeStr && (
        <div className="flex justify-end mt-3">
          <span className="text-[0.75rem] text-muted-foreground">{timeStr}</span>
        </div>
      )}
    </div>
  );
};

export default DailyBrief;
