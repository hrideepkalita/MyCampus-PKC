import { motion } from "framer-motion";
import logo from "@/assets/logo.png";

const SplashScreen = () => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="flex flex-col items-center"
    >
      <img src={logo} alt="MyCampus" className="h-24 w-24 drop-shadow-lg" />
      <h1 className="mt-4 font-display text-2xl font-bold text-foreground drop-shadow-sm">
        MyCampus
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
       Computer Science Department , Pub Kamrup College
      </p>
      <div className="mt-8 h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
    </motion.div>
    <p className="absolute bottom-6 text-xs text-muted-foreground/70">
      Crafted with ❤️ by LuitX
    </p>
  </div>
);

export default SplashScreen;
