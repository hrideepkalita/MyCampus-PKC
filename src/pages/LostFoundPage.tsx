import { useState, useEffect, useRef } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, MapPin, Camera, Check, X, Search } from "lucide-react";
import { toast } from "sonner";
import SwipeWrapper from "@/components/SwipeWrapper";

interface LostFoundItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  location: string | null;
  image_url: string | null;
  is_resolved: boolean;
  created_at: string;
}

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const LostFoundPage = () => {
  const { user } = useAuth();
  
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"all" | "lost" | "found">("all");
  const [formType, setFormType] = useState<"lost" | "found">("lost");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
  }, [user]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("lost_found")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as LostFoundItem[]) || []);
    setLoading(false);
  };

  const handlePost = async () => {
    if (!user || !title.trim() || !description.trim()) {
      toast.error("Please fill in title and description");
      return;
    }
    setPosting(true);

    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("lost-found").upload(path, imageFile);
      if (!error) {
        const { data: urlData } = supabase.storage.from("lost-found").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("lost_found").insert({
      user_id: user.id,
      type: formType,
      title: title.trim(),
      description: description.trim(),
      location: location.trim() || null,
      image_url: imageUrl,
    });

    if (error) {
      toast.error("Failed to post");
    } else {
      toast.success("Posted successfully!");
      setShowForm(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setImageFile(null);
      fetchItems();
    }
    setPosting(false);
  };

  const handleResolve = async (id: string) => {
    await supabase.from("lost_found").update({ is_resolved: true }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_resolved: true } : i)));
    toast.success("Marked as resolved!");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("lost_found").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Post deleted");
  };

  const filtered = tab === "all" ? items : items.filter((i) => i.type === tab);

  return (
    <SwipeWrapper prev="/confessions" className="min-h-[100dvh] bg-background pb-24">
      {/* Fullscreen image modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
          />
        </div>
      )}

      <TopBar
        title="Lost & Found"
        rightContent={
          <button
            onClick={() => setShowForm(prev => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-90 transition-transform"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      />

      {/* Filter tabs */}
      <div className="mx-auto flex max-w-md gap-1 px-4 py-2">
        {(["all", "lost", "found"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold capitalize transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t === "all" ? "All" : t === "lost" ? "🔍 Lost" : "📦 Found"}
          </button>
        ))}
      </div>

      {/* Post form */}
      {showForm && (
  <div className="fixed inset-0 z-[100] bg-background overflow-auto pt-16">
        <div className="mx-auto max-w-md px-4 pt-2 animate-slide-up">
          <div className="rounded-2xl bg-card p-4 space-y-3">
            <div className="flex gap-2">
              {(["lost", "found"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFormType(t)}
                  className={`flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition-colors ${
                    formType === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground border border-border"
                  }`}
                >
                  {t === "lost" ? "🔍 I Lost" : "📦 I Found"}
                </button>
              ))}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Item name"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the item..."
              rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (e.g. Library, Canteen)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
              >
                <Camera className="h-3.5 w-3.5" />
                {imageFile ? imageFile.name.slice(0, 20) : "Add photo"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            </div>
            <button
              onClick={handlePost}
              disabled={posting}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-display font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
            >
              {posting ? "Posting..." : "Post"}
            </button>
            </div>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="mx-auto max-w-md space-y-3 px-4 pt-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Search className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 font-display text-lg font-bold text-foreground">No items yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Post a lost or found item to get started</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl bg-card p-4 ${item.is_resolved ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    item.type === "lost"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-accent/10 text-accent"
                  }`}
                >
                  {item.type === "lost" ? "🔍 Lost" : "📦 Found"}
                </span>
                <span className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
              </div>
              <h3 className="mt-2 font-display text-sm font-bold text-foreground">{item.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              {item.location && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {item.location}
                </div>
              )}
              {item.image_url && (
                <button
                  onClick={() => setPreviewImage(item.image_url)}
                  className="mt-3 w-full overflow-hidden rounded-xl"
                >
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full max-h-[50vh] rounded-xl object-cover"
                  />
                </button>
              )}
              {item.is_resolved && (
                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-accent">
                  <Check className="h-3.5 w-3.5" /> Resolved
                </div>
              )}
              {user?.id === item.user_id && !item.is_resolved && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleResolve(item.id)}
                    className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-accent/10 py-2 text-xs font-medium text-accent"
                  >
                    <Check className="h-3 w-3" /> Mark Resolved
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex items-center justify-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default LostFoundPage;
