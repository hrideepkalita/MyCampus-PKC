import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Instagram, UserPlus, UserCheck, Shield, Send, Eye, X, ChevronRight } from "lucide-react";
import DefaultAvatar from "@/components/DefaultAvatar";
import { toast } from "sonner";
import verifiedBadge from "@/assets/verified-badge.png";
import FollowersModal from "@/components/FollowersModal";
import PhotoGallery from "@/components/PhotoGallery";
import PostScrollViewer from "@/components/PostScrollViewer";
import { AnimatePresence } from "framer-motion";

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
  is_verified: boolean;
  instagram: string | null;
  semester: string | null;
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

interface UserPost {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  created_at: string;
}

const ViewProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [theyFollowMe, setTheyFollowMe] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mutualText, setMutualText] = useState("");
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [friendRequestStatus, setFriendRequestStatus] = useState<string | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [showPostScroller, setShowPostScroller] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchProfile();
    fetchGalleryPhotos();
    fetchUserPosts();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
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
      .select("id, name, age, gender, branch, bio, photo_url, interests, looking_for, instagram, is_verified, semester")
      .eq("id", id!)
      .maybeSingle();
    if (data) {
      setProfile({ ...data, interests: (data.interests as string[]) || [], is_verified: (data as any).is_verified ?? false, semester: (data as any).semester || null });
    }
    setLoading(false);
  };

  const fetchUserPosts = async () => {
    if (!id) return;
    const { data } = await supabase.from("posts").select("id, content, media_url, media_type, created_at").eq("user_id", id).order("created_at", { ascending: false });
    setUserPosts((data as UserPost[]) || []);
  };

  const fetchGalleryPhotos = useCallback(async () => {
    if (!id) return;
    const { data: photos } = await supabase.from("profile_photos").select("*").eq("user_id", id).order("created_at", { ascending: false });
    if (!photos || photos.length === 0) { setGalleryPhotos([]); return; }
    const photoIds = photos.map((p: any) => p.id);
    const [{ data: likeCounts }, { data: userLikes }] = await Promise.all([
      supabase.from("photo_likes").select("photo_id").in("photo_id", photoIds),
      user ? supabase.from("photo_likes").select("photo_id").in("photo_id", photoIds).eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    const countMap: Record<string, number> = {};
    (likeCounts || []).forEach((l: any) => { countMap[l.photo_id] = (countMap[l.photo_id] || 0) + 1; });
    const userLikedSet = new Set((userLikes || []).map((l: any) => l.photo_id));
    setGalleryPhotos(photos.map((p: any) => ({ ...p, like_count: countMap[p.id] || 0, user_liked: userLikedSet.has(p.id) })));
  }, [id, user]);

  const trackProfileView = async () => {
    if (!user || !id || user.id === id) return;
    const twentyFourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase.from("profile_views").select("id").eq("viewer_id", user.id).eq("viewed_user_id", id).gte("created_at", twentyFourAgo).limit(1);
    if (recent && recent.length > 0) return;
    await supabase.from("profile_views").insert({ viewer_id: user.id, viewed_user_id: id });
  };

  const checkFollowing = async () => { const { data } = await supabase.from("follows").select("id").eq("follower_id", user!.id).eq("following_id", id!).maybeSingle(); setIsFollowing(!!data); };
  const checkTheyFollowMe = async () => { const { data } = await supabase.from("follows").select("id").eq("follower_id", id!).eq("following_id", user!.id).maybeSingle(); setTheyFollowMe(!!data); };
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
    const [{ data: myFollowing }, { data: theirFollowers }] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
      supabase.from("follows").select("follower_id").eq("following_id", id),
    ]);
    const mySet = new Set((myFollowing || []).map(f => f.following_id));
    const mutualIds = (theirFollowers || []).map(f => f.follower_id).filter(fid => mySet.has(fid) && fid !== user.id);
    if (mutualIds.length === 0) { setMutualText(""); return; }
    const { data: mutualProfiles } = await supabase.from("profiles").select("name").in("id", mutualIds.slice(0, 2));
    const names = (mutualProfiles || []).map(p => p.name);
    const remaining = mutualIds.length - names.length;
    if (names.length === 1 && remaining === 0) setMutualText(`Followed by ${names[0]}`);
    else if (names.length === 1) setMutualText(`Followed by ${names[0]} and ${remaining} other${remaining > 1 ? "s" : ""}`);
    else if (names.length >= 2 && remaining === 0) setMutualText(`Followed by ${names[0]} and ${names[1]}`);
    else setMutualText(`Followed by ${names[0]}, ${names[1]} and ${remaining} other${remaining > 1 ? "s" : ""}`);
  };

  const handleFollowToggle = async () => {
    if (!user || !profile) return;
    if (isFollowing) {
      setIsFollowing(false); setFollowersCount(c => c - 1);
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
    } else {
      setIsFollowing(true); setFollowersCount(c => c + 1);
      await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
      const { data: myProfile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      await supabase.from("notifications").insert({ user_id: profile.id, type: "follow", title: `${myProfile?.name || "Someone"} followed you!`, message: `${myProfile?.name || "Someone"} started following you 👋`, related_id: user.id });
    }
  };

  const getFollowLabel = () => { if (isFollowing) return "Following"; if (theyFollowMe) return "Follow Back"; return "Follow"; };

  const checkFriendRequest = async () => {
    if (!user || !id || user.id === id) return;
    const { data } = await supabase.from("friend_requests").select("status").or(`and(from_user_id.eq.${user.id},to_user_id.eq.${id}),and(from_user_id.eq.${id},to_user_id.eq.${user.id})`).maybeSingle();
    setFriendRequestStatus(data?.status || null);
  };

  const handleSendFriendRequest = async () => {
    if (!user || !profile) return;
    setFriendRequestStatus("pending");
    const { error } = await supabase.from("friend_requests").insert({ from_user_id: user.id, to_user_id: profile.id });
    if (error) { setFriendRequestStatus(null); toast.error("Already sent"); return; }
    const { data: myProfile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    await supabase.from("notifications").insert({ user_id: profile.id, type: "friend_request", title: `${myProfile?.name || "Someone"} sent you a friend request!`, message: `${myProfile?.name || "Someone"} wants to be your friend 👋`, related_id: user.id });
    toast.success("Friend request sent!");
  };

  if (loading) return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!profile) return <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background"><p className="font-display text-lg font-bold text-foreground">Profile not found</p><button onClick={() => navigate(-1)} className="mt-4 rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground">Go Back</button></div>;

  const isOwnProfile = user?.id === profile.id;
  const deptSemDisplay = [profile.branch, profile.semester ? `Sem ${profile.semester}` : null].filter(Boolean).join(" • ");

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} alt="Full" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
        </div>
      )}

      {followModal && isOwnProfile && <FollowersModal profileId={profile.id} type={followModal} onClose={() => setFollowModal(null)} />}

      <AnimatePresence>
        {showPostScroller && (
          <PostScrollViewer userId={profile.id} onClose={() => setShowPostScroller(false)} />
        )}
      </AnimatePresence>

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-display text-lg font-bold text-foreground">{profile.name}</h1>
          {profile.is_verified && <img src={verifiedBadge} alt="Verified" className="h-[25px] w-[25px] object-contain" />}
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Main photo */}
        <div className="relative aspect-[3/4] max-h-[55vh] w-full overflow-hidden rounded-2xl" onClick={() => profile.photo_url && setSelectedPhoto(profile.photo_url)}>
          <img src={profile.photo_url || "/placeholder.svg"} alt={profile.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <h2 className="font-display text-2xl font-bold text-white drop-shadow-lg">{profile.name}{profile.age ? `, ${profile.age}` : ""}</h2>
            {deptSemDisplay && <p className="text-sm text-white/90 drop-shadow">{deptSemDisplay}</p>}
          </div>
        </div>

        {/* Follow counts */}
        <div className="mt-3 flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="font-display text-lg font-bold text-foreground">{followersCount}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="font-display text-lg font-bold text-foreground">{followingCount}</p>
            <p className="text-xs text-muted-foreground">Following</p>
          </div>
        </div>

        {mutualText && <p className="mt-2 text-center text-xs text-muted-foreground">{mutualText}</p>}

        {/* Follow + Add Friend */}
        {!isOwnProfile && (
          <div className="mt-3 flex gap-2">
            <button onClick={handleFollowToggle} className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold active:scale-[0.98] transition-transform ${isFollowing ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
              {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {getFollowLabel()}
            </button>
            <button onClick={handleSendFriendRequest} disabled={friendRequestStatus === "pending" || friendRequestStatus === "accepted"} className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold active:scale-[0.98] transition-transform ${friendRequestStatus === "accepted" ? "bg-accent/20 text-accent" : friendRequestStatus === "pending" ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground"}`}>
              <Send className="h-4 w-4" />
              {friendRequestStatus === "accepted" ? "Friends" : friendRequestStatus === "pending" ? "Sent" : "Add Friend"}
            </button>
          </div>
        )}

        {/* Gallery */}
        <PhotoGallery photos={galleryPhotos} onPhotoLiked={fetchGalleryPhotos} ownerName={profile.name} />

        {/* User Posts Grid */}
        {userPosts.filter(p => p.media_url).length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground">Posts</p>
              <button onClick={() => setShowPostScroller(true)} className="flex items-center gap-1 text-xs font-medium text-primary">
                View All <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {userPosts.filter(p => p.media_url).slice(0, 6).map(post => (
                <button key={post.id} onClick={() => setShowPostScroller(true)} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {post.media_type === "video" ? (
                    <video src={post.media_url!} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={post.media_url!} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                  {post.media_type === "video" && (
                    <div className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/50 px-1 py-0.5 text-[9px] text-white">
                      <Eye className="h-2.5 w-2.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
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
              {profile.interests.map(i => <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{i}</span>)}
            </div>
          </div>
        )}

        {profile.looking_for && (
          <div className="mt-3 rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Looking for</p>
            <p className="text-sm font-medium text-foreground">{profile.looking_for}</p>
          </div>
        )}

        {profile.instagram && (
          <button onClick={() => window.open(`https://instagram.com/${profile.instagram!.replace(/^@/, "")}`, "_blank")} className="mt-3 w-full rounded-2xl bg-card p-4 flex items-center gap-2 text-left hover:bg-muted transition-colors">
            <Instagram className="h-4 w-4 text-secondary" />
            <span className="text-sm text-primary font-medium">{profile.instagram}</span>
          </button>
        )}

        {/* Admin Info */}
        {user?.email === "rangiavlog@gmail.com" && (
          <div className="mt-3 rounded-2xl bg-card p-4 border border-accent/30">
            <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Admin Info</p>
            <p className="text-xs text-muted-foreground">User ID: <span className="text-foreground font-mono text-[11px]">{profile.id}</span></p>
          </div>
        )}

        {/* Slogan */}
        <p className="mt-8 mb-4 text-center text-xs text-muted-foreground">
          Made by PKCian for PKCians ❤️
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default ViewProfilePage;
