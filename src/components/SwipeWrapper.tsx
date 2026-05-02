import { motion } from "framer-motion";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  next?: string;
  prev?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Wraps a page in a Framer Motion pan handler for swipe navigation.
 * Uses `touch-action: pan-y` so vertical scroll works normally.
 * Buttons, links, and videos remain fully clickable.
 */
const SwipeWrapper = ({ children, next, prev, disabled, className = "" }: Props) => {
  const { onPanStart, onPanEnd } = useSwipeNav({ next, prev, disabled });

  return (
    <motion.div
      onPanStart={onPanStart}
      onPanEnd={onPanEnd}
      style={{ touchAction: "pan-y" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default SwipeWrapper;
