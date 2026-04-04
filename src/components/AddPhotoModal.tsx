import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";

interface AddPhotoModalProps {
  currentCount: number;
  onClose: () => void;
  onAdded: () => void;
}

const AddPhotoModal = ({ currentCount, onClose, onAdded }: AddPhotoModalProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    const compressed = await compressImage(f);
    setFile(compressed);
    setPreview(URL.createObjectURL(compressed));
  };

  const handleSubmit = async () => {
    if (!user || !file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/gallery_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: false });
    if (uploadError) { toast.error("Upload failed: " + uploadError.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(path);
    const { error: insertError } = await supabase.from("profile_photos").insert({ user_id: user.id, image_url: urlData.publicUrl, caption: caption.trim() || null });
    if (insertError) { toast.error("Failed to save photo"); setUploading(false); return; }
    toast.success("Photo added!");
    setUploading(false);
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-background overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-base font-bold text-foreground">Add Photo</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {preview ? (
            <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
              <img src={preview} alt="Preview" className="h-full w-full object-cover" />
              <button onClick={() => { setFile(null); setPreview(null); }} className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50 hover:border-primary/50">
              <Camera className="h-8 w-8 text-muted-foreground" />
              <span className="mt-2 text-sm text-muted-foreground">Tap to select photo</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption (optional)" maxLength={200} rows={2} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none" />
          <button onClick={handleSubmit} disabled={!file || uploading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50">
            {uploading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading..." : "Add Photo"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPhotoModal;
