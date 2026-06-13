import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Heart, MessageCircle } from "lucide-react";
import DefaultAvatar from "@/components/DefaultAvatar";
import verifiedBadge from "@/assets/verified-badge.png";
import { formatDistanceToNow } from "date-fns";

interface Owner {
  id: string;
  name: string;
  photo_url: string | null;
  is_verified: boolean;
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

const PAGE_SIZE = 6;

const GalleryFeedPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [heartAnim, setHeartAnim] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("id, name, photo_url, is_verified")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => data && setOwner(data as Owner));
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (!userId || loading || !hasMore) return;
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: rows } = await supabase
      .from("profile_photos")
      .select("id, user_id, image_url, caption, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!rows || rows.length === 0) {
      setHasMore(false);
      setLoading(false);
      return;
    }

    const ids = rows.map((r: any) => r.id);
    const [{ data: counts }, { data: mine }] = await Promise.all([
      supabase.from("photo_likes").select("photo_id").in("photo_id", ids),
      user
        ? supabase.from("photo_likes").select("photo_id").in("photo_id", ids).eq("user_id", user.id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const cmap: Record<string, number> = {};
    (counts || []).forEach((l: any) => { cmap[l.photo_id] = (cmap[l.photo_id] || 0) + 1; });
    const liked = new Set((mine || []).map((l: any) => l.photo_id));

    const enriched: GalleryPhoto[] = rows.map((r: any) => ({
      ...r,
      like_count: cmap[r.id] || 0,
      user_liked: liked.has(r.id),
    }));

    setPhotos(prev => {
      const seen = new Set(prev.map(p => p.id));
      return [...prev, ...enriched.filter(p => !seen.has(p.id))];
    });
    if (rows.length < PAGE_SIZE) setHasMore(false);
    setPage(p => p + 1);
    setLoading(false);
  }, [userId, page, hasMore, loading, user]);

  useEffect(() => { loadMore(); /* initial */ }, [userId]); // eslint-disable-line

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // Realtime likes
  useEffect(() => {
    const channel = supabase
      .channel("gallery-photo-likes")
      .on("postgres_changes", { event: "*", schema: "public", table: "photo_likes" }, async (payload: any) => {
        const photoId = (payload.new?.photo_id) || (payload.old?.photo_id);
        if (!photoId) return;
        if (!photos.some(p => p.id === photoId)) return;
        const { data: rows } = await supabase
          .from("photo_likes")
          .select("user_id")
          .eq("photo_id", photoId);
        const count = rows?.length || 0;
        const youLiked = !!user && !!rows?.some((r: any) => r.user_id === user.id);
        setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, like_count: count, user_liked: youLiked } : p));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [photos, user]);

  const toggleLike = async (photo: GalleryPhoto) => {
    if (!user) return;
    const willLike = !photo.user_liked;
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, user_liked: willLike, like_count: p.like_count + (willLike ? 1 : -1) } : p));
    if (willLike) {
      await supabase.from("photo_likes").insert({ user_id: user.id, photo_id: photo.id });
      if (photo.user_id !== user.id) {
        const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).single();
        await supabase.rpc("create_notification", {
          _target_user_id: photo.user_id,
          _type: "photo_like",
          _title: `${me?.name || "Someone"} liked your photo`,
          _message: `${me?.name || "Someone"} liked your photo 📸`,
          _related_id: user.id,
        });
      }
    } else {
      await supabase.from("photo_likes").delete().eq("user_id", user.id).eq("photo_id", photo.id);
    }
  };

  const onDoubleTap = (photo: GalleryPhoto) => {
    const now = Date.now();
    if (lastTapRef.current?.id === photo.id && now - lastTapRef.current.t < 300) {
      if (!photo.user_liked) toggleLike(photo);
      setHeartAnim(photo.id);
      setTimeout(() => setHeartAnim(null), 600);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id: photo.id, t: now };
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-10">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-display text-base font-bold text-foreground truncate">
            {owner ? `${owner.name}'s Gallery` : "Gallery"}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-md">
        {photos.map(photo => {
          const isExpanded = expanded.has(photo.id);
          const caption = photo.caption || "";
          const long = caption.length > 120;
          const shown = isExpanded || !long ? caption : caption.slice(0, 120).trimEnd() + "…";
          return (
            <article key={photo.id} className="border-b border-border">
              <div className="flex items-center gap-2.5 px-4 py-3">
                <DefaultAvatar src={owner?.photo_url} alt={owner?.name || ""} className="h-9 w-9" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground truncate">{owner?.name}</span>
                    {owner?.is_verified && <img src={verifiedBadge} alt="Verified" className="h-3.5 w-3.5" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(photo.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              <div className="relative w-full bg-muted" onClick={() => onDoubleTap(photo)}>
                <img
                  src={photo.image_url}
                  alt={caption || "Gallery photo"}
                  className="w-full max-h-[80vh] object-cover"
                />
                {heartAnim === photo.id && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping">
                    <Heart className="h-20 w-20 fill-red-500 text-red-500 drop-shadow-lg" />
                  </div>
                )}
              </div>

              <div className="px-4 py-2">
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleLike(photo)} className="flex items-center gap-1.5 active:scale-95 transition-transform">
                    <Heart className={`h-6 w-6 ${photo.user_liked ? "fill-destructive text-destructive" : "text-foreground"}`} />
                    <span className="text-sm font-medium text-foreground">{photo.like_count}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageCircle className="h-6 w-6" />
                    <span className="text-sm">0</span>
                  </div>
                </div>
                {caption && (
                  <p className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">
                    <span className="font-semibold mr-1">{owner?.name}</span>
                    {shown}
                    {long && !isExpanded && (
                      <button
                        onClick={() => setExpanded(prev => new Set(prev).add(photo.id))}
                        className="ml-1 text-xs font-medium text-primary"
                      >
                        See More
                      </button>
                    )}
                  </p>
                )}
              </div>
            </article>
          );
        })}

        {!loading && photos.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-sm text-muted-foreground">No gallery photos yet</p>
          </div>
        )}

        <div ref={sentinelRef} className="h-10" />
        {loading && (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {!hasMore && photos.length > 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">You've reached the end</p>
        )}
      </div>
    </div>
  );
};

export default GalleryFeedPage;
