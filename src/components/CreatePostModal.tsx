import { useState, useRef } from "react";
import { X, Image, Video, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "sonner";

interface CreatePostModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreatePostModal = ({ onClose, onCreated }: CreatePostModalProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");

    if (!isVideo && !isImage) {
      toast.error("Please select an image or video");
      return;
    }

    if (isVideo && f.size > 50 * 1024 * 1024) {
      toast.error("Video must be under 50MB");
      return;
    }

    if (isImage && f.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    let processedFile = f;
    if (isImage) {
      processedFile = await compressImage(f);
    }

    setFile(processedFile);
    setMediaType(isVideo ? "video" : "image");
    setPreview(URL.createObjectURL(processedFile));
  };

  const handleSubmit = async () => {
    if (!user || !file) return;
    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);

      const { error: insertError } = await supabase.from("posts").insert({
        user_id: user.id,
        content: caption.trim() || null,
        media_url: urlData.publicUrl,
        media_type: mediaType,
      });

      if (insertError) throw insertError;

      toast.success("Post created!");
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create post");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-background overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-base font-bold text-foreground">New Post</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {preview ? (
            <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
              {mediaType === "video" ? (
                <video src={preview} className="h-full w-full object-cover" controls />
              ) : (
                <img src={preview} alt="Preview" className="h-full w-full object-cover" />
              )}
              <button
                onClick={() => { setFile(null); setPreview(null); }}
                className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary/50"
            >
              <div className="flex gap-3">
                <Image className="h-8 w-8 text-muted-foreground" />
                <Video className="h-8 w-8 text-muted-foreground" />
              </div>
              <span className="mt-2 text-sm text-muted-foreground">Tap to select photo or video</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />

          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Write a caption..."
            maxLength={500}
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
          />

          <button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {uploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePostModal;
