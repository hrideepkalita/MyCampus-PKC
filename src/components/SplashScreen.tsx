import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import luitxLogo from "@/assets/luitx-logo.png";

const SplashScreen = () => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black px-6 py-16">
    <div className="flex-1" />
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="flex flex-col items-center"
    >
      <div className="flex h-36 w-36 items-center justify-center rounded-[2rem] bg-white shadow-xl">
        <img src={logo} alt="MyCampus" className="h-28 w-28 object-contain" />
      </div>
      <h1 className="mt-8 font-display text-4xl font-bold text-white">
        MyCampus
      </h1>
      <p className="mt-3 text-sm text-white/60 text-center leading-relaxed">
       <br/>Pub Kamrup College
      </p>
    </motion.div>
    <div className="flex flex-1 flex-col items-center justify-end">
      <p className="text-xs text-white/80">
        Crafted with <span className="text-red-500">❤️</span> by
      </p>
      <img src={luitxLogo} alt="LuitX" className="mt-2 h-12 object-contain" />
    </div>
  </div>
);

export default SplashScreen;
