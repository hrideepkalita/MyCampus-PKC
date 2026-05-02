import { useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PanInfo } from "framer-motion";

interface Options {
  /** Path to navigate to on left swipe (next tab). */
  next?: string;
  /** Path to navigate to on right swipe (previous tab / special). */
  prev?: string;
  /** Minimum horizontal distance in px to trigger. Default 50. */
  threshold?: number;
  /** Minimum velocity to trigger on fast swipes. Default 300. */
  velocityThreshold?: number;
  /** Disable when true (e.g. modals open). */
  disabled?: boolean;
}

/**
 * Framer Motion–based swipe navigation hook.
 *
 * Returns `onPanEnd` handler to attach to a `<motion.div>` wrapping
 * the page content. Works over videos, images and all media.
 *
 * Uses both distance threshold AND velocity detection so fast flicks
 * and slow deliberate swipes both register.
 *
 * Vertical scrolling is preserved via CSS `touch-action: pan-y`.
 */
export function useSwipeNav({
  next,
  prev,
  threshold = 50,
  velocityThreshold = 300,
  disabled,
}: Options) {
  const navigate = useNavigate();
  const startTarget = useRef<EventTarget | null>(null);

  /** Check if the pan started on an interactive element we should skip */
  const isInteractive = (el: EventTarget | null): boolean => {
    let n = el as HTMLElement | null;
    while (n && n !== document.body) {
      const tag = n.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        n.dataset?.noSwipe === "true"
      ) {
        return true;
      }
      // Inside a horizontally scrollable container → let it scroll
      if (
        (n.scrollWidth > n.clientWidth + 4) &&
        n.clientWidth > 0
      ) {
        const style = window.getComputedStyle(n);
        if (style.overflowX === "auto" || style.overflowX === "scroll") {
          return true;
        }
      }
      n = n.parentElement;
    }
    return false;
  };

  const onPanStart = useCallback(
    (event: PointerEvent | MouseEvent | TouchEvent) => {
      startTarget.current = event.target;
    },
    [],
  );

  const onPanEnd = useCallback(
    (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      if (disabled) return;
      if (isInteractive(startTarget.current)) return;

      const { offset, velocity } = info;
      const absX = Math.abs(offset.x);
      const absY = Math.abs(offset.y);

      // Must be primarily horizontal
      if (absY > absX * 1.2) return;

      // Accept swipe if distance OR velocity is met
      const distanceMet = absX > threshold;
      const velocityMet = Math.abs(velocity.x) > velocityThreshold;

      if (!distanceMet && !velocityMet) return;

      if (offset.x < 0 && next) {
        navigate(next);
      } else if (offset.x > 0 && prev) {
        navigate(prev);
      }
    },
    [navigate, next, prev, threshold, velocityThreshold, disabled],
  );

  return { onPanStart, onPanEnd };
}
