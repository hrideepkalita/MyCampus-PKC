import { useState, useEffect, useCallback, useRef } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, MoreVertical, Trash2, Edit, Share2, Plus, Eye, Send, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFloatingHearts } from "@/App";
import DefaultAvatar from "@/components/DefaultAvatar";
import CreatePostModal from "@/components/CreatePostModal";
import verifiedBadge from "@/assets/verified-badge.png";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  created_at: string;
  profile: {
    name: string;
    photo_url: string | null;
    is_verified: boolean;
  };
  like_count: number;
  view_count: number;
  user_liked: boolean;
}

const BATCH = 10;

const FeedPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { enabled: heartsEnabled, toggle: toggleHearts } = useFloatingHearts();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [heartAnimId, setHeartAnimId] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  const fetchPosts = useCallback(async (offset = 0, append = false) => {
    if (!user) return;
    if (!append) setLoading(true);

    const { data: rawPosts } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + BATCH - 1);

    if (!rawPosts || rawPosts.length === 0) {
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (rawPosts.length < BATCH) setHasMore(false);

    const userIds = [...new Set(rawPosts.map(p => p.user_id))];
    const postIds = rawPosts.map(p => p.id);

    const [{ data: profiles }, { data: likes }, { data: userLikes }, { data: views }] = await Promise.all([
      supabase.from("profiles").select("id, name, photo_url, is_verified").in("id", userIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", user.id),
      supabase.from("post_views").select("post_id").in("post_id", postIds),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const likeCountMap: Record<string, number> = {};
    (likes || []).forEach((l: any) => { likeCountMap[l.post_id] = (likeCountMap[l.post_id] || 0) + 1; });
    const userLikedSet = new Set((userLikes || []).map((l: any) => l.post_id));
    const viewCountMap: Record<string, number> = {};
    (views || []).forEach((v: any) => { viewCountMap[v.post_id] = (viewCountMap[v.post_id] || 0) + 1; });

    const enriched: Post[] = rawPosts.map(p => {
      const prof = profileMap.get(p.user_id);
      return {
        ...p,
        profile: {
          name: prof?.name || "Unknown",
          photo_url: prof?.photo_url || null,
          is_verified: prof?.is_verified || false,
        },
        like_count: likeCountMap[p.id] || 0,
        view_count: viewCountMap[p.id] || 0,
        user_liked: userLikedSet.has(p.id),
      };
    });

    setPosts(prev => append ? [...prev, ...enriched] : enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !hasMore) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && hasMore) {
        fetchPosts(posts.length, true);
      }
    }, { threshold: 0.5 });
    obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [posts.length, loading, hasMore, fetchPosts]);

  // Video autoplay/pause on viewport
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    videoRefs.current.forEach((video, postId) => {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              video.play().catch(() => {});
            } else {
              video.pause();
            }
          });
        },
        { threshold: 0.6 }
      );
      obs.observe(video);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [posts]);

  // Track video views
  const handleVideoPlay = async (postId: string) => {
    if (!user) return;
    await supabase.from("post_views").insert({ user_id: user.id, post_id: postId }).select();
  };

  // Double-tap to like
  const handleDoubleTap = (post: Post) => {
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.id === post.id && now - lastTapRef.current.time < 300) {
      if (!post.user_liked) {
        triggerLike(post);
      }
      setHeartAnimId(post.id);
      setTimeout(() => setHeartAnimId(null), 800);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id: post.id, time: now };
    }
  };

  const triggerLike = async (post: Post) => {
    // Optimistic update
    setPosts(prev => prev.map(p => p.id === post.id ? {
      ...p, user_liked: true, like_count: p.like_count + 1,
    } : p));

    await supabase.from("post_likes").insert({ user_id: user!.id, post_id: post.id });
    if (post.user_id !== user!.id) {
      const { data: myProfile } = await supabase.from("profiles").select("name").eq("id", user!.id).single();
      await supabase.from("notifications").insert({
        user_id: post.user_id,
        type: "post_like",
        title: `${myProfile?.name || "Someone"} liked your post!`,
        message: `${myProfile?.name || "Someone"} liked your post ❤️`,
        related_id: post.id,
      });
    }
  };

  const handleLike = async (post: Post) => {
    if (!user) return;
    // Optimistic update
    setPosts(prev => prev.map(p => p.id === post.id ? {
      ...p,
      user_liked: !p.user_liked,
      like_count: p.user_liked ? p.like_count - 1 : p.like_count + 1,
    } : p));

    if (post.user_liked) {
      await supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      await supabase.from("post_likes").insert({ user_id: user.id, post_id: post.id });
      if (post.user_id !== user.id) {
        const { data: myProfile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          type: "post_like",
          title: `${myProfile?.name || "Someone"} liked your post!`,
          message: `${myProfile?.name || "Someone"} liked your post ❤️`,
          related_id: post.id,
        });
      }
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    setPosts(prev => prev.filter(p => p.id !== postId));
    await supabase.from("posts").delete().eq("id", postId);
    toast.success("Post deleted");
    setMenuOpen(null);
  };

  const handleEditSave = async (postId: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: editCaption } : p));
    await supabase.from("posts").update({ content: editCaption }).eq("id", postId);
    setEditingPost(null);
    toast.success("Post updated");
  };

  const handleShare = async (post: Post) => {
    try {
      await navigator.share({ text: post.content || "Check this out!", url: window.location.origin });
    } catch {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Link copied!");
    }
    setMenuOpen(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <TopBar
        title="Home"
        rightContent={
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleHearts}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
                heartsEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${heartsEnabled ? "fill-primary text-primary" : ""}`} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {showCreate && (
        <CreatePostModal onClose={() => setShowCreate(false)} onCreated={() => fetchPosts()} />
      )}

      <div className="mx-auto max-w-md">
        {posts.map(post => (
          <div key={post.id} className="border-b border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <button onClick={() => navigate(`/profile/${post.user_id}`)} className="flex items-center gap-2.5">
                <DefaultAvatar src={post.profile.photo_url} alt={post.profile.name} className="h-9 w-9" />
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-foreground">{post.profile.name}</span>
                  {post.profile.is_verified && <img src={verifiedBadge} alt="V" className="h-3.5 w-3.5" />}
                </div>
              </button>
              <div className="relative">
                {post.user_id === user?.id && (
                  <button onClick={() => setMenuOpen(menuOpen === post.id ? null : post.id)} className="p-1">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {menuOpen === post.id && (
                  <div className="absolute right-0 top-8 z-20 w-36 rounded-xl bg-card border border-border shadow-lg overflow-hidden">
                    <button onClick={() => { setEditingPost(post.id); setEditCaption(post.content || ""); setMenuOpen(null); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted">
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button onClick={() => handleShare(post)} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted">
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                    <button onClick={() => handleDelete(post.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-muted">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Media with double-tap */}
            {post.media_url && (
              <div
                className="relative w-full"
                onClick={() => handleDoubleTap(post)}
              >
                {post.media_type === "video" ? (
                  <div className="relative">
                    <video
                      ref={el => { if (el) videoRefs.current.set(post.id, el); }}
                      src={post.media_url}
                      className="w-full object-contain bg-muted"
                      style={{ maxHeight: "85vh" }}
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      onPlay={() => handleVideoPlay(post.id)}
                    />
                    {post.view_count > 0 && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
                        <Eye className="h-3 w-3" /> {post.view_count}
                      </div>
                    )}
                  </div>
                ) : (
                  <img src={post.media_url} alt="" className="w-full max-h-[70vh] object-cover bg-muted" loading="lazy" />
                )}

                {/* Double-tap heart animation */}
                <AnimatePresence>
                  {heartAnimId === post.id && (
                    <motion.div
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: 1.2, opacity: 1 }}
                      exit={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 0.6 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <Heart className="h-20 w-20 fill-red-500 text-red-500 drop-shadow-lg" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-2">
              <div className="flex items-center gap-4">
                <button onClick={() => handleLike(post)} className="flex items-center gap-1.5">
                  <Heart className={`h-5 w-5 transition-all ${post.user_liked ? "fill-destructive text-destructive scale-110" : "text-foreground"}`} />
                  {post.like_count > 0 && <span className="text-xs font-medium text-foreground">{post.like_count}</span>}
                </button>
                <button onClick={() => handleShare(post)} className="flex items-center gap-1.5">
                  <Share2 className="h-5 w-5 text-foreground" />
                </button>
              </div>

              {/* Caption */}
              {editingPost === post.id ? (
                <div className="mt-2 flex gap-2">
                  <input value={editCaption} onChange={e => setEditCaption(e.target.value)} className="flex-1 rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground" />
                  <button onClick={() => handleEditSave(post.id)} className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Save</button>
                  <button onClick={() => setEditingPost(null)} className="text-xs text-muted-foreground">Cancel</button>
                </div>
              ) : post.content ? (
                <p className="mt-1 text-sm text-foreground">
                  <span className="font-semibold">{post.profile.name}</span>{" "}
                  {post.content}
                </p>
              ) : null}

              <p className="mt-1 text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center px-4">
            <span className="text-5xl">📸</span>
            <p className="mt-4 font-display text-lg font-bold text-foreground">No posts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to share something!</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground">
              Create Post
            </button>
          </div>
        )}

        {hasMore && <div ref={observerRef} className="h-10" />}
      </div>

      <BottomNav />
    </div>
  );
};

export default FeedPage;
