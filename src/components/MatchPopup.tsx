import { motion, AnimatePresence } from "framer-motion";

interface MatchPopupProps {
  show: boolean;
  name: string;
  onClose: () => void;
}

const MatchPopup = ({ show, name, onClose }: MatchPopupProps) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="mx-6 flex flex-col items-center rounded-3xl bg-background p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-6xl">🎉</span>
            <h2 className="mt-4 font-display text-2xl font-bold text-foreground">
              It's a Match!
            </h2>
            <p className="mt-2 text-center text-muted-foreground">
              You and <span className="font-semibold text-pink">{name}</span> liked each other!
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-full bg-primary px-8 py-2.5 font-display text-sm font-bold text-primary-foreground transition-all active:scale-95"
            >
              Keep Swiping
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MatchPopup;
