import { useNavigate } from "react-router-dom";
import { cn, getInitials } from "@/lib/utils";
import { Radio, ChevronDown, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SIGNAL_OPTIONS, getSignalBadge } from "@/lib/categoryUtils";
import { TEMP_CONFIG } from "@/lib/heatScore";
import { relativeDate } from "@/lib/relativeDate";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import { getAvatarColor, getHeatBarColor } from "./types";
import type { ContactRow, SortField, SortDir } from "./types";

interface Props {
  contacts: ContactRow[];
  hotListActive: boolean;
  sort: { field: SortField; dir: SortDir };
  onToggleSort: (field: SortField) => void;
  onToggle: (contact: ContactRow, field: "cv_email" | "call_list", newValue: boolean) => void;
  onSetSignal: (contactId: string, companyId: string | null, label: string) => void;
}

export function ContactTable({ contacts, hotListActive, sort, onToggleSort, onToggle, onSetSignal }: Props) {
  const navigate = useNavigate();

  const SortHeader = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => onToggleSort(field)}
      className={cn(
        "flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sort.field === field ? "text-foreground" : "text-muted-foreground/20"}`} />
    </button>
  );

  return (
    <>
      {/* Mobile */}
      <div className="space-y-2 md:hidden">
        {contacts.map((contact) => {
          const name = `${contact.first_name} ${contact.last_name}`;
          const companyName = contact.companies?.name;
          const signal = contact.signal;
          const signalBadge = getSignalBadge(signal);

          return (
            <button
              key={contact.id}
              type="button"
              onClick={() => navigate(`/kontakter/${contact.id}`)}
              style={{ borderLeft: `3px solid ${hotListActive ? getHeatBarColor(contact.temperature) : "transparent"}` }}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-card"
            >
              <div className="flex items-center gap-2.5">
                <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full text-[0.6875rem] font-semibold shrink-0", getAvatarColor(name))}>
                  {getInitials(name)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.8125rem] font-medium text-foreground truncate">{name}</span>
                    {hotListActive && contact.needsReview && <span className="text-[0.6875rem]" title="Trenger oppfølging">⚠</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {companyName && <span className="text-[0.75rem] text-muted-foreground truncate">{companyName}</span>}
                    {contact.title && companyName && <span className="text-[0.75rem] text-muted-foreground">·</span>}
                    {contact.title && <span className="text-[0.75rem] text-muted-foreground truncate">{contact.title}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2 ml-[42px]">
                {signalBadge && (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold ${signalBadge.badgeColor}`}>
                    {signal}
                  </span>
                )}
                {contact.hasMarkedsradar && <Radio className="h-3 w-3 text-blue-500" />}
                {contact.cv_email && (
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium border",
                    contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned")
                      ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-100 text-blue-800 border-blue-200",
                  )}>
                    {contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned") ? "CV ✗" : "CV"}
                  </span>
                )}
                {contact.call_list && (
                  <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[0.625rem] font-medium">Innkjøper</span>
                )}
                {contact.lastActivity && (
                  <span className="ml-auto text-[0.6875rem] text-muted-foreground">{relativeDate(contact.lastActivity)}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop - Stacked rows */}
      <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card shadow-card">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
          <div className="w-8 shrink-0" />
          <div className="flex-[2] min-w-0">
            <SortHeader field="name">Navn</SortHeader>
          </div>
          <div className="flex-[1.5] min-w-0">
            <SortHeader field="company">Selskap</SortHeader>
          </div>
          <div className="w-[140px] shrink-0">
            <SortHeader field="signal">Signal</SortHeader>
          </div>
          <div className="w-[120px] shrink-0 text-right">
            <SortHeader field="last_activity" className="justify-end">Siste akt.</SortHeader>
          </div>
        </div>
        <div className="divide-y divide-border">
          {contacts.map((contact) => {
            const name = `${contact.first_name} ${contact.last_name}`;
            const companyName = contact.companies?.name;
            const signal = contact.signal;
            const signalBadge = getSignalBadge(signal);

            return (
              <div
                key={contact.id}
                style={{ borderLeft: `3px solid ${hotListActive ? getHeatBarColor(contact.temperature) : "transparent"}` }}
                className="flex items-center gap-3 pl-3 pr-4 min-h-[52px] py-2 hover:bg-background/80 transition-colors duration-75 group"
              >
                {/* Avatar */}
                <button
                  onClick={() => navigate(`/kontakter/${contact.id}`)}
                  className={cn("h-8 w-8 rounded-full flex items-center justify-center text-[0.6875rem] font-semibold shrink-0 cursor-pointer", getAvatarColor(name))}
                >
                  {getInitials(name)}
                </button>

                {/* Name + Title */}
                <button
                  onClick={() => navigate(`/kontakter/${contact.id}`)}
                  className="flex-[2] min-w-0 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.8125rem] font-medium text-foreground truncate">{name}</span>
                    {hotListActive && contact.needsReview && <span className="text-[0.6875rem]" title="Trenger oppfølging">⚠</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[0.75rem] text-muted-foreground truncate">{contact.title || ""}</span>
                    {contact.hasMarkedsradar && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Radio className="h-3 w-3 text-blue-500 shrink-0 cursor-default" />
                        </TooltipTrigger>
                        <TooltipContent>Selskapet har annonsert etter embedded på Finn.no siste 90 dager</TooltipContent>
                      </Tooltip>
                    )}
                    {/* Tags */}
                    <div className="flex gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          if (contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned")) {
                            toast.info("Kontakten har avmeldt seg via Mailchimp og kan ikke re-abonneres.");
                            return;
                          }
                          onToggle(contact, "cv_email", !contact.cv_email);
                        }}
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium border cursor-pointer",
                          contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned")
                            ? "bg-red-50 text-red-700 border-red-200"
                            : contact.cv_email
                              ? "bg-blue-100 text-blue-800 border-blue-200"
                              : "border-border text-muted-foreground/40 hover:text-muted-foreground hover:border-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity",
                        )}
                      >
                        {contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned") ? "CV ✗" : "CV"}
                      </button>
                      <button
                        onClick={() => onToggle(contact, "call_list", !contact.call_list)}
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium border cursor-pointer",
                          contact.call_list
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "border-border text-muted-foreground/40 hover:text-muted-foreground hover:border-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity",
                        )}
                      >
                        Innkjøper
                      </button>
                    </div>
                  </div>
                </button>

                {/* Company */}
                <button
                  onClick={() => navigate(`/kontakter/${contact.id}`)}
                  className="flex-[1.5] min-w-0 text-left cursor-pointer"
                >
                  <span className="text-[0.8125rem] text-muted-foreground truncate block">{companyName || ""}</span>
                </button>

                {/* Signal */}
                <div className="w-[140px] shrink-0" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {signalBadge ? (
                        <button className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${signalBadge.badgeColor}`}>
                          {signal}
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </button>
                      ) : (
                        <button className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-[0.6875rem] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
                          + Signal
                        </button>
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {SIGNAL_OPTIONS.map((s) => (
                        <DropdownMenuItem key={s.label} onClick={() => onSetSignal(contact.id, contact.company_id, s.label)}>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${s.badgeColor}`}>{s.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Last activity */}
                <span className="w-[120px] shrink-0 text-[0.75rem] text-muted-foreground text-right">
                  {contact.lastActivity ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>{relativeDate(contact.lastActivity)}</span>
                      </TooltipTrigger>
                      <TooltipContent>{format(new Date(contact.lastActivity), "d. MMMM yyyy", { locale: nb })}</TooltipContent>
                    </Tooltip>
                  ) : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
