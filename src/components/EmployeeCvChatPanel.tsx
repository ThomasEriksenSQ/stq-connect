import { useEffect, useRef, useState } from "react";
import type { HTMLAttributes, LiHTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Bot, Copy, Loader2, RefreshCw, Sparkles, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  profileCount?: number;
  totalEmployees?: number;
};

interface EmployeeCvChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeCount?: number;
}

const EMAIL_SUMMARY_TEMPLATE = `Lag en epost oppsummering av følgende ansatt:

[Skriv ansattnavn her]

Eksempelmal:

Harald
X års erfaring
Bor i X
Norsk statsborger
Kan sikkerhetsklareres
Tilgjengelig: X

Nøkkelpunkter
C, C++
Embedded Systems
Embedded Linux
STM32 / ARM Cortex-M
FreeRTOS
Real-time system
Motor control / FOC
Robotics
Motion control
Control systems
CAN / SPI / UART

Harald er en senior embedded-utvikler med solid erfaring innen C/C++, embedded Linux og firmware. Han har jobbet mye med sikkerhet og kryptografi i embedded systemer, inkludert implementasjon av TrustZone, secure boot/chain-of-trust, secure storage og nøkkelhåndtering, samt beskyttelse mot side-channel- og fault-injection-angrep.`;

const SECTION_HEADINGS = new Set([
  "Beste treff",
  "Belegg",
  "Risiko/mangler",
  "Mulige mangler",
  "Anbefaling",
  "Kort anbefaling",
  "Neste steg",
  "Alternative kandidater",
]);

const LABEL_PREFIXES = [
  "Vurdering",
  "Dokumentert CV/CRM-belegg",
  "Dokumentert belegg",
  "Belegg",
  "Mulig risiko/mangel",
  "Risiko/mangler",
  "Mulige mangler",
  "Anbefaling",
  "Neste steg",
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "ChatGPT svarte ikke akkurat nå.";
}

function stripMarkdownEmphasis(value: string) {
  return value.replace(/\*\*/g, "").replace(/__+/g, "").trim();
}

function isLikelyPersonHeading(line: string, nextLine?: string) {
  const plain = stripMarkdownEmphasis(line).replace(/^\d+\.\s*/, "").trim();
  const nextPlain = stripMarkdownEmphasis(nextLine || "");
  if (!nextPlain || !LABEL_PREFIXES.some((label) => nextPlain.startsWith(`${label}:`) || nextPlain === label)) {
    return false;
  }
  if (plain.length > 52 || /[.:;!?]$/.test(plain)) return false;
  return /^[A-ZÆØÅ][\p{L}'-]+(?:\s+[A-ZÆØÅ][\p{L}'-]+){1,4}$/u.test(plain);
}

