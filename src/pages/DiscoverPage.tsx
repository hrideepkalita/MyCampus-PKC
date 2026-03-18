import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import ProfileCard from "@/components/ProfileCard";
import MatchPopup from "@/components/MatchPopup";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Eye } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  branch: string | null;
  bio: string | null;
  photo_url: string | null;
  interests: string[];
  looking_for: string | null;
  verified: string | null;
  instagram: string | null;
  phone: string | null;
}

const GENDER_FILTERS = ["All", "Male", "Female"] as const;

const DiscoverPage = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchName, setMatchName] = useState("");
  const [likesLeft, setLikesLeft] = useState(10);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<string>("All");

  useEffect(() => {
    fetchProfiles();
  }, [user, genderFilter]);

  const fetchProfiles = async () => {
    if (!user) return;
    setLoading(true);
    
    const { data: likedIds } = await supabase
      .from("likes")
      .select("to_user_id")
      .eq("from_user_id", user.id);

    const excludeIds = [user.id, ...(likedIds?.map(l => l.to_user_id) || [])];

    let query = supabase
      .from("profiles")
      .select("*")
      .not("id", "in", `(${excludeIds.join(",")})`)
      .not("age", "is", null)
      .limit(50);

    if (genderFilter !== "All") {
      query = query.eq("gender", genderFilter);
    }

    const { data } = await query;

    setProfiles((data as Profile[]) || []);
    setCurrentIndex(0);
    setLoading(false);
  };

  const profile = profiles[currentIndex];

  const handleLike = async () => {
    if (!user || !profile || likesLeft <= 0) return;
    setLikesLeft((p) => p - 1);

    const { error } = await supabase.from("likes").insert({
      from_user_id: user.id,
      to_user_id: profile.id,
      is_like: true,
    });

    if (!error) {
      // Check if match was created
      const { data: match } = await supabase
        .from("matches")
        .select("id")
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (match) {
        setMatchName(profile.name);
        setShowMatch(true);
      } else {
        nextProfile();
      }
    }
  };

  const handleSkip = async () => {
    if (!user || !profile) return;
    await supabase.from("likes").insert({
      from_user_id: user.id,
      to_user_id: profile.id,
      is_like: false,
    });
    nextProfile();
  };

  const nextProfile = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  const noMoreProfiles = !loading && (!profiles.length || currentIndex >= profiles.length);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="font-display text-lg font-bold text-foreground">Discover</h1>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {likesLeft} left
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : noMoreProfiles ? (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="text-5xl">🎉</span>
            <p className="mt-4 font-display text-lg font-bold text-foreground">No more profiles</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back later for new people!</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {profile && (
              <ProfileCard
                key={profile.id}
                profile={{
                  id: profile.id,
                  name: profile.name,
                  age: profile.age || 0,
                  gender: (profile.gender as any) || "Other",
                  branch: profile.branch || "",
                  bio: profile.bio || "",
                  photo: profile.photo_url || "/placeholder.svg",
                  interests: profile.interests as any[],
                  lookingFor: (profile.looking_for as any) || "Not sure 🤷",
                  verified: (profile.verified as any) || "unverified",
                  instagram: profile.instagram || undefined,
                  phone: profile.phone || undefined,
                }}
                onLike={handleLike}
                onSkip={handleSkip}
              />
            )}
          </AnimatePresence>
        )}

        {likesLeft <= 0 && (
          <div className="mt-4 rounded-2xl bg-card p-4 text-center">
            <p className="font-display text-sm font-bold text-foreground">Daily limit reached! 🕐</p>
            <p className="mt-1 text-xs text-muted-foreground">Come back tomorrow for more likes</p>
          </div>
        )}
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
