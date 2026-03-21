import { useState, useEffect, useRef } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, MapPin, Camera, Check, X, Search, ArrowLeft, Phone, Upload } from "lucide-react";
import { toast } from "sonner";

interface LostFoundItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  location: string | null;
  contact_info: string;
  image_url: string | null;
  is_resolved: boolean;
  created_at: string;
  profile_name?: string;
  profile_photo?: string;
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
  const [contactInfo, setContactInfo] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
  }, [user]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("lost_found")
      .select("*")
      .eq("is_resolved", false)
      .order("created_at", { ascending: false })
      .limit(100);

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((i) => i.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, photo_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      setItems(
        data.map((i) => ({
          ...(i as LostFoundItem),
          profile_name: profileMap.get(i.user_id)?.name || "Anonymous",
          profile_photo: profileMap.get(i.user_id)?.photo_url || undefined,
        }))
      );
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `lost-found/${user.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file);

    if (error) {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    setImageFile(file);
    setImagePreviewUrl(urlData.publicUrl + "?t=" + Date.now());
    toast.success("Image uploaded");
    setUploading(false);
    e.target.value = "";
  };

  const handlePost = async () => {
    if (!user || !title.trim() || !description.trim() || !contactInfo.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setPosting(true);

    const { error } = await supabase.from("lost_found").insert({
      user_id: user.id,
      type: formType,
      title: title.trim(),
      description: description.trim(),
      contact_info: contactInfo.trim(),
      location: location.trim() || null,
      image_url: imagePreviewUrl,
    });

    if (error) {
      toast.error("Failed to post");
    } else {
      toast.success("Posted successfully!");
      setShowForm(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setContactInfo("");
      setImageFile(null);
      setImagePreviewUrl(null);
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
    <div className="min-h-[100dvh] bg-background pb-24">
      {/* Fullscreen detail view */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setSelectedItem(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="font-display text-lg font-bold text-foreground">
              {selectedItem.type === "lost" ? "Lost Item" : "Found Item"}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {selectedItem.image_url && (
              <div className="w-full aspect-video bg-muted overflow-hidden">
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  {selectedItem.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Posted by {selectedItem.profile_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(selectedItem.created_at)}
                </p>
              </div>

              <div className="bg-card rounded-xl p-3">
                <p className="text-sm text-foreground">{selectedItem.description}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{selectedItem.contact_info}</span>
                </div>
                {selectedItem.location && (
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{selectedItem.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
            onClick={() => setShowForm(!showForm)}
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
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => {
                setShowForm(false);
                setImagePreviewUrl(null);
                setImageFile(null);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="font-display text-lg font-bold text-foreground">Post Item</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Type</label>
              <div className="flex gap-2">
                {(["lost", "found"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFormType(t)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      formType === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground border border-border"
                    }`}
                  >
                    {t === "lost" ? "Lost" : "Found"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Blue Backpack"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the item in detail..."
                rows={3}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Contact Info *</label>
              <input
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Phone or Instagram handle"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where was it lost/found?"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Photo (Optional)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {imagePreviewUrl ? (
                <div className="relative h-32 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => {
                      setImagePreviewUrl(null);
                      setImageFile(null);
                    }}
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "Uploading..." : "Upload Photo"}
                </button>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border p-4 flex gap-2">
            <button
              onClick={() => {
                setShowForm(false);
                setImagePreviewUrl(null);
                setImageFile(null);
              }}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card"
            >
              Cancel
            </button>
            <button
              onClick={handlePost}
              disabled={posting}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors disabled:opacity-50"
            >
              {posting ? "Posting..." : "Post"}
            </button>
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
              onClick={() => setSelectedItem(item)}
              className={`rounded-2xl bg-card p-3 cursor-pointer transition-all hover:bg-card/90 active:scale-[0.98] ${
                item.is_resolved ? "opacity-60" : ""
              }`}
            >
              <div className="flex gap-3">
                {item.image_url && (
                  <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.type === "lost"
                          ? "bg-destructive/20 text-destructive"
                          : "bg-accent/20 text-accent"
                      }`}
                    >
                      {item.type === "lost" ? "Lost" : "Found"}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {timeAgo(item.created_at)}
                    </span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-foreground truncate">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-5 w-5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                      {item.profile_photo ? (
                        <img
                          src={item.profile_photo}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[8px]">
                          ?
                        </div>
                      )}
                    </div>
                    <span className="truncate">{item.profile_name}</span>
                  </div>
                </div>
              </div>

              {user?.id === item.user_id && !item.is_resolved && (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResolve(item.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-accent/10 py-2 text-xs font-medium text-accent"
                  >
                    <Check className="h-3 w-3" /> Resolved
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
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
