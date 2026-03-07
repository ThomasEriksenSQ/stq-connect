import { AlertCircle, ClipboardList, Flame, Sparkles } from "lucide-react";

const DailyBrief = () => {
  return (
    <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
      <div className="flex">
        <div className="w-1 bg-primary flex-shrink-0" />
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-[1.25rem] font-bold text-foreground">God morgen, Thomas 👋</h2>
            <span className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              AI-generert
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-[0.875rem]">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-foreground">
                <span className="font-semibold text-destructive">2 oppfølginger</span> er forfalt
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[0.875rem]">
              <ClipboardList className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-foreground">
                <span className="font-semibold">3 forespørsler</span> — Kongsberg KDA, Six Robotics, Thales
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[0.875rem]">
              <Flame className="h-4 w-4 text-[hsl(var(--warning))] flex-shrink-0" />
              <span className="text-foreground">
                <span className="font-semibold">4 kontakter</span> har aktivt behov nå — Eirik Klette, Mathias Nedrebø +
                2 til
              </span>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <span className="text-[0.75rem] text-muted-foreground">Oppdatert i dag kl. 08:00</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyBrief;
