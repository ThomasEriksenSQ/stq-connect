import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

const EVENT_NAME = "lov:persistent-state";

function readValue<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") return initialValue;
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? initialValue : (JSON.parse(stored) as T);
  } catch {
    return initialValue;
  }
}

export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readValue(key, initialValue));

  // Persist to localStorage and broadcast to other hook instances in same tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: { key, value } }),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [key, value]);

  // Sync with other tabs (storage event) and other hook instances (custom event).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        const next = e.newValue === null ? initialValue : (JSON.parse(e.newValue) as T);
        setValue(next);
      } catch {
        // Ignore parse failures.
      }
    };

    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string; value: T }>).detail;
      if (!detail || detail.key !== key) return;
      setValue((prev) => (Object.is(prev, detail.value) ? prev : detail.value));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(EVENT_NAME, handleCustom as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(EVENT_NAME, handleCustom as EventListener);
    };
  }, [key]);

  return [value, setValue];
}
