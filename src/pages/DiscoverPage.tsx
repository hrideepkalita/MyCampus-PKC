import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import ProfileCard from "@/components/ProfileCard";
import MatchPopup from "@/components/MatchPopup";
import BottomNav from "@/components/BottomNav";
import { mockProfiles } from "@/lib/mockData";
import { Sparkles, Eye } from "lucide-react";

const DiscoverPage = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchName, setMatchName] = useState("");
  const [likesLeft, setLikesLeft] = useState(10);

  const profile = mockProfiles[currentIndex];

  const handleLike = () => {
    if (likesLeft <= 0) return;
    setLikesLeft((p) => p - 1);
    
    // 50% match chance for demo
    if (Math.random() > 0.5) {
      setMatchName(profile.name);
      setShowMatch(true);
    } else {
      nextProfile();
    }
  };

  const handleSkip = () => nextProfile();

  const nextProfile = () => {
    setCurrentIndex((prev) => (prev + 1) % mockProfiles.length);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="font-display text-lg font-bold text-foreground">Discover</h1>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Eye className="h-3.5 w-3.5 text-pink" />
              Someone liked you 👀
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {likesLeft} left
            </span>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {profile && (
            <ProfileCard
              key={profile.id + currentIndex}
              profile={profile}
              onLike={handleLike}
              onSkip={handleSkip}
            />
          )}
        </AnimatePresence>

        {likesLeft <= 0 && (
          <div className="mt-4 rounded-2xl bg-card p-4 text-center">
            <p className="font-display text-sm font-bold text-foreground">Daily limit reached! 🕐</p>
            <p className="mt-1 text-xs text-muted-foreground">Come back tomorrow for more likes</p>
          </div>
        )}
      </div>

      {/* Top Profiles */}
      <div className="mx-auto mt-6 max-w-sm px-4">
        <h3 className="font-display text-sm font-bold text-foreground mb-3">🔥 Top Profiles Today</h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {mockProfiles.slice(0, 3).map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-1.5 min-w-[70px]">
              <div className="h-14 w-14 overflow-hidden rounded-full ring-2 ring-pink ring-offset-2 ring-offset-background">
                <img src={p.photo} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <span className="text-[10px] font-medium text-foreground text-center leading-tight">{p.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      <MatchPopup
        show={showMatch}
        name={matchName}
        onClose={() => {
          setShowMatch(false);
          nextProfile();
        }}
      />
      <BottomNav />
    </div>
  );
};

export default DiscoverPage;
