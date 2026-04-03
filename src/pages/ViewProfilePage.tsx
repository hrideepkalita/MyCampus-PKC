import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Instagram, Heart, UserPlus, UserCheck, Camera, Shield, UserPlus2, Send } from "lucide-react";
import DefaultAvatar from "@/components/DefaultAvatar";
import { toast } from "sonner";
import verifiedBadge from "@/assets/verified-badge.png";
import FollowersModal from "@/components/FollowersModal";
import PhotoGallery from "@/components/PhotoGallery";
import AddPhotoModal from "@/components/AddPhotoModal";

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

interface GalleryPhoto {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  like_count: number;
  user_liked: boolean;
}

const ViewProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [theyFollowMe, setTheyFollowMe] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mutualText, setMutualText] = useState("");
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const [friendRequestStatus, setFriendRequestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchProfile();
    fetchGalleryPhotos();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    checkLiked();
    checkFollowing();
    checkTheyFollowMe();
    fetchFollowCounts();
    fetchMutuals();
    trackProfileView();
    checkFriendRequest();
  }, [user, id]);

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

  const fetchGalleryPhotos = useCallback(async () => {
    if (!id) return;
    const { data: photos } = await supabase
      .from("profile_photos")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!photos || photos.length === 0) {
      setGalleryPhotos([]);
      return;
    }

    const photoIds = photos.map((p: any) => p.id);
    const [{ data: likeCounts }, { data: userLikes }] = await Promise.all([
      supabase.from("photo_likes").select("photo_id").in("photo_id", photoIds),
      user
        ? supabase.from("photo_likes").select("photo_id").in("photo_id", photoIds).eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);

    const countMap: Record<string, number> = {};
    (likeCounts || []).forEach((l: any) => {
      countMap[l.photo_id] = (countMap[l.photo_id] || 0) + 1;
    });
    const userLikedSet = new Set((userLikes || []).map((l: any) => l.photo_id));

    setGalleryPhotos(
      photos.map((p: any) => ({
        ...p,
        like_count: countMap[p.id] || 0,
        user_liked: userLikedSet.has(p.id),
      }))
    );
  }, [id, user]);

  const trackProfileView = async () => {
    if (!user || !id || user.id === id) return;

    // Spam control: max 1 view notification per 24h per viewer per viewed
    const twentyFourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("profile_views")
      .select("id")
      .eq("viewer_id", user.id)
      .eq("viewed_user_id", id)
      .gte("created_at", twentyFourAgo)
      .limit(1);

    if (recent && recent.length > 0) return;

    await supabase.from("profile_views").insert({ viewer_id: user.id, viewed_user_id: id });

    // Get viewer's branch for anonymous notification
    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("branch")
      .eq("id", user.id)
      .single();

    const dept = viewerProfile?.branch || "your college";
    await supabase.from("notifications").insert({
      user_id: id,
      type: "profile_view",
      title: "Profile View",
      message: `Someone from ${dept} viewed your profile 👀`,
      related_id: null,
    });
  };

  const checkLiked = async () => {
    const { data } = await supabase
      .from("likes")
      .select("id")
      .eq("from_user_id", user!.id)
      .eq("to_user_id", id!)
      .eq("is_like", true)
      .maybeSingle();
    setHasLiked(!!data);
  };

  const checkFollowing = async () => {
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user!.id)
      .eq("following_id", id!)
      .maybeSingle();
    setIsFollowing(!!data);
  };

  const checkTheyFollowMe = async () => {
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", id!)
      .eq("following_id", user!.id)
      .maybeSingle();
    setTheyFollowMe(!!data);
  };

  const fetchFollowCounts = async () => {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", id!),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", id!),
    ]);
    setFollowersCount(followers || 0);
    setFollowingCount(following || 0);
  };

  const fetchMutuals = async () => {
    if (!user || !id || user.id === id) return;
    const { data: myFollowing } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    const { data: theirFollowers } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", id);

    const mySet = new Set((myFollowing || []).map(f => f.following_id));
    const mutualIds = (theirFollowers || [])
      .map(f => f.follower_id)
      .filter(fid => mySet.has(fid) && fid !== user.id);

    if (mutualIds.length === 0) { setMutualText(""); return; }

    const { data: mutualProfiles } = await supabase
      .from("profiles")
      .select("name")
      .in("id", mutualIds.slice(0, 2));

    const names = (mutualProfiles || []).map(p => p.name);
    const remaining = mutualIds.length - names.length;

    if (names.length === 1 && remaining === 0) {
      setMutualText(`Followed by ${names[0]}`);
    } else if (names.length === 1 && remaining > 0) {
      setMutualText(`Followed by ${names[0]} and ${remaining} other${remaining > 1 ? "s" : ""}`);
    } else if (names.length >= 2 && remaining === 0) {
      setMutualText(`Followed by ${names[0]} and ${names[1]}`);
    } else {
      setMutualText(`Followed by ${names[0]}, ${names[1]} and ${remaining} other${remaining > 1 ? "s" : ""}`);
    }
  };

  const handleLike = async () => {
    if (!user || !profile || hasLiked) return;
    await supabase.from("likes").insert({
      from_user_id: user.id,
      to_user_id: profile.id,
      is_like: true,
    });
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();
    const myName = myProfile?.name || "Someone";
    await supabase.from("notifications").insert({
      user_id: profile.id,
      type: "like",
      title: `${myName} liked your profile!`,
      message: `${myName} liked your profile 💕`,
      related_id: user.id,
    });
    setHasLiked(true);
  };

  const handleFollowToggle = async () => {
    if (!user || !profile) return;
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
      setIsFollowing(false);
      setFollowersCount(c => c - 1);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
      setIsFollowing(true);
      setFollowersCount(c => c + 1);
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();
      const myName = myProfile?.name || "Someone";
      await supabase.from("notifications").insert({
        user_id: profile.id,
        type: "follow",
        title: `${myName} followed you!`,
        message: `${myName} started following you 👋`,
        related_id: user.id,
      });
    }
  };

  const getFollowLabel = () => {
    if (isFollowing) return "Following";
    if (theyFollowMe) return "Follow Back";
    return "Follow";
  };

  const handleInstagramClick = () => {
    if (!profile?.instagram) return;
    const handle = profile.instagram.replace(/^@/, "");
    window.open(`https://instagram.com/${handle}`, "_blank");
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

  const isOwnProfile = user?.id === profile.id;

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      {/* Fullscreen photo modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} alt="Full" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
        </div>
      )}

      {/* Followers/Following modal - only for own profile */}
      {followModal && isOwnProfile && (
        <FollowersModal profileId={profile.id} type={followModal} onClose={() => setFollowModal(null)} />
      )}

      {/* Add Photo modal */}
      {showAddPhoto && (
        <AddPhotoModal
          currentCount={galleryPhotos.length}
          onClose={() => setShowAddPhoto(false)}
          onAdded={fetchGalleryPhotos}
        />
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-display text-lg font-bold text-foreground">{profile.name}</h1>
          {profile.is_verified && (
            <img src={verifiedBadge} alt="Verified" className="h-[25px] w-[25px] object-contain" />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Main photo with dark gradient */}
        <div className="relative aspect-[3/4] max-h-[55vh] w-full overflow-hidden rounded-2xl" onClick={() => profile.photo_url && setSelectedPhoto(profile.photo_url)}>
          <img src={profile.photo_url || "/placeholder.svg"} alt={profile.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <h2 className="font-display text-2xl font-bold text-white drop-shadow-lg">{profile.name}{profile.age ? `, ${profile.age}` : ""}</h2>
            <p className="text-sm text-white/90 drop-shadow">{profile.branch || "No branch"}</p>
          </div>
        </div>

        {/* Follow counts - only clickable on own profile */}
        <div className="mt-3 flex items-center justify-center gap-6">
          {isOwnProfile ? (
            <button onClick={() => setFollowModal("followers")} className="text-center transition-opacity active:opacity-70">
              <p className="font-display text-lg font-bold text-foreground">{followersCount}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </button>
          ) : (
            <div className="text-center">
              <p className="font-display text-lg font-bold text-foreground">{followersCount}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
          )}
          <div className="h-8 w-px bg-border" />
          {isOwnProfile ? (
            <button onClick={() => setFollowModal("following")} className="text-center transition-opacity active:opacity-70">
              <p className="font-display text-lg font-bold text-foreground">{followingCount}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </button>
          ) : (
            <div className="text-center">
              <p className="font-display text-lg font-bold text-foreground">{followingCount}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
          )}
        </div>

        {/* Mutual text */}
        {mutualText && (
          <p className="mt-2 text-center text-xs text-muted-foreground">{mutualText}</p>
        )}

        {/* Follow button (other users only) */}
        {!isOwnProfile && (
          <button
            onClick={handleFollowToggle}
            className={`mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-[0.98] ${
              isFollowing
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {getFollowLabel()}
          </button>
        )}

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

        {/* Photo Gallery */}
        <PhotoGallery photos={galleryPhotos} onPhotoLiked={fetchGalleryPhotos} ownerName={profile.name} />

        {/* Add Photo button (own profile only) */}
        {isOwnProfile && galleryPhotos.length < 5 && (
          <button
            onClick={() => setShowAddPhoto(true)}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Camera className="h-4 w-4" /> Add Gallery Photo ({galleryPhotos.length}/5)
          </button>
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

        {/* Instagram - CLICKABLE */}
        {profile.instagram && (
          <button
            onClick={handleInstagramClick}
            className="mt-3 w-full rounded-2xl bg-card p-4 flex items-center gap-2 text-left transition-colors hover:bg-muted"
          >
            <Instagram className="h-4 w-4 text-secondary" />
            <span className="text-sm text-primary font-medium">{profile.instagram}</span>
          </button>
        )}

        {/* Admin Info Section - only visible to admin */}
        {user?.email === "rangiavlog@gmail.com" && (
          <div className="mt-3 rounded-2xl bg-card p-4 border border-accent/30">
            <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Admin Info
            </p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">User ID: <span className="text-foreground font-mono text-[11px]">{profile.id}</span></p>
            </div>
          </div>
        )}

        {/* Like button (only for other users) */}
        {!isOwnProfile && (
          <button
            onClick={handleLike}
            disabled={hasLiked}
            className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] ${
              hasLiked ? "opacity-70" : ""
            }`}
            style={{ backgroundColor: "hsl(var(--pink))" }}
          >
            <Heart className="h-5 w-5" /> {hasLiked ? "Liked ✓" : `Like ${profile.name}`}
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ViewProfilePage;
