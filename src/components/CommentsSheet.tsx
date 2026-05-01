import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Send, CornerDownRight, Trash2 } from "lucide-react";
import DefaultAvatar from "@/components/DefaultAvatar";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profile: { name: string; photo_url: string | null; is_verified: boolean };
  replies: Comment[];
}

interface CommentsSheetProps {
  postId: string;
  postOwnerId: string;
  onClose: () => void;
}

const CommentsSheet = ({ postId, postOwnerId, onClose }: CommentsSheetProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchComments = useCallback(async () => {
    const { data: raw } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!raw || raw.length === 0) { setComments([]); setLoading(false); return; }

    const userIds = [...new Set(raw.map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, photo_url, is_verified")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const enriched = raw.map((c: any) => ({
      ...c,
      profile: profileMap.get(c.user_id) || { name: "Unknown", photo_url: null, is_verified: false },
      replies: [] as Comment[],
    }));

    const map = new Map<string, Comment>();
    const roots: Comment[] = [];
    enriched.forEach(c => map.set(c.id, c));
    enriched.forEach(c => {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.replies.push(c);
      } else {
        roots.push(c);
      }
    });

    setComments(roots);
    setLoading(false);
  }, [postId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Focus input on reply
  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    setSending(true);

    const newComment = {
      post_id: postId,
      user_id: user.id,
      parent_id: replyTo?.id || null,
      content: text.trim(),
    };

    const { error } = await supabase.from("comments").insert(newComment);
    if (error) { toast.error("Failed to comment"); setSending(false); return; }

    // Notify post owner
    if (postOwnerId !== user.id) {
      const { data: myP } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      await supabase.from("notifications").insert({
        user_id: postOwnerId,
        type: "comment",
        title: `${myP?.name || "Someone"} commented on your post`,
        message: text.trim().slice(0, 100),
        related_id: postId,
      });
    }

    // Notify parent comment author for replies
    if (replyTo) {
      const parentComment = findCommentById(comments, replyTo.id);
      if (parentComment && parentComment.user_id !== user.id) {
        const { data: myP } = await supabase.from("profiles").select("name").eq("id", user.id).single();
        await supabase.from("notifications").insert({
          user_id: parentComment.user_id,
          type: "comment_reply",
          title: `${myP?.name || "Someone"} replied to your comment`,
          message: text.trim().slice(0, 100),
          related_id: postId,
        });
      }
    }

    setText("");
    setReplyTo(null);
    setSending(false);
    fetchComments();
  };

  const findCommentById = (list: Comment[], id: string): Comment | null => {
    for (const c of list) {
      if (c.id === id) return c;
      const found = findCommentById(c.replies, id);
      if (found) return found;
    }
    return null;
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from("comments").delete().eq("id", commentId);
    fetchComments();
  };

  const renderComment = (comment: Comment, depth = 0) => (
    <div key={comment.id} className={`${depth > 0 ? "ml-8 border-l-2 border-border pl-3" : ""}`}>
      <div className="flex gap-2 py-2 group">
        <DefaultAvatar src={comment.profile.photo_url} alt={comment.profile.name} className="h-7 w-7 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="rounded-xl bg-muted px-3 py-2">
            <p className="text-xs font-semibold text-foreground">{comment.profile.name}</p>
            <p className="text-xs text-foreground mt-0.5 break-words">
            {comment.content} </p>
          </div>
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            <button onClick={() => setReplyTo({ id: comment.id, name: comment.profile.name })} className="text-[10px] font-semibold text-primary">
              Reply
            </button>
            {comment.user_id === user?.id && (
              <button onClick={() => handleDelete(comment.id)} className="text-[10px] text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      {comment.replies.map(r => renderComment(r, depth + 1))}
    </div>
  );

  const totalCount = comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-background flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">       
          <h3 className="font-display text-sm font-bold text-foreground">Comments ({totalCount})</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 pb-20 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">No comments yet. Be the first!</p>
          ) : (
            comments.map(c => renderComment(c))
          )}
        </div>

        {/* Reply indicator */}
        {replyTo && (
          <div className="px-4 py-1.5 bg-muted/50 flex items-center gap-2 border-t border-border flex-shrink-0">
            <CornerDownRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Replying to <span className="font-semibold text-foreground">{replyTo.name}</span></span>
            <button onClick={() => setReplyTo(null)} className="ml-auto">
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Input - always visible */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border flex-shrink-0 bg-background pb-[calc(60px+env(safe-area-inset-bottom))]">
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.name}...` : "Add a comment..."}
            className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            autoComplete="off"
          />
          <button onClick={handleSend} disabled={!text.trim() || sending} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 flex-shrink-0">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentsSheet;
