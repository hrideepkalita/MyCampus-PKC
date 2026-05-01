import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Photo {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  like_count: number;
  user_liked: boolean;
}

interface PhotoGalleryProps {
  photos: Photo[];
  onPhotoLiked: () => void;
  ownerName: string;
}

const PhotoGallery = ({ photos, onPhotoLiked, ownerName }: PhotoGalleryProps) => {
  const { user } = useAuth();
  const [expandedCaption, setExpandedCaption] = useState<string | null>(null);
  const [heartAnimId, setHeartAnimId] = useState<string | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  const handleDoubleTap = useCallback(
    async (photo: Photo) => {
      if (!user || photo.user_liked) return;
      setHeartAnimId(photo.id);
      setTimeout(() => setHeartAnimId(null), 800);

      await supabase.from("photo_likes").insert({ user_id: user.id, photo_id: photo.id });

      // Send notification
      if (photo.user_id !== user.id) {
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();
        const myName = myProfile?.name || "Someone";
        await supabase.rpc("create_notification", {
          _target_user_id: photo.user_id,
          _type: "photo_like",
          _title: `${myName} liked your photo`,
          _message: `${myName} liked your photo 📸`,
          _related_id: user.id,
        });
      }
      onPhotoLiked();
    },
    [user, onPhotoLiked]
  );

  const handleTap = useCallback(
    (photo: Photo) => {
      const now = Date.now();
      if (lastTapRef.current && lastTapRef.current.id === photo.id && now - lastTapRef.current.time < 300) {
        handleDoubleTap(photo);
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { id: photo.id, time: now };
      }
    },
    [handleDoubleTap]
  );

  const handleLikeToggle = async (photo: Photo) => {
    if (!user) return;
    if (photo.user_liked) {
      await supabase.from("photo_likes").delete().eq("user_id", user.id).eq("photo_id", photo.id);
    } else {
      await supabase.from("photo_likes").insert({ user_id: user.id, photo_id: photo.id });
      if (photo.user_id !== user.id) {
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();
        const myName = myProfile?.name || "Someone";
        await supabase.from("notifications").insert({
          user_id: photo.user_id,
          type: "photo_like",
          title: `${myName} liked your photo`,
          message: `${myName} liked your photo 📸`,
          related_id: user.id,
        });
      }
    }
    onPhotoLiked();
  };

  if (photos.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Photos</p>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {photos.map((photo) => (
          <div key={photo.id} className="relative flex-shrink-0 w-[50vw] max-w-[200px]">
            <div
              className="relative aspect-[3/4] overflow-hidden rounded-xl"
              onClick={() => handleTap(photo)}
            >
              <img
                src={photo.image_url}
                alt="Gallery"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {/* Heart animation on double tap */}
              <AnimatePresence>
                {heartAnimId === photo.id && (
                  <motion.div
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Heart className="h-16 w-16 fill-white text-white drop-shadow-lg" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Like button overlay */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLikeToggle(photo);
                }}
                className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 backdrop-blur-sm"
              >
                <Heart
                  className={`h-3.5 w-3.5 transition-colors ${
                    photo.user_liked ? "fill-red-500 text-red-500" : "text-white"
                  }`}
                />
                {photo.like_count > 0 && (
                  <span className="text-[10px] font-medium text-white">{photo.like_count}</span>
                )}
              </button>
            </div>

            {/* Caption */}
            {photo.caption && (
              <div className="mt-1 px-0.5">
                <p
                  className={`text-[11px] text-muted-foreground ${
                    expandedCaption !== photo.id ? "line-clamp-2" : ""
                  }`}
                >
                  {photo.caption}
                </p>
                {photo.caption.length > 60 && expandedCaption !== photo.id && (
                  <button
                    onClick={() => setExpandedCaption(photo.id)}
                    className="text-[10px] font-medium text-primary"
                  >
                    Read more
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PhotoGallery;
