import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface Options {
  /** Path to navigate to on left swipe (next tab). */
  next?: string;
  /** Path to navigate to on right swipe (previous tab / special). */
  prev?: string;
  /** Minimum horizontal distance in px to trigger. Default 60. */
  threshold?: number;
  /** Horizontal must exceed vertical by this ratio. Default 1.5. */
  ratio?: number;
  /** Disable when true (e.g. modals open). */
  disabled?: boolean;
}

/**
 * Page-level swipe navigation that respects taps and vertical scrolling.
 * Attached at window level, but ignores gestures that start on
 * interactive elements or inside horizontally scrollable containers.
 */
export function useSwipeNav({ next, prev, threshold = 60, ratio = 1.5, disabled }: Options) {
  const navigate = useNavigate();
  const start = useRef<{ x: number; y: number; t: number; ignore: boolean } | null>(null);

  useEffect(() => {
    if (disabled) return;

    const isInteractive = (el: EventTarget | null): boolean => {
      let n = el as HTMLElement | null;
      while (n && n !== document.body) {
        const tag = n.tagName;
        if (
          tag === "BUTTON" ||
          tag === "A" ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          tag === "VIDEO" ||
          n.getAttribute?.("role") === "button" ||
          n.dataset?.noSwipe === "true"
        ) {
          return true;
        }
        // Inside a horizontally scrollable container? Let it scroll.
        const style = window.getComputedStyle(n);
        if (
          (style.overflowX === "auto" || style.overflowX === "scroll") &&
          n.scrollWidth > n.clientWidth + 4
        ) {
          return true;
        }
        n = n.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        start.current = null;
        return;
      }
      const t = e.touches[0];
      start.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        ignore: isInteractive(e.target),
      };
    };

    const onEnd = (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || s.ignore) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const dt = Date.now() - s.t;
      // Must be intentional horizontal swipe, not a slow drag or vertical scroll
      if (adx < threshold) return;
      if (adx < ady * ratio) return;
      if (dt > 600) return;
      if (dx < 0 && next) navigate(next);
      else if (dx > 0 && prev) navigate(prev);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [navigate, next, prev, threshold, ratio, disabled]);
}
