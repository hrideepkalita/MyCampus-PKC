import { useState, useEffect, useCallback, useRef, memo } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, MoreVertical, Trash2, Edit, Share2, Plus, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFloatingHearts } from "@/App";
import DefaultAvatar from "@/components/DefaultAvatar";
import CreatePostModal from "@/components/CreatePostModal";
import CommentsSheet from "@/components/CommentsSheet";
import verifiedBadge from "@/assets/verified-badge.png";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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
  user_liked: boolean;
  comment_count: number;
}

const BATCH = 10;

/* ── Lightweight post card (memoized) ── */
const FeedPost = memo(({
  post, userId, isMuted, onDoubleTap, onLike, onComment, onDelete, onEdit, onShare, onNavigate, activeVideoId, onVideoVisible, onToggleMute,
}: {
  post: Post; userId: string | undefined; isMuted: boolean;
  onDoubleTap: (p: Post) => void; onLike: (p: Post) => void;
  onComment: (id: string) => void; onDelete: (id: string) => void;
  onEdit: (p: Post) => void; onShare: (p: Post) => void;
  onNavigate: (path: string) => void; activeVideoId: string | null;
  onVideoVisible: (id: string, el: HTMLDivElement) => void; onToggleMute: () => void;
}) => {

  const [menuOpen, setMenuOpen] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false); // ✅ prevent spam clicks

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTapRef = useRef<number>(0);

  const isVideo = post.media_type === "video";
  const isActive = activeVideoId === post.id;

 const handlePostComment = async () => {
  if (!comment.trim()) return;

  try {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user) {
      toast.error("Login required");
      return;
    }

    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: userData.user.id,
      content: comment.trim(),
      parent_id: null
    });

    if (error) {
      console.error(error);
      toast.error(error.message);
      return;
    }

    setComment("");
    onComment(post.id);

  } catch (err) {
    console.error(err);
    toast.error("Failed to post comment");
  }
};

  useEffect(() => {
    if (isVideo && containerRef.current) {
      onVideoVisible(post.id, containerRef.current);
    }
  }, [isVideo, post.id, onVideoVisible]);

  useEffect(() => {
    if (!videoRef.current || !isVideo) return;

    if (isActive) {
      videoRef.current.muted = isMuted;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isActive, isMuted, isVideo]);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!post.user_liked) onDoubleTap(post);
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 600);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <div className="border-b border-border">


    
     
    {/* Header */}
<div className="relative flex items-center justify-between px-4 py-3">

  {/* LEFT SIDE */}
  <div className="flex items-center gap-2.5">
    <button
      onClick={() => onNavigate(`/profile/${post.user_id}`)}
      className="flex items-center gap-2.5 shrink-0"
    >
      <DefaultAvatar
        src={post.profile.photo_url}
        alt={post.profile.name}
        className="h-9 w-9"
      />

      <div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">
            {post.profile.name}
          </span>

          {post.profile.is_verified && (
            <img src={verifiedBadge} className="h-3.5 w-3.5" />
          )}
        </div>

        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </span>
      </div>
    </button>
  </div>

  {/* RIGHT SIDE */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      setMenuOpen(!menuOpen);
    }}
    className="relative z-20 p-1"
  >
    <MoreVertical className="h-4 w-4" />
  </button>

  {/* MENU */}
  {menuOpen && (
    <div className="absolute right-4 top-12 w-32 bg-card border border-border rounded-lg shadow-lg z-50">
      {userId === post.user_id ? (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(post);
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
          >
            <Edit className="h-4 w-4" /> Edit
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(post.id);
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-muted"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare(post);
            setMenuOpen(false);
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      )}
    </div>
  )}

