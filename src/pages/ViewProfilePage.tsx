import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, Instagram, Heart } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  branch: string | null;
  bio: string | null;
  photo_url: string | null;
  photos: string[];
  interests: string[];
  looking_for: string | null;
  verified: string | null;
  is_verified: boolean;
  instagram: string | null;
}

const ViewProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, age, gender, branch, bio, photo_url, photos, interests, looking_for, verified, instagram, is_verified")
      .eq("id", id!)
      .maybeSingle();
    if (data) {
      setProfile({
        ...data,
        photos: (data.photos as string[]) || [],
        interests: (data.interests as string[]) || [],
        is_verified: (data as any).is_verified ?? false,
      });
    }
    setLoading(false);
  };

  const handleLike = async () => {
    if (!user || !profile) return;
    await supabase.from("likes").insert({
      from_user_id: user.id,
      to_user_id: profile.id,
      is_like: true,
    });
    // Create notification
    await supabase.from("notifications").insert({
      user_id: profile.id,
      type: "like",
      title: "Someone liked you!",
      message: "A student liked your profile 💕",
    });
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background">
        <p className="font-display text-lg font-bold text-foreground">Profile not found</p>
        <button onClick={() => navigate(-1)} className="mt-4 rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground">Go Back</button>
      </div>
    );
  }

  const allPhotos = [profile.photo_url, ...profile.photos].filter(Boolean) as string[];

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      {/* Fullscreen photo modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} alt="Full" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
        </div>
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-display text-lg font-bold text-foreground">{profile.name}</h1>
          {profile.is_verified && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
              <Check className="h-3 w-3" /> Verified
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Main photo */}
        <div className="relative aspect-[3/4] max-h-[55vh] w-full overflow-hidden rounded-2xl" onClick={() => profile.photo_url && setSelectedPhoto(profile.photo_url)}>
          <img src={profile.photo_url || "/placeholder.svg"} alt={profile.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-primary-foreground">
            <h2 className="font-display text-2xl font-bold">{profile.name}{profile.age ? `, ${profile.age}` : ""}</h2>
            <p className="text-sm opacity-90">{profile.branch || "No branch"}</p>
          </div>
        </div>

        {/* Additional photos */}
        {profile.photos.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {profile.photos.map((photo, i) => (
              <div key={i} className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl" onClick={() => setSelectedPhoto(photo)}>
                <img src={photo} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div className="mt-4 rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">About</p>
            <p className="text-sm text-foreground">{profile.bio}</p>
          </div>
        )}

        {/* Interests */}
        {profile.interests.length > 0 && (
          <div className="mt-3 rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Interests</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.map((i) => (
                <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{i}</span>
              ))}
            </div>
          </div>
        )}

        {/* Looking for */}
        {profile.looking_for && (
          <div className="mt-3 rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Looking for</p>
            <p className="text-sm font-medium text-foreground">{profile.looking_for}</p>
          </div>
        )}

        {/* Instagram */}
        {profile.instagram && (
          <div className="mt-3 rounded-2xl bg-card p-4 flex items-center gap-2">
            <Instagram className="h-4 w-4 text-secondary" />
            <span className="text-sm text-foreground">{profile.instagram}</span>
          </div>
        )}

        {/* Like button (only for other users) */}
        {user?.id !== profile.id && (
          <button
            onClick={handleLike}
            className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-pink py-3 font-display text-sm font-bold text-primary-foreground transition-all active:scale-[0.98]"
            style={{ backgroundColor: "hsl(var(--pink))" }}
          >
            <Heart className="h-5 w-5" /> Like {profile.name}
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ViewProfilePage;
