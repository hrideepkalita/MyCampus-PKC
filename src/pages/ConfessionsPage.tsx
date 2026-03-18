import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Plus, Heart, Flag } from "lucide-react";

interface ConfessionRow {
  id: string;
  text: string;
  tag: string;
  created_at: string;
  like_count: number;
  user_liked: boolean;
}

const tagConfig: Record<string, { emoji: string; bg: string }> = {
  crush: { emoji: "💘", bg: "bg-confession-pink" },
  secret: { emoji: "🤫", bg: "bg-confession-yellow" },
  compliment: { emoji: "💌", bg: "bg-confession-blue" },
  "guess-who": { emoji: "👀", bg: "bg-confession-yellow" },
};

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

type Tab = "latest" | "trending";

const ConfessionsPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("latest");
  const [showCompose, setShowCompose] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTag, setNewTag] = useState("crush");
  const [confessions, setConfessions] = useState<ConfessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfessions();
  }, [user]);

  const fetchConfessions = async () => {
    if (!user) return;

    const { data: rows } = await supabase
      .from("confessions")
      .select("id, text, tag, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!rows) { setLoading(false); return; }

    // Get like counts
    const confessionIds = rows.map(r => r.id);
    const { data: allLikes } = await supabase
      .from("confession_likes")
      .select("confession_id, user_id")
      .in("confession_id", confessionIds);

    const likeCounts: Record<string, number> = {};
    const userLikes = new Set<string>();
    (allLikes || []).forEach(l => {
      likeCounts[l.confession_id] = (likeCounts[l.confession_id] || 0) + 1;
      if (l.user_id === user.id) userLikes.add(l.confession_id);
    });

    setConfessions(rows.map(r => ({
      ...r,
      like_count: likeCounts[r.id] || 0,
      user_liked: userLikes.has(r.id),
    })));
    setLoading(false);
  };

  const handlePost = async () => {
    if (!user || !newText.trim()) return;
    await supabase.from("confessions").insert({
      user_id: user.id,
      text: newText.trim(),
      tag: newTag,
    });
    setShowCompose(false);
    setNewText("");
    fetchConfessions();
  };

  const handleLike = async (confessionId: string, liked: boolean) => {
    if (!user) return;
    if (liked) {
      await supabase.from("confession_likes").delete().eq("confession_id", confessionId).eq("user_id", user.id);
    } else {
      await supabase.from("confession_likes").insert({ confession_id: confessionId, user_id: user.id });
    }
    setConfessions(prev => prev.map(c =>
      c.id === confessionId
        ? { ...c, user_liked: !liked, like_count: liked ? c.like_count - 1 : c.like_count + 1 }
        : c
    ));
  };

  const sorted = tab === "trending"
    ? [...confessions].sort((a, b) => b.like_count - a.like_count)
    : confessions;

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="font-display text-lg font-bold text-foreground">Confessions</h1>
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-90 transition-transform"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mx-auto flex max-w-md gap-2 px-4 pb-3">
          <button
            onClick={() => setTab("latest")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === "latest" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            Latest
          </button>
          <button
            onClick={() => setTab("trending")}
            className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === "trending" ? "bg-pink text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            <Flame className="h-3 w-3" /> Trending
          </button>
        </div>
      </div>

      {showCompose && (
        <div className="mx-auto max-w-md px-4 pt-4 animate-slide-up">
          <div className="rounded-2xl bg-card p-4">
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Write your anonymous confession..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
              rows={3}
            />
            <div className="mt-2 flex items-center gap-2">
              {["crush", "secret", "compliment", "guess-who"].map((t) => (
                <button
                  key={t}
                  onClick={() => setNewTag(t)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    newTag === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground border border-border"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={handlePost}
              className="mt-3 w-full rounded-xl bg-primary py-2 text-sm font-display font-bold text-primary-foreground active:scale-[0.98]"
            >
              Post Anonymously
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-md space-y-3 px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="text-5xl">🤫</span>
            <p className="mt-4 font-display text-lg font-bold text-foreground">No confessions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to share!</p>
          </div>
        ) : (
          sorted.map((confession) => {
            const config = tagConfig[confession.tag] || tagConfig.secret;
            return (
              <div key={confession.id} className={`rounded-2xl p-4 ${config.bg} animate-slide-up`}>
                <div className="flex items-start justify-between">
                  <span className="rounded-full bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
                    {config.emoji} {confession.tag}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(confession.created_at)}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-foreground">{confession.text}</p>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => handleLike(confession.id, confession.user_liked)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95 ${
                      confession.user_liked
                        ? "bg-pink/15 text-pink"
                        : "bg-background/50 text-muted-foreground"
                    }`}
                  >
                    <Heart className="h-3.5 w-3.5" fill={confession.user_liked ? "currentColor" : "none"} />
                    {confession.like_count}
                  </button>
                  <button className="rounded-full p-1.5 text-muted-foreground/50 hover:text-destructive transition-colors">
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ConfessionsPage;
