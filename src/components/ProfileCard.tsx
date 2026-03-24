import { motion } from "framer-motion";
import type { UserProfile } from "@/lib/mockData";
import verifiedBadge from "@/assets/verified-badge.png";

interface ProfileCardProps {
  profile: UserProfile;
  onLike: () => void;
  onSkip: () => void;
  onCardClick?: () => void;
}

const ProfileCard = ({ profile, onLike, onSkip, onCardClick }: ProfileCardProps) => {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: -300, opacity: 0, rotate: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-lg"
    >
      {/* Photo - clickable to open profile */}
      <div
        className="relative aspect-[3/4] max-h-[60vh] w-full overflow-hidden cursor-pointer"
        onClick={onCardClick}
      >
        <img
          src={profile.photo}
          alt={profile.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-white drop-shadow-lg">
              {profile.name}, {profile.age}
            </h2>
            {profile.verified === "verified" && (
              <img src={verifiedBadge} alt="Verified" className="h-[25px] w-[25px]" />
            )}
          </div>
          <p className="mt-0.5 text-sm text-white/90 drop-shadow">{profile.branch}</p>
          <p className="mt-1 text-sm text-white/80 drop-shadow">{profile.bio}</p>

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
          style={{ backgroundColor: "hsl(var(--pink))" }}
        >
          <span className="text-3xl">❤️</span>
        </button>
      </div>
    </motion.div>
  );
};

export default ProfileCard;
