import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, UserPlus, X, Check, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import DefaultAvatar from "@/components/DefaultAvatar";
import verifiedBadge from "@/assets/verified-badge.png";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  name: string;
  photo_url: string | null;
  is_verified: boolean;
  branch: string | null;
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  profile: UserProfile;
}

const FriendsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  useSwipeNav({ next: "/notices", prev: "/feed" });
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"friends" | "requests">("friends");
  const [exploreUsers, setExploreUsers] = useState<UserProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, photo_url, is_verified, branch")
      .eq("id", user.id)
      .single();
    setMyProfile(profile as UserProfile);

    // Fetch accepted friends (matches + accepted friend requests)
    const [{ data: matchRows }, { data: acceptedReqs }] = await Promise.all([
      supabase.from("matches").select("user1_id, user2_id").or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
      supabase.from("friend_requests").select("from_user_id, to_user_id").eq("status", "accepted").or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
    ]);

    const friendIds = (matchRows || []).map(m => m.user1_id === user.id ? m.user2_id : m.user1_id);
    const reqFriendIds = (acceptedReqs || []).map(r => r.from_user_id === user.id ? r.to_user_id : r.from_user_id);
    const allFriendIds = [...new Set([...friendIds, ...reqFriendIds])];

    if (allFriendIds.length > 0) {
      const { data: friendProfiles } = await supabase
        .from("profiles")
        .select("id, name, photo_url, is_verified, branch")
        .in("id", allFriendIds);
      setFriends((friendProfiles as UserProfile[]) || []);
    } else {
      setFriends([]);
    }

    // Fetch pending incoming friend requests
    const { data: pendingReqs } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("to_user_id", user.id)
      .eq("status", "pending");

    if (pendingReqs && pendingReqs.length > 0) {
      const fromIds = pendingReqs.map(r => r.from_user_id);
      const { data: reqProfiles } = await supabase
        .from("profiles")
        .select("id, name, photo_url, is_verified, branch")
        .in("id", fromIds);
      const profileMap = new Map((reqProfiles || []).map(p => [p.id, p]));
      setRequests(pendingReqs.map(r => ({
        ...r,
        profile: profileMap.get(r.from_user_id) as UserProfile,
      })).filter(r => r.profile));
    } else {
      setRequests([]);
    }

    // Get sent requests
    const { data: mySentReqs } = await supabase
      .from("friend_requests")
      .select("to_user_id")
      .eq("from_user_id", user.id)
      .in("status", ["pending", "accepted"]);
    setSentRequests(new Set((mySentReqs || []).map(r => r.to_user_id)));

    // Get following
    const { data: myFollows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    setFollowingSet(new Set((myFollows || []).map(f => f.following_id)));

    // Explore: all users except self and already friends
    const excludeIds = new Set([user.id, ...allFriendIds]);
    const { data: allUsers } = await supabase
      .from("profiles")
      .select("id, name, photo_url, is_verified, branch")
      .limit(50);
    setExploreUsers((allUsers || []).filter(u => !excludeIds.has(u.id)) as UserProfile[]);

    setLoading(false);
  };

  const handleAccept = async (req: FriendRequest) => {
    // Optimistic update
    setRequests(prev => prev.filter(r => r.id !== req.id));
    setFriends(prev => [...prev, req.profile]);

    await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", req.id);
    const myName = myProfile?.name || "Someone";
    await supabase.rpc("create_notification", {
      _target_user_id: req.from_user_id,
      _type: "friend_accepted",
      _title: `${myName} accepted your friend request!`,
      _message: `${myName} is now your friend 🎉`,
      _related_id: user!.id,
    });
    toast.success(`You're now friends with ${req.profile.name}!`);
  };

  const handleReject = async (req: FriendRequest) => {
    setRequests(prev => prev.filter(r => r.id !== req.id));
    await supabase.from("friend_requests").delete().eq("id", req.id);
    toast.success("Request declined");
  };

  const handleAddFriend = async (targetUser: UserProfile) => {
    if (!user) return;
    setSentRequests(prev => new Set(prev).add(targetUser.id));
    
    const { error } = await supabase.from("friend_requests").insert({
      from_user_id: user.id,
      to_user_id: targetUser.id,
    });
    if (error) {
      setSentRequests(prev => { const s = new Set(prev); s.delete(targetUser.id); return s; });
      toast.error("Already sent");
      return;
    }
    const { data: myP } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    await supabase.rpc("create_notification", {
      _target_user_id: targetUser.id,
      _type: "friend_request",
      _title: `${myP?.name || "Someone"} sent you a friend request!`,
      _message: `${myP?.name || "Someone"} wants to be your friend 👋`,
      _related_id: user.id,
    });
    toast.success("Friend request sent!");
  };

  const handleFollow = async (targetUser: UserProfile) => {
    if (!user) return;
    if (followingSet.has(targetUser.id)) {
      setFollowingSet(prev => { const s = new Set(prev); s.delete(targetUser.id); return s; });
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUser.id);
    } else {
      setFollowingSet(prev => new Set(prev).add(targetUser.id));
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUser.id });
      const { data: myP } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      await supabase.rpc("create_notification", {
        _target_user_id: targetUser.id,
        _type: "follow",
        _title: `${myP?.name || "Someone"} followed you!`,
        _message: `${myP?.name || "Someone"} started following you 👋`,
        _related_id: user.id,
      });
    }
  };

  const totalFriends = friends.length;

  return (
   <div
  className="min-h-[100dvh] bg-background pb-24"
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
     >
      <TopBar title="Friends" />

      <div className="mx-auto max-w-md px-4 pt-3">
        {/* My profile card */}
        {myProfile && (
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4 mb-4">
            <DefaultAvatar src={myProfile.photo_url} alt={myProfile.name} className="h-16 w-16" />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-display text-base font-bold text-foreground">{myProfile.name}</p>
                {myProfile.is_verified && <img src={verifiedBadge} alt="V" className="h-4 w-4" />}
              </div>
              <p className="text-sm text-muted-foreground">{totalFriends} friend{totalFriends !== 1 ? "s" : ""}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setTab("friends")}
            className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${tab === "friends" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            Friends ({totalFriends})
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${tab === "requests" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            Requests {requests.length > 0 && `(${requests.length})`}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : tab === "friends" ? (
          <>
            {friends.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="text-5xl">💫</span>
                <p className="mt-4 font-display text-lg font-bold text-foreground">No friends yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Start connecting with people!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map(f => (
                  <button
                    key={f.id}
                    onClick={() => navigate(`/profile/${f.id}`)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-card p-3 transition-all active:scale-[0.98]"
                  >
                    <DefaultAvatar src={f.photo_url} alt={f.name} className="h-12 w-12" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        <p className="font-display text-sm font-bold text-foreground truncate">{f.name}</p>
                        {f.is_verified && <img src={verifiedBadge} alt="V" className="h-3.5 w-3.5" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{f.branch || "No branch"}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* Explore Section */}
            {exploreUsers.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  <p className="font-display text-sm font-bold text-foreground">Explore</p>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                  {exploreUsers.map(eu => {
                    const isSent = sentRequests.has(eu.id);
                    const isFollowed = followingSet.has(eu.id);
                    return (
                      <div key={eu.id} className="flex-shrink-0 w-36 rounded-2xl bg-card p-3 flex flex-col items-center gap-2">
                        <button onClick={() => navigate(`/profile/${eu.id}`)}>
                          <DefaultAvatar src={eu.photo_url} alt={eu.name} className="h-16 w-16" />
                        </button>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-semibold text-foreground truncate max-w-[100px]">{eu.name}</p>
                          {eu.is_verified && <img src={verifiedBadge} alt="V" className="h-3 w-3" />}
                        </div>
                        <button
                          onClick={() => handleAddFriend(eu)}
                          disabled={isSent}
                          className={`w-full rounded-lg py-1.5 text-[10px] font-bold transition-all ${
                            isSent ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                          }`}
                        >
                          {isSent ? "Sent" : "Add Friend"}
                        </button>
                        <button
                          onClick={() => handleFollow(eu)}
                          className={`w-full rounded-lg py-1.5 text-[10px] font-bold transition-all ${
                            isFollowed ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {isFollowed ? "Following" : "Follow"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          requests.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <span className="text-4xl">📬</span>
              <p className="mt-4 font-display text-base font-bold text-foreground">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map(req => (
                <div key={req.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                  <button onClick={() => navigate(`/profile/${req.from_user_id}`)} className="flex-shrink-0">
                    <DefaultAvatar src={req.profile.photo_url} alt={req.profile.name} className="h-12 w-12" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{req.profile.name}</p>
                    <p className="text-xs text-muted-foreground">Wants to be your friend</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleAccept(req)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleReject(req)} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default FriendsPage;