function formatAssistantMarkdown(content: string) {
  if (/^#{1,6}\s/m.test(content) || /^\s*[-*]\s/m.test(content) || /^\s*\d+\.\s/m.test(content)) {
    return content.trim();
  }

  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return content.trim();

  const formatted = lines.map((line, index) => {
    if (/^\s{0,3}#{1,6}\s/.test(line) || /^[-*]\s/.test(line)) return line;

    const plain = stripMarkdownEmphasis(line).replace(/:$/, "");
    if (SECTION_HEADINGS.has(plain)) return `## ${plain}`;

    if (isLikelyPersonHeading(line, lines[index + 1])) {
      return `### ${plain.replace(/^\d+\.\s*/, "")}`;
    }

    for (const label of LABEL_PREFIXES) {
      if (line === label || plain === label) return `**${label}**`;
      if (line.startsWith(`${label}:`)) return `**${label}:** ${line.slice(label.length + 1).trim()}`;
    }

    return line;
  });

  return formatted.join("\n\n");
}

const markdownComponents = {
  h2: (props: HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      {...props}
      className={cn(
        "mb-4 mt-6 border-b border-border/70 pb-2 text-[1rem] font-semibold leading-6 text-foreground first:mt-0",
        props.className,
      )}
    />
  ),
  h3: (props: HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      {...props}
      className={cn("mb-2 mt-5 text-[0.9375rem] font-semibold leading-6 text-foreground", props.className)}
    />
  ),
  p: (props: HTMLAttributes<HTMLParagraphElement>) => (
    <p
      {...props}
      className={cn("my-3 text-[0.875rem] leading-7 text-foreground/90 first:mt-0 last:mb-0", props.className)}
    />
  ),
  ul: (props: HTMLAttributes<HTMLUListElement>) => (
    <ul
      {...props}
      className={cn("my-3 list-disc space-y-2 pl-5 text-[0.875rem] leading-7 text-foreground/90", props.className)}
    />
  ),
  ol: (props: HTMLAttributes<HTMLOListElement>) => (
    <ol
      {...props}
      className={cn("my-3 list-decimal space-y-2 pl-5 text-[0.875rem] leading-7 text-foreground/90", props.className)}
    />
  ),
  li: (props: LiHTMLAttributes<HTMLLIElement>) => (
    <li
      {...props}
      className={cn("pl-1 leading-7 marker:text-muted-foreground [&>p]:my-1 [&>ul]:mt-2 [&>ol]:mt-2", props.className)}
    />
  ),
  strong: (props: HTMLAttributes<HTMLElement>) => (
    <strong {...props} className={cn("font-semibold text-foreground", props.className)} />
  ),
  hr: (props: HTMLAttributes<HTMLHRElement>) => (
    <hr {...props} className={cn("my-5 border-border/70", props.className)} />
  ),
};

export function EmployeeCvChatPanel({ open, onOpenChange, employeeCount }: EmployeeCvChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input]);

  const resetChat = () => {
    setMessages([]);
    setInput("");
  };

  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: userText }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("employee-cv-chat", {
        body: {
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data?.text || "Jeg fikk ikke noe tekstsvar tilbake.",
          profileCount: typeof data?.profileCount === "number" ? data.profileCount : undefined,
          totalEmployees: typeof data?.totalEmployees === "number" ? data.totalEmployees : undefined,
        },
      ]);
    } catch (error) {
      const message = getErrorMessage(error);
      setMessages((current) => [...current, { role: "assistant", content: message, error: true }]);
      toast.error("Kunne ikke hente ChatGPT-feedback", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const copyAnswer = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Svar kopiert");
    } catch {
      toast.error("Kunne ikke kopiere svaret");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full flex-col overflow-hidden p-0 sm:max-w-2xl" hideCloseButton={false}>
        <SheetHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="flex items-center gap-2 text-[1rem]">
                <Sparkles className="h-4 w-4 text-primary" />
                Spør AI mot ansattes CVer
              </SheetTitle>
              <SheetDescription className="mt-1 text-[0.8125rem] leading-relaxed">
                Spør om kompetanse, erfaring, match mot konsulentoppdrag eller lag en epostoppsummering basert på CV-grunnlaget.
                {employeeCount ? ` ${employeeCount} aktive/kommende ansatte i listen.` : ""}
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={resetChat}
              disabled={isLoading || messages.length === 0}
              title="Start på nytt"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 px-5 py-5">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setInput(EMAIL_SUMMARY_TEMPLATE)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-[0.8125rem] font-medium transition-colors hover:bg-secondary"
                >
                  Lag en epost-oppsummering av ansatt
                </button>
              </div>
            ) : (
              messages.map((message, index) => {
                const isUser = message.role === "user";
                return (
                  <div key={`${message.role}-${index}`} className={cn("flex gap-3", isUser && "justify-end")}>
                    {!isUser && (
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          message.error ? "bg-destructive/10 text-destructive" : "bg-primary text-primary-foreground",
                        )}
                      >
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "group max-w-[86%] rounded-lg border px-5 py-4 text-sm leading-relaxed",
                        isUser
                          ? "border-primary bg-primary text-primary-foreground"
                          : message.error
                            ? "border-destructive/25 bg-destructive/5 text-destructive"
                            : "border-border bg-card text-card-foreground",
                      )}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <div className="space-y-1">
                          <ReactMarkdown components={markdownComponents}>
                            {formatAssistantMarkdown(message.content)}
                          </ReactMarkdown>
                        </div>
                      )}
                      {!isUser && !message.error && (
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-2 text-[0.6875rem] text-muted-foreground">
                          <span>
                            {message.profileCount && message.totalEmployees
                              ? `Vurderte ${message.profileCount} relevante av ${message.totalEmployees} CV-profiler`
                              : "Basert på CV-data"}
                          </span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                            onClick={() => copyAnswer(message.content)}
                          >
                            <Copy className="h-3 w-3" />
                            Kopier
                          </button>
                        </div>
                      )}
                    </div>
                    {isUser && (
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                        <UserRound className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isLoading && (
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Leser CV-ene og spør ChatGPT...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border bg-background p-4">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Spør om kompetanse eller lim inn en oppdragsbeskrivelse..."
              className="max-h-[132px] min-h-[48px] resize-none rounded-lg text-[0.875rem]"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-lg" disabled={!input.trim() || isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
