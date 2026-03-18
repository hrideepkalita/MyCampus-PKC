import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Heart {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

const HEART_CHARS = ["♥", "♡", "💕", "💗"];

const FloatingHearts = ({ count = 12 }: { count?: number }) => {
  const [hearts, setHearts] = useState<Heart[]>([]);

  useEffect(() => {
    const generated: Heart[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 20 + Math.random() * 28,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 6,
      opacity: 0.1 + Math.random() * 0.15,
    }));
    setHearts(generated);
  }, [count]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {hearts.map((heart) => (
        <motion.span
          key={heart.id}
          className="absolute text-pink select-none"
          style={{
            left: `${heart.x}%`,
            fontSize: `${heart.size}px`,
            opacity: heart.opacity,
            color: `hsl(var(--pink))`,
          }}
          initial={{ y: "110vh", rotate: 0 }}
          animate={{
            y: "-10vh",
            rotate: [0, 15, -15, 10, -10, 0],
            x: [0, 20, -20, 10, -10, 0],
          }}
          transition={{
            y: { duration: heart.duration, repeat: Infinity, delay: heart.delay, ease: "linear" },
            rotate: { duration: heart.duration * 0.6, repeat: Infinity, delay: heart.delay, ease: "easeInOut" },
            x: { duration: heart.duration * 0.8, repeat: Infinity, delay: heart.delay, ease: "easeInOut" },
          }}
        >
          {HEART_CHARS[heart.id % HEART_CHARS.length]}
        </motion.span>
      ))}
    </div>
  );
};

export default FloatingHearts;
