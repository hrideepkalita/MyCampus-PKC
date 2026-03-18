import { motion } from "framer-motion";
import { Check } from "lucide-react";
import InterestTag from "./InterestTag";
import type { UserProfile } from "@/lib/mockData";

interface ProfileCardProps {
  profile: UserProfile;
  onLike: () => void;
  onSkip: () => void;
}

const ProfileCard = ({ profile, onLike, onSkip }: ProfileCardProps) => {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: -300, opacity: 0, rotate: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-lg"
    >
      {/* Photo */}
      <div className="relative aspect-[3/4] max-h-[60vh] w-full overflow-hidden">
        <img
          src={profile.photo}
          alt={profile.name}
          className="h-full w-full object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-primary-foreground">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold">
              {profile.name}, {profile.age}
            </h2>
            {profile.verified === "verified" && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                <Check className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm opacity-90">{profile.branch}</p>
          <p className="mt-1 text-sm opacity-80">{profile.bio}</p>

          {/* Interests */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.interests.map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px] font-medium text-primary-foreground backdrop-blur-sm"
              >
                {interest}
              </span>
            ))}
          </div>

          {/* Looking for */}
          <p className="mt-2 text-xs opacity-70">{profile.lookingFor}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-6 py-4 bg-card">
        <button
          onClick={onSkip}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-background text-muted-foreground shadow-sm transition-all active:scale-90 hover:border-destructive hover:text-destructive"
        >
          <span className="text-2xl">✕</span>
        </button>
        <button
          onClick={onLike}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-pink text-primary-foreground shadow-lg transition-all active:scale-90 hover:shadow-xl"
        >
          <span className="text-3xl">❤️</span>
        </button>
      </div>
    </motion.div>
  );
};

export default ProfileCard;
