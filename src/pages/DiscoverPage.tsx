import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import ProfileCard from "@/components/ProfileCard";
import MatchPopup from "@/components/MatchPopup";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  is_verified: boolean;
  instagram: string | null;
  phone: string | null;
}

const GENDER_FILTERS = ["All", "Male", "Female"] as const;

const DiscoverPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchName, setMatchName] = useState("");
  const [likesLeft, setLikesLeft] = useState(10);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<string>("All");
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchProfiles();
  }, [user, genderFilter]);

  const fetchProfiles = async () => {
    if (!user) return;
    setLoading(true);

    // Only exclude matched users and already-liked users (not skipped)
    const { data: matchRows } = await supabase
      .from("matches")
      .select("user1_id, user2_id")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    const matchedIds = (matchRows || []).map(m =>
      m.user1_id === user.id ? m.user2_id : m.user1_id
    );

    const { data: likedIds } = await supabase
      .from("likes")
      .select("to_user_id")
      .eq("from_user_id", user.id)
      .eq("is_like", true);

    const excludeIds = new Set([user.id, ...matchedIds, ...(likedIds?.map(l => l.to_user_id) || [])]);

    let query = supabase
      .from("profiles")
      .select("*")
      .not("id", "in", `(${[...excludeIds].join(",")})`)
      .not("age", "is", null)
      .limit(50);

    if (genderFilter !== "All") {
      query = query.eq("gender", genderFilter);
    }

    const { data } = await query;
    
    // Filter out temporarily skipped profiles
    const filteredProfiles = (data as Profile[] || []).filter(p => !skippedIds.has(p.id));
    
    setProfiles(filteredProfiles);
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
      // Send notification
      await supabase.from("notifications").insert({
        user_id: profile.id,
        type: "like",
        title: "Someone liked you!",
        message: "A student liked your profile 💕",
      });

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

  const handleSkip = () => {
    if (!profile) return;
    // Only skip temporarily (session only), don't record in database
    setSkippedIds(prev => new Set(prev).add(profile.id));
    nextProfile();
  };

  const nextProfile = () => {
    if (currentIndex + 1 >= profiles.length) {
      // Circular loop — restart from beginning, clear skips
      setSkippedIds(new Set());
      setCurrentIndex(0);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleCardClick = () => {
    if (profile) {
      navigate(`/profile/${profile.id}`);
    }
  };

  const noMoreProfiles = !loading && !profiles.length;

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <TopBar
        title="Discover"
        rightContent={
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {likesLeft} left
          </span>
        }
      />
      {/* Gender filter tabs */}
      <div className="mx-auto flex max-w-md gap-1 px-4 py-2">
        {GENDER_FILTERS.map((g) => (
          <button
            key={g}
            onClick={() => setGenderFilter(g)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors ${
              genderFilter === g
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="px-4 pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : noMoreProfiles ? (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="text-5xl">🎉</span>
            <p className="mt-4 font-display text-lg font-bold text-foreground">No more profiles</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back later for new people!</p>
            <button
              onClick={() => { setSkippedIds(new Set()); fetchProfiles(); }}
              className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground active:scale-[0.98]"
            >
              Refresh Profiles
            </button>
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
                  verified: profile.is_verified ? "verified" : (profile.verified as any) || "unverified",
                  instagram: profile.instagram || undefined,
                  phone: profile.phone || undefined,
                }}
                onLike={handleLike}
                onSkip={handleSkip}
                onCardClick={handleCardClick}
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
