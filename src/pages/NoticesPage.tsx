import { useState, useEffect, useRef } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Image, X } from "lucide-react";
import { toast } from "sonner";
import SwipeWrapper from "@/components/SwipeWrapper";

interface Notice {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
  author_name?: string;
}

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const NoticesPage = () => {
  const { user } = useAuth();
  
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [canPost, setCanPost] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchNotices();
    checkPermission();
  }, [user]);

  const checkPermission = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("is_verified, role")
      .eq("id", user.id)
      .single();
    if (data && (data as any).is_verified && (data as any).role === "union") {
      setCanPost(true);
    }
  };

  const fetchNotices = async () => {
    const { data } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((n) => n.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      const nameMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);
      setNotices(data.map((n) => ({ ...n, author_name: nameMap.get(n.user_id) || "Unknown" })));
    } else {
      setNotices([]);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("notices").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("notices").getPublicUrl(path);
    setImageUrl(urlData.publicUrl);
    setUploading(false);
    e.target.value = "";
  };

  const handlePost = async () => {
    if (!user || !canPost || !title.trim() || !description.trim()) {
      if (!canPost) toast.error("Only verified union members can post notices");
      return;
    }
    await supabase.from("notices").insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      image_url: imageUrl,
    });
    setShowCompose(false);
    setTitle("");
    setDescription("");
    setImageUrl(null);
    toast.success("Notice posted!");
    fetchNotices();
  };

  return (
    <SwipeWrapper next="/confessions" prev="/friends" className="min-h-[100dvh] bg-background pb-24">
      {/* Fullscreen notice */} 
      {selectedNotice && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-auto">
          <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
            <button onClick={() => setSelectedNotice(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
            <h2 className="font-display text-base font-bold text-foreground truncate">{selectedNotice.title}</h2>
          </div>
          {selectedNotice.image_url && (
            <img src={selectedNotice.image_url} alt="" className="w-full max-h-[50vh] object-contain bg-muted" />
          )}
          <div className="px-4 py-4">
            <h1 className="font-display text-xl font-bold text-foreground">{selectedNotice.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              By {selectedNotice.author_name} · {timeAgo(selectedNotice.created_at)}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">{selectedNotice.description}</p>
          </div>
        </div>
      )}

      <TopBar
        title="Notices"
        rightContent={
          user && canPost ? (
            <button
              onClick={() => setShowCompose(prev => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-90 transition-transform"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null
        }
      />

      {showCompose && (
        <div className="mx-auto max-w-md px-4 pt-2 animate-slide-up">
          <div className="rounded-2xl bg-card p-4 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notice title..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write your notice..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
              rows={3}
            />
            {imageUrl && (
              <div className="relative">
                <img src={imageUrl} alt="Preview" className="w-full rounded-xl max-h-40 object-cover" />
                <button onClick={() => setImageUrl(null)} className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground disabled:opacity-50"
              >
                <Image className="h-3.5 w-3.5" /> {uploading ? "Uploading..." : "Add Image"}
              </button>
              <button
                onClick={handlePost}
                disabled={!title.trim() || !description.trim()}
                className="flex-1 rounded-xl bg-primary py-2 text-sm font-display font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
              >
                Post Notice
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-md space-y-3 px-4 pt-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : notices.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="text-5xl">📢</span>
            <p className="mt-4 font-display text-lg font-bold text-foreground">No notices yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Notices will appear here</p>
          </div>
        ) : (
          notices.map((notice) => (
            <button
              key={notice.id}
              onClick={() => setSelectedNotice(notice)}
              className="w-full text-left rounded-2xl bg-card p-4 transition-all active:scale-[0.98]"
            >
              {notice.image_url && (
                <img src={notice.image_url} alt="" className="w-full rounded-xl max-h-40 object-cover mb-3" />
              )}
              <h3 className="font-display text-sm font-bold text-foreground">{notice.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{notice.description}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {notice.author_name} · {timeAgo(notice.created_at)}
              </p>
            </button>
          ))
        )}
      </div>

      <BottomNav />
    </SwipeWrapper>
  );
};

export default NoticesPage;
