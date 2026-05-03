import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Plus, Heart, Flag, Trash2, MessageCircle, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import SwipeWrapper from "@/components/SwipeWrapper";

const ADMIN_EMAIL = "rangiavlog@gmail.com";

interface ConfessionRow {
  id: string;
  text: string;
  tag: string;
  created_at: string;
  is_anonymous: boolean;
  user_id: string;
  status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  like_count: number;
  user_liked: boolean;
  user_reported: boolean;
  author_name?: string;
}

interface Reply {
  id: string;
  confession_id: string;
  user_id: string;
  reply_text: string;
  created_at: string;
  author_name?: string;
}

const tagConfig: Record<string, { emoji: string; bg: string }> = {
  crush: { emoji: "💘", bg: "bg-[hsl(var(--confession-pink))]" },
  secret: { emoji: "🤫", bg: "bg-[hsl(var(--confession-yellow))]" },
  general: { emoji: "💬", bg: "bg-[hsl(var(--confession-blue))]" },
  compliment: { emoji: "💌", bg: "bg-[hsl(var(--confession-blue))]" },
  "guess-who": { emoji: "👀", bg: "bg-[hsl(var(--confession-yellow))]" },
};

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const reviewDuration = (created: string, reviewed: string) => {
  const diff = new Date(reviewed).getTime() - new Date(created).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

type Tab = "latest" | "trending";

const ConfessionsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [tab, setTab] = useState<Tab>("latest");
  const [showCompose, setShowCompose] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTag, setNewTag] = useState("crush");
  const [confessions, setConfessions] = useState<ConfessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [openReplies, setOpenReplies] = useState<Set<string>>(new Set());
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [lastPostTime, setLastPostTime] = useState(0);

  useEffect(() => { fetchConfessions(); }, [user]);

  // Realtime: listen for confession updates (admin approvals)
  useEffect(() => {
    const channel = supabase
      .channel("confessions-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "confessions" }, (payload) => {
        const updated = payload.new as any;
        if (updated.status === "approved") {
          // Refresh to pick up newly approved confessions
          fetchConfessions();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchConfessions = async () => {
    if (!user) return;

    const { data: rowsData, error } = await supabase
      .from("confessions_safe" as any)
      .select("id, text, tag, created_at, user_id, is_anonymous, status, reviewed_at, reviewed_by")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) console.error("[Confessions] Fetch error:", error);
    const rows = (rowsData || []) as unknown as Array<{
      id: string; text: string; tag: string; created_at: string;
      user_id: string | null; is_anonymous: boolean;
      status: string; reviewed_at: string | null; reviewed_by: string | null;
    }>;

    if (!rows || rows.length === 0) { setConfessions([]); setLoading(false); return; }

    const confessionIds = rows.map(r => r.id);
    const { data: allLikes } = await supabase
      .from("confession_likes")
      .select("confession_id, user_id")
      .in("confession_id", confessionIds);

    const { data: userReports } = await supabase
      .from("confession_reports")
      .select("confession_id")
      .eq("user_id", user.id);

    const reportedSet = new Set((userReports || []).map(r => r.confession_id));

    const nonAnonUserIds = [...new Set(rows.filter(r => !r.is_anonymous && r.user_id).map(r => r.user_id!))];
    let nameMap = new Map<string, string>();
    if (nonAnonUserIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", nonAnonUserIds);
      nameMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
    }

    const likeCounts: Record<string, number> = {};
    const userLikes = new Set<string>();
    (allLikes || []).forEach(l => {
      likeCounts[l.confession_id] = (likeCounts[l.confession_id] || 0) + 1;
      if (l.user_id === user.id) userLikes.add(l.confession_id);
    });

    setConfessions(rows.map(r => ({
      ...r,
      user_id: r.user_id || "",
      is_anonymous: r.is_anonymous ?? true,
      status: r.status || "pending",
      reviewed_at: r.reviewed_at,
      reviewed_by: r.reviewed_by,
      like_count: likeCounts[r.id] || 0,
      user_liked: userLikes.has(r.id),
      user_reported: reportedSet.has(r.id),
      author_name: r.is_anonymous ? undefined : (r.user_id ? nameMap.get(r.user_id) : undefined),
    })));
    setLoading(false);
  };

  const fetchReplies = async (confessionId: string) => {
    const { data } = await supabase
      .from("confession_replies").select("*")
      .eq("confession_id", confessionId)
      .order("created_at", { ascending: true }).limit(50);
    if (!data) return;
    const userIds = [...new Set(data.map(r => r.user_id))];
    let nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
      nameMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
    }
    setReplies(prev => ({
      ...prev,
      [confessionId]: data.map(r => ({ ...r, author_name: nameMap.get(r.user_id) || "Anonymous" })),
    }));
  };

  const toggleReplies = (confessionId: string) => {
    const newSet = new Set(openReplies);
    if (newSet.has(confessionId)) { newSet.delete(confessionId); }
    else { newSet.add(confessionId); if (!replies[confessionId]) fetchReplies(confessionId); }
    setOpenReplies(newSet);
  };

  const handlePostReply = async (confessionId: string) => {
    if (!user || !replyText[confessionId]?.trim()) return;
    await supabase.from("confession_replies").insert({
      confession_id: confessionId, user_id: user.id, reply_text: replyText[confessionId].trim(),
    });
    setReplyText(prev => ({ ...prev, [confessionId]: "" }));
    fetchReplies(confessionId);
  };

  const handlePost = async () => {
    if (!user || !newText.trim()) return;
    // Rate limit: 1 confession per 5 minutes
    const now = Date.now();
    if (now - lastPostTime < 5 * 60 * 1000) {
      toast.error("Please wait 5 minutes between confessions");
      return;
    }
    await supabase.from("confessions").insert({
      user_id: user.id, text: newText.trim(), tag: newTag, is_anonymous: true,
    });
    setLastPostTime(now);
    setShowCompose(false);
    setNewText("");
    toast.success("Confession submitted! It will appear after admin review.");
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
      c.id === confessionId ? { ...c, user_liked: !liked, like_count: liked ? c.like_count - 1 : c.like_count + 1 } : c
    ));
  };

  const handleReport = async (confessionId: string) => {
    if (!user) return;
    const { error } = await supabase.from("confession_reports").insert({ user_id: user.id, confession_id: confessionId });
    if (!error) {
      toast.success("Reported. We'll review it.");
      setConfessions(prev => prev.map(c => c.id === confessionId ? { ...c, user_reported: true } : c));
    } else { toast.error("Already reported"); }
  };

  const handleDelete = async (confessionId: string) => {
    await supabase.from("confessions").delete().eq("id", confessionId);
    setConfessions(prev => prev.filter(c => c.id !== confessionId));
    toast.success("Confession deleted");
  };

  const handleAdminAction = async (confessionId: string, action: "approved" | "rejected") => {
    if (!user) return;
    // Use direct update since admin has UPDATE policy
    const { error } = await supabase
      .from("confessions")
      .update({ status: action, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq("id", confessionId);
    if (error) { toast.error("Failed: " + error.message); return; }

    setConfessions(prev => prev.map(c =>
      c.id === confessionId ? { ...c, status: action, reviewed_at: new Date().toISOString(), reviewed_by: user.id } : c
    ));

    // Notify the confession author
    const confession = confessions.find(c => c.id === confessionId);
    if (confession?.user_id) {
      await supabase.rpc("create_notification", {
        _target_user_id: confession.user_id,
        _type: "general",
        _title: action === "approved" ? "Confession Approved ✅" : "Confession Rejected ❌",
        _message: action === "approved"
          ? "Your confession has been approved and is now visible to everyone!"
          : "Your confession was rejected by the admin.",
        _related_id: confessionId,
      });
    }
    toast.success(`Confession ${action}!`);
  };

  // Filter: regular users see only approved + their own pending; admin sees all
  const visibleConfessions = confessions.filter(c => {
    if (isAdmin) return true;
    return c.status === "approved" || (c.user_id === user?.id);
  });

  const sorted = tab === "trending"
    ? [...visibleConfessions].sort((a, b) => b.like_count - a.like_count)
    : visibleConfessions;

  // Pending confessions for admin panel at top
  const pendingForAdmin = isAdmin ? confessions.filter(c => c.status === "pending") : [];

  return (
    <SwipeWrapper next="/lost-found" prev="/notices" className="min-h-[100dvh] bg-background pb-24">
      <TopBar
        title="Confessions"
        rightContent={
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-90 transition-transform"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      />
      <div className="mx-auto flex max-w-md gap-2 px-4 py-2">
        <button onClick={() => setTab("latest")} className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${tab === "latest" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
          Latest
        </button>
        <button onClick={() => setTab("trending")} className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${tab === "trending" ? "bg-secondary text-secondary-foreground" : "bg-card text-muted-foreground"}`}>
          <Flame className="h-3 w-3" /> Trending
        </button>
      </div>

      {showCompose && (
        <div className="mx-auto max-w-md px-4 pt-2 animate-slide-up">
          <div className="rounded-2xl bg-card p-4">
            <textarea value={newText} onChange={(e) => setNewText(e.target.value)}
              placeholder="Write your anonymous confession..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none" rows={3} />
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {["crush", "secret", "general", "compliment", "guess-who"].map((t) => (
                <button key={t} onClick={() => setNewTag(t)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${newTag === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground border border-border"}`}>
                  {t}
                </button>
              ))}
            </div>
            <button onClick={handlePost}
              className="mt-3 w-full rounded-xl bg-primary py-2 text-sm font-display font-bold text-primary-foreground active:scale-[0.98]">
              Post Anonymously
            </button>
          </div>
        </div>
      )}

      {/* Admin pending queue */}
      {isAdmin && pendingForAdmin.length > 0 && (
        <div className="mx-auto max-w-md px-4 pt-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            ⏳ Pending Review ({pendingForAdmin.length})
          </h3>
          <div className="space-y-2 mb-4">
            {pendingForAdmin.map(c => (
              <div key={c.id} className="rounded-2xl bg-card border border-yellow-500/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-medium text-yellow-600">
                    {tagConfig[c.tag]?.emoji} {c.tag}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                  {c.user_id && <span className="text-[9px] text-destructive/60 font-mono">UID: {c.user_id.slice(0, 8)}</span>}
                </div>
                <p className="text-sm text-foreground mb-3">{c.text}</p>
                <div className="flex gap-2">
                  <button onClick={() => handleAdminAction(c.id, "approved")}
                    className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-accent py-2 text-xs font-bold text-accent-foreground active:scale-[0.98]">
                    <CheckCircle className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button onClick={() => handleAdminAction(c.id, "rejected")}
                    className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-destructive py-2 text-xs font-bold text-destructive-foreground active:scale-[0.98]">
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-md space-y-3 px-4 pt-3">
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
            const confReplies = replies[confession.id] || [];
            const isOpen = openReplies.has(confession.id);
            const isOwn = confession.user_id === user?.id;
            const isPending = confession.status === "pending";
            const isRejected = confession.status === "rejected";

            return (
              <div key={confession.id} className={`rounded-2xl p-4 ${config.bg} animate-slide-up ${isPending ? "opacity-70" : ""} ${isRejected ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
                      {config.emoji} {confession.tag}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {confession.is_anonymous ? "Anonymous" : confession.author_name || "Unknown"}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(confession.created_at)}</span>
                </div>

                {/* Status badge for own pending/rejected confessions */}
                {isOwn && isPending && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-yellow-500/10 px-2 py-1">
                    <Clock className="h-3 w-3 text-yellow-600" />
                    <span className="text-[10px] text-yellow-600 font-medium">Under Review • Est. 5–10 min</span>
                  </div>
                )}
                {isOwn && isRejected && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2 py-1">
                    <XCircle className="h-3 w-3 text-destructive" />
                    <span className="text-[10px] text-destructive font-medium">
                      Rejected{confession.reviewed_at ? ` • Reviewed in ${reviewDuration(confession.created_at, confession.reviewed_at)}` : ""}
                    </span>
                  </div>
                )}
                {isOwn && confession.status === "approved" && confession.reviewed_at && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-accent/20 px-2 py-1">
                    <CheckCircle className="h-3 w-3 text-accent" />
                    <span className="text-[10px] text-accent font-medium">
                      Approved • Reviewed in {reviewDuration(confession.created_at, confession.reviewed_at)}
                    </span>
                  </div>
                )}

                {isAdmin && confession.is_anonymous && confession.user_id && (
                  <p className="mt-1 text-[10px] text-destructive/70">🔒 UID: {confession.user_id.slice(0, 8)}...</p>
                )}
                <p className="mt-3 text-sm leading-relaxed text-foreground">{confession.text}</p>

                {/* Only show actions for approved confessions */}
                {confession.status === "approved" && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleLike(confession.id, confession.user_liked)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95 ${confession.user_liked ? "bg-secondary/15 text-secondary" : "bg-background/50 text-muted-foreground"}`}>
                        <Heart className="h-3.5 w-3.5" fill={confession.user_liked ? "currentColor" : "none"} />
                        {confession.like_count}
                      </button>
                      <button onClick={() => toggleReplies(confession.id)}
                        className="flex items-center gap-1 rounded-full bg-background/50 px-3 py-1 text-xs font-medium text-muted-foreground active:scale-95">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {confReplies.length > 0 ? confReplies.length : "Reply"}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {!confession.user_reported && (
                        <button onClick={() => handleReport(confession.id)}
                          className="rounded-full p-1.5 text-muted-foreground/50 hover:text-destructive transition-colors">
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDelete(confession.id)}
                          className="rounded-full p-1.5 text-muted-foreground/50 hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Replies section */}
                {isOpen && (
                  <div className="mt-3 space-y-2 border-t border-border/30 pt-3">
                    {confReplies.map((r) => (
                      <div key={r.id} className="rounded-xl bg-background/40 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-foreground">{r.author_name}</span>
                          <span className="text-[9px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-foreground">{r.reply_text}</p>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={replyText[confession.id] || ""}
                        onChange={(e) => setReplyText(prev => ({ ...prev, [confession.id]: e.target.value }))}
                        placeholder="Write a reply..."
                        className="flex-1 rounded-xl border border-border/50 bg-background/60 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                        onKeyDown={(e) => e.key === "Enter" && handlePostReply(confession.id)} />
                      <button onClick={() => handlePostReply(confession.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-90">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </SwipeWrapper>
  );
};

export default ConfessionsPage;
