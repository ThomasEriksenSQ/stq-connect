import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Newspaper, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useDesignVersion } from "@/context/DesignVersionContext";
import { useAuth } from "@/hooks/useAuth";
import { useNewsDailyDigest } from "@/hooks/useNewsDailyDigest";
import { newsRelative } from "@/lib/news";

function readStorageFlag(key: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    return Boolean(window.localStorage.getItem(key));
  } catch {
    return false;
  }
}

function writeStorageFlag(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, new Date().toISOString());
  } catch {
    // Ignore storage errors and keep dismissal in component state
  }
}

function getDismissStorageKey(userId: string | undefined, dateKey: string): string {
  return `news-badge-dismissed:${userId ?? "anonymous"}:${dateKey}`;
}

export function GlobalNewsBadge() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isV2Active } = useDesignVersion();
  const { dateKey, latestItem, row } = useNewsDailyDigest();

  const dismissStorageKey = useMemo(
    () => getDismissStorageKey(user?.id, dateKey),
    [dateKey, user?.id],
  );
  const [dismissed, setDismissed] = useState(() => readStorageFlag(dismissStorageKey));
  const targetPath = isV2Active ? "/" : "/design-lab/news";
  const onNewsPage = location.pathname === "/design-lab/news" || (isV2Active && location.pathname === "/");

  useEffect(() => {
    setDismissed(readStorageFlag(dismissStorageKey));
  }, [dismissStorageKey]);

  useEffect(() => {
    if (!latestItem || !onNewsPage) return;

    writeStorageFlag(dismissStorageKey);
    setDismissed(true);
  }, [dismissStorageKey, latestItem, onNewsPage]);

  if (!user || !latestItem || row?.status !== "ok" || dismissed || onNewsPage) return null;

  const handleDismiss = () => {
    writeStorageFlag(dismissStorageKey);
    setDismissed(true);
  };

  const handleOpenNews = () => {
    writeStorageFlag(dismissStorageKey);
    setDismissed(true);
    navigate(targetPath);
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] w-[min(calc(100vw-2rem),24rem)] sm:bottom-5 sm:right-5">
      <section className="pointer-events-auto rounded-2xl border border-border/80 bg-card/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
            <Newspaper className="h-4 w-4 stroke-[2]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Nyhet i dag
                </p>
                <button
                  type="button"
                  onClick={handleOpenNews}
                  className="mt-1 block text-left text-sm font-semibold leading-5 text-foreground transition-colors hover:text-primary"
                >
                  <span className="line-clamp-2">{latestItem.title}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Lukk nyhetsbadge"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {latestItem.primary_company_name} · {latestItem.source} · {newsRelative(latestItem.published_at)}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenNews}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                Åpne nyheter
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Lukk for i dag
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