</div>
      {/* Media */}
   {post.media_url && (
  <div
    ref={containerRef}
    className="relative w-full bg-black overflow-hidden"
  >
    {isVideo ? (
      <>
        <video
          ref={videoRef}
          src={post.media_url}
          className="w-full max-h-[75vh] object-contain bg-black"
          muted={isMuted}
          playsInline
          preload="metadata"
          onClick={handleTap}
        />

        {/* MUTE BUTTON */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="absolute bottom-2 right-2 z-10 bg-black/50 p-2 rounded-full"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-white" />
          ) : (
            <Volume2 className="h-4 w-4 text-white" />
          )}
        </button>
      </>
    ) : (
      <img
        src={post.media_url}
        className="w-full max-h-[75vh] object-contain bg-black"
        loading="lazy"
        decoding="async"
        onClick={handleTap}
      />
    )}
  </div>
)}

      {/* Actions */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-4">
          <button onClick={() => onLike(post)} className="flex items-center gap-1.5">
            <Heart className={`h-5 w-5 ${post.user_liked ? "fill-red-500 text-red-500" : ""}`} />
            {post.like_count > 0 && <span className="text-xs">{post.like_count}</span>}
          </button>

          <button onClick={() => onComment(post.id)} className="flex items-center gap-1.5">
            <MessageCircle className="h-5 w-5" />
            {post.comment_count > 0 && <span className="text-xs">{post.comment_count}</span>}
          </button>

          <button onClick={() => onShare(post)}>
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {post.content && (
          <p className="mt-1 text-sm">
            <span className="font-semibold">{post.profile.name}</span> {post.content}
          </p>
        )}

        {/* COMMENT INPUT */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <button
            onClick={handlePostComment}
            disabled={posting}
            className="text-primary text-sm font-semibold disabled:opacity-50"
          >
            {posting ? "..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
});

FeedPost.displayName = "FeedPost";

/* ── Main Feed ── */
const FeedPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { enabled: heartsEnabled, toggle: toggleHearts } = useFloatingHearts();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const videoContainers = useRef<Map<string, HTMLDivElement>>(new Map());
  const ioRef = useRef<IntersectionObserver | null>(null);

  const fetchPosts = useCallback(async (offset = 0, append = false) => {
    if (!user) return;
    if (!append) setLoading(true);

    const { data: rawPosts } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + BATCH - 1);

    if (!rawPosts || rawPosts.length === 0) { setHasMore(false); setLoading(false); return; }
    if (rawPosts.length < BATCH) setHasMore(false);

    const userIds = [...new Set(rawPosts.map(p => p.user_id))];
    const postIds = rawPosts.map(p => p.id);

    const [{ data: profiles }, { data: likes }, { data: userLikes }, { data: comments }] = await Promise.all([
      supabase.from("profiles").select("id, name, photo_url, is_verified").in("id", userIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", user.id),
      supabase.from("comments").select("post_id").in("post_id", postIds),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const likeCountMap: Record<string, number> = {};
    (likes || []).forEach((l: any) => { likeCountMap[l.post_id] = (likeCountMap[l.post_id] || 0) + 1; });
    const userLikedSet = new Set((userLikes || []).map((l: any) => l.post_id));
    const commentCountMap: Record<string, number> = {};
    (comments || []).forEach((c: any) => { commentCountMap[c.post_id] = (commentCountMap[c.post_id] || 0) + 1; });

    const enriched: Post[] = rawPosts.map(p => {
      const prof = profileMap.get(p.user_id);
      return {
        ...p,
        profile: { name: prof?.name || "Unknown", photo_url: prof?.photo_url || null, is_verified: prof?.is_verified || false },
        like_count: likeCountMap[p.id] || 0,
        user_liked: userLikedSet.has(p.id),
        comment_count: commentCountMap[p.id] || 0,
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

  // Single video intersection observer - only one video active
  useEffect(() => {
    if (ioRef.current) ioRef.current.disconnect();
    const io = new IntersectionObserver((entries) => {
      let topEntry: IntersectionObserverEntry | null = null;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (!topEntry || entry.intersectionRatio > topEntry.intersectionRatio) {
            topEntry = entry;
          }
        }
      });
      if (topEntry) {
        const id = (topEntry as any).target.dataset.postId;
        if (id) setActiveVideoId(id);
      } else {
        // Check if any video container is still visible
        let anyVisible = false;
        videoContainers.current.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) anyVisible = true;
        });
        if (!anyVisible) setActiveVideoId(null);
      }
    }, { threshold: 0.6 });
    ioRef.current = io;
    videoContainers.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [posts]);

  const registerVideoContainer = useCallback((postId: string, el: HTMLDivElement) => {
    el.dataset.postId = postId;
    videoContainers.current.set(postId, el);
    ioRef.current?.observe(el);
  }, []);

  const triggerLike = useCallback(async (post: Post) => {
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_liked: true, like_count: p.like_count + 1 } : p));
    await supabase.from("post_likes").insert({ user_id: user!.id, post_id: post.id });
    if (post.user_id !== user!.id) {
      const { data: myProfile } = await supabase.from("profiles").select("name").eq("id", user!.id).single();
      await supabase.from("notifications").insert({
        user_id: post.user_id, type: "post_like",
        title: `${myProfile?.name || "Someone"} liked your post!`,
        message: `${myProfile?.name || "Someone"} liked your post ❤️`,
        related_id: post.id,
      });
    }
  }, [user]);

  const handleLike = useCallback(async (post: Post) => {
    if (!user) return;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_liked: !p.user_liked, like_count: p.user_liked ? p.like_count - 1 : p.like_count + 1 } : p));
    if (post.user_liked) {
      await supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      await supabase.from("post_likes").insert({ user_id: user.id, post_id: post.id });
      if (post.user_id !== user.id) {
        const { data: myProfile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
        await supabase.from("notifications").insert({
          user_id: post.user_id, type: "post_like",
          title: `${myProfile?.name || "Someone"} liked your post!`,
          message: `${myProfile?.name || "Someone"} liked your post ❤️`,
          related_id: post.id,
        });
      }
    }
  }, [user]);

  const handleDelete = useCallback(async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    setPosts(prev => prev.filter(p => p.id !== postId));
    await supabase.from("posts").delete().eq("id", postId);
    toast.success("Post deleted");
  }, []);

  const handleEdit = useCallback((post: Post) => {
    setEditingPost(post.id);
    setEditCaption(post.content || "");
  }, []);

  const handleEditSave = async (postId: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: editCaption } : p));
    await supabase.from("posts").update({ content: editCaption }).eq("id", postId);
    setEditingPost(null);
    toast.success("Post updated");
  };

  const handleShare = useCallback(async (post: Post) => {
    try {
      await navigator.share({ text: post.content || "Check this out!", url: window.location.origin });
    } catch {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Link copied!");
    }
  }, []);

  const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);
  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <TopBar
        title="Home"
        rightContent={
          <div className="flex items-center gap-1.5">
            <button onClick={toggleHearts} className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${heartsEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              <Heart className={`h-3.5 w-3.5 ${heartsEnabled ? "fill-primary text-primary" : ""}`} />
            </button>
            <button onClick={() => setShowCreate(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} onCreated={() => fetchPosts()} />}

      {commentPostId && (
        <CommentsSheet
          postId={commentPostId}
          postOwnerId={posts.find(p => p.id === commentPostId)?.user_id || ""}
          onClose={() => setCommentPostId(null)}
        />
      )}

      <div className="mx-auto max-w-md">
        {posts.map(post => (
          editingPost === post.id ? (
            <div key={post.id} className="border-b border-border px-4 py-3">
              <div className="flex gap-2">
                <input value={editCaption} onChange={e => setEditCaption(e.target.value)} className="flex-1 rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground" />
                <button onClick={() => handleEditSave(post.id)} className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Save</button>
                <button onClick={() => setEditingPost(null)} className="text-xs text-muted-foreground">Cancel</button>
              </div>
            </div>
          ) : (
            <FeedPost
              key={post.id}
              post={post}
              userId={user?.id}
              isMuted={isMuted}
              activeVideoId={activeVideoId}
              onDoubleTap={triggerLike}
              onLike={handleLike}
              onComment={setCommentPostId}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onShare={handleShare}
              onNavigate={handleNavigate}
              onVideoVisible={registerVideoContainer}
              onToggleMute={toggleMute}
            />
          )
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
