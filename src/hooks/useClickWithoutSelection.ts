import { useRef, useCallback } from "react";

/**
 * Returns mouse handlers that suppress click when the user is selecting text.
 *
 * A "click" is registered only if:
 * - The mouse moved less than `threshold` px between mousedown and click.
 * - There is no non-empty text selection at the time of the click.
 *
 * This lets users drag-select copy text inside elements that are otherwise
 * clickable (e.g. inline-editable fields, activity rows, email rows).
 */
export function useClickWithoutSelection<E extends HTMLElement = HTMLElement>(
  callback: ((event: React.MouseEvent<E>) => void) | undefined,
  options: { threshold?: number } = {},
) {
  const threshold = options.threshold ?? 4;
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent<E>) => {
    startRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onClick = useCallback(
    (e: React.MouseEvent<E>) => {
      if (!callback) return;

      // Suppress if user has actually selected text
      const selection = typeof window !== "undefined" ? window.getSelection() : null;
      const selectedText = selection?.toString() ?? "";
      if (selectedText.length > 0) {
        startRef.current = null;
        return;
      }

      // Suppress if the mouse traveled too far between down and up
      const start = startRef.current;
      startRef.current = null;
      if (start) {
        const dx = Math.abs(e.clientX - start.x);
        const dy = Math.abs(e.clientY - start.y);
        if (dx > threshold || dy > threshold) return;
      }

      callback(e);
    },
    [callback, threshold],
  );

  return { onMouseDown, onClick };
}

/**
 * Convenience: keyboard activation handler for elements converted from
 * <button> to <span role="button"> / <div role="button">. Calls the
 * callback on Enter or Space.
 */
export function activateOnEnterOrSpace(callback: (() => void) | undefined) {
  return (e: React.KeyboardEvent) => {
    if (!callback) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      callback();
    }
  };
}
