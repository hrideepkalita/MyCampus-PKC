import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Heart, MessageCircle, Share2, Volume2, VolumeX } from "lucide-react";
import DefaultAvatar from "@/components/DefaultAvatar";
import verifiedBadge from "@/assets/verified-badge.png";
import CommentsSheet from "@/components/CommentsSheet";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  created_at: string;
  profile: { name: string; photo_url: string | null; is_verified: boolean };
  like_count: number;
  user_liked: boolean;
}

interface PostScrollViewerProps {
  userId: string;
  startIndex?: number;
  onClose: () => void;
}

const PostScrollViewer = ({ userId, startIndex = 0, onClose }: PostScrollViewerProps) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const [heartAnimId, setHeartAnimId] = useState<string | null>(null);
  const videoContainers = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => { fetchPosts(); }, [userId]);

  const fetchPosts = async () => {
    const { data: rawPosts } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!rawPosts) { setLoading(false); return; }

    const { data: profile } = await supabase.from("profiles").select("name, photo_url, is_verified").eq("id", userId).single();
    const postIds = rawPosts.map(p => p.id);

    const [{ data: likes }, { data: userLikes }] = await Promise.all([
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      user ? supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);

    const likeCountMap: Record<string, number> = {};
    (likes || []).forEach((l: any) => { likeCountMap[l.post_id] = (likeCountMap[l.post_id] || 0) + 1; });
    const userLikedSet = new Set((userLikes || []).map((l: any) => l.post_id));

    setPosts(rawPosts.map(p => ({
      ...p,
      profile: { name: profile?.name || "Unknown", photo_url: profile?.photo_url || null, is_verified: profile?.is_verified || false },
      like_count: likeCountMap[p.id] || 0,
      user_liked: userLikedSet.has(p.id),
    })));
    setLoading(false);
  };

  // Single video observer
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = (entry.target as HTMLElement).dataset.postId;
        if (entry.isIntersecting && id) setActiveVideoId(id);
      });
    }, { threshold: 0.6 });
    videoContainers.current.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [posts]);

  const registerVideo = useCallback((postId: string, el: HTMLDivElement | null) => {
    if (el) { el.dataset.postId = postId; videoContainers.current.set(postId, el); }
  }, []);

  const handleDoubleTap = (post: Post) => {
    const now = Date.now();
    if (lastTapRef.current?.id === post.id && now - lastTapRef.current.time < 300) {
      if (!post.user_liked) triggerLike(post);
      setHeartAnimId(post.id);
      setTimeout(() => setHeartAnimId(null), 600);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id: post.id, time: now };
    }
  };

  const triggerLike = async (post: Post) => {
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_liked: true, like_count: p.like_count + 1 } : p));
    await supabase.from("post_likes").insert({ user_id: user!.id, post_id: post.id });
  };

  const handleLike = async (post: Post) => {
    if (!user) return;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_liked: !p.user_liked, like_count: p.user_liked ? p.like_count - 1 : p.like_count + 1 } : p));
    if (post.user_liked) {
      await supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      await supabase.from("post_likes").insert({ user_id: user.id, post_id: post.id });
    }
  };

  const handleShare = async (post: Post) => {
    try {
      await navigator.share({ text: post.content || "Check this out!", url: window.location.origin });
    } catch {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Link copied!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="font-display text-lg font-bold text-foreground">Posts</h2>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          </div>
        ) : (
          posts.filter(p => p.media_url).map(post => {
            const isVideo = post.media_type === "video";
            const isActive = activeVideoId === post.id;

            return (
              <div key={post.id} className="border-b border-border">
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <DefaultAvatar src={post.profile.photo_url} alt={post.profile.name} className="h-8 w-8" />
                  <span className="text-sm font-semibold text-foreground">{post.profile.name}</span>
                  {post.profile.is_verified && <img src={verifiedBadge} alt="V" className="h-3.5 w-3.5" />}
                </div>

                <div
                  ref={isVideo ? (el) => registerVideo(post.id, el) : undefined}
                  className="relative w-full"
                  onClick={() => handleDoubleTap(post)}
                >
                  {isVideo ? (
                    isActive ? (
                      <div className="relative">
                        <VideoPlayer src={post.media_url!} muted={isMuted} />
                        <button
                          onClick={e => { e.stopPropagation(); setIsMuted(!isMuted); }}
                          className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
                        >
                          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                      </div>
                    ) : (
                      <div className="w-full bg-black flex items-center justify-center" style={{ minHeight: "300px" }}>
                        <span className="text-muted-foreground text-xs">▶ Video</span>
                      </div>
                    )
                  ) : (
                    <img src={post.media_url!} alt="" className="w-full max-h-[75vh] object-cover bg-muted" loading="lazy" />
                  )}

                  {heartAnimId === post.id && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping">
                      <Heart className="h-20 w-20 fill-red-500 text-red-500 drop-shadow-lg" />
                    </div>
                  )}
                </div>

                <div className="px-4 py-2">
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleLike(post)} className="flex items-center gap-1.5">
                      <Heart className={`h-5 w-5 transition-all ${post.user_liked ? "fill-destructive text-destructive scale-110" : "text-foreground"}`} />
                      {post.like_count > 0 && <span className="text-xs font-medium text-foreground">{post.like_count}</span>}
                    </button>
                    <button onClick={() => setCommentPostId(post.id)} className="flex items-center gap-1.5">
                      <MessageCircle className="h-5 w-5 text-foreground" />
                    </button>
                    <button onClick={() => handleShare(post)}>
                      <Share2 className="h-5 w-5 text-foreground" />
                    </button>
                  </div>
                  {post.content && (
                    <p className="mt-1 text-sm text-foreground">
                      <span className="font-semibold">{post.profile.name}</span> {post.content}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {commentPostId && (
        <CommentsSheet
          postId={commentPostId}
          postOwnerId={posts.find(p => p.id === commentPostId)?.user_id || ""}
          onClose={() => setCommentPostId(null)}
        />
      )}
    </div>
  );
};

/* Tiny video player that auto-plays on mount, pauses on unmount */
const VideoPlayer = ({ src, muted }: { src: string; muted: boolean }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    ref.current?.play().catch(() => {});
    return () => { ref.current?.pause(); };
  }, []);
  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);
  return (
    <video ref={ref} src={src} className="w-full object-contain bg-black" style={{ maxHeight: "75vh" }} loop playsInline preload="none" muted={muted} />
  );
};

export default PostScrollViewer;
