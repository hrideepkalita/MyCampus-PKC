import { useState, useEffect, useRef, useCallback } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import InterestTag from "@/components/InterestTag";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Edit, Shield, Instagram, Save, X, Camera, Upload } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import verifiedBadge from "@/assets/verified-badge.png";
import { useNavigate } from "react-router-dom";
import { ALL_INTERESTS, LOOKING_FOR_OPTIONS } from "@/lib/mockData";
import { toast } from "sonner";
import PhotoGallery from "@/components/PhotoGallery";
import AddPhotoModal from "@/components/AddPhotoModal";
import FollowersModal from "@/components/FollowersModal";

const ADMIN_EMAIL = "rangiavlog@gmail.com";

interface Profile {
  name: string;
  age: number | null;
  gender: string | null;
  branch: string | null;
  bio: string | null;
  photo_url: string | null;
  photos: string[];
  interests: string[];
  looking_for: string | null;
  verified: string | null;
  is_verified: boolean;
  instagram: string | null;
  phone: string | null;
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

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const verifyInputRef = useRef<HTMLInputElement>(null);

  // Gallery
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [showAddPhoto, setShowAddPhoto] = useState(false);

  // Follow counts & modal (own profile)
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);

  // Admin info
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!user) return;
    fetchProfile();
    fetchVerificationStatus();
    fetchFollowCounts();
    fetchGalleryPhotos();
    if (isAdmin) {
      setAdminEmail(user.email ?? null);
    }
    const handleFocus = () => { fetchProfile(); fetchVerificationStatus(); };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) {
      const p: Profile = {
        name: data.name,
        age: data.age,
        gender: data.gender,
        branch: data.branch,
        bio: data.bio,
        photo_url: data.photo_url,
        photos: (data.photos as string[]) || [],
        interests: (data.interests as string[]) || [],
        looking_for: data.looking_for,
        verified: data.verified,
        is_verified: (data as any).is_verified ?? false,
        instagram: data.instagram,
        phone: data.phone,
      };
      setProfile(p);
      setForm(p);
    }
    setLoading(false);
  };

  const fetchVerificationStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("verification_requests")
      .select("status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      setVerificationStatus(data[0].status);
    }
  };

  const fetchFollowCounts = async () => {
    if (!user) return;
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
    ]);
    setFollowersCount(followers || 0);
    setFollowingCount(following || 0);
  };

  const fetchGalleryPhotos = useCallback(async () => {
    if (!user) return;
    const { data: photos } = await supabase
      .from("profile_photos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!photos || photos.length === 0) {
      setGalleryPhotos([]);
      return;
    }

    const photoIds = photos.map((p: any) => p.id);
    const [{ data: likeCounts }, { data: userLikes }] = await Promise.all([
      supabase.from("photo_likes").select("photo_id").in("photo_id", photoIds),
      supabase.from("photo_likes").select("photo_id").in("photo_id", photoIds).eq("user_id", user.id),
    ]);

    const countMap: Record<string, number> = {};
    (likeCounts || []).forEach((l: any) => {
      countMap[l.photo_id] = (countMap[l.photo_id] || 0) + 1;
    });
    const userLikedSet = new Set((userLikes || []).map((l: any) => l.photo_id));

    setGalleryPhotos(
      photos.map((p: any) => ({
        ...p,
        like_count: countMap[p.id] || 0,
        user_liked: userLikedSet.has(p.id),
      }))
    );
  }, [user]);

  const handleSave = async () => {
    if (!user || !form) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({
        name: form.name,
        age: form.age,
        gender: form.gender,
        branch: form.branch,
        bio: form.bio,
        interests: form.interests,
        looking_for: form.looking_for,
        instagram: form.instagram,
        phone: form.phone,
        photos: form.photos,
      })
      .eq("id", user.id);
    setProfile(form);
    setEditing(false);
    setSaving(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !user) return;
    if (!rawFile.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (rawFile.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    const file = await compressImage(rawFile);
    const ext = file.name.split(".").pop();
    const isMainPhoto = index === undefined;
    const path = isMainPhoto ? `${user.id}/avatar.${ext}` : `${user.id}/photo_${index}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Upload failed: " + uploadError.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const photoUrl = urlData.publicUrl + "?t=" + Date.now();

    if (isMainPhoto) {
      await supabase.from("profiles").update({ photo_url: photoUrl }).eq("id", user.id);
      setProfile(prev => prev ? { ...prev, photo_url: photoUrl } : prev);
      setForm(prev => prev ? { ...prev, photo_url: photoUrl } : prev);
    } else {
      const currentPhotos = [...(profile?.photos || [])];
      currentPhotos[index] = photoUrl;
      const cleanPhotos = currentPhotos.filter(Boolean);
      await supabase.from("profiles").update({ photos: cleanPhotos }).eq("id", user.id);
      setProfile(prev => prev ? { ...prev, photos: cleanPhotos } : prev);
      setForm(prev => prev ? { ...prev, photos: cleanPhotos } : prev);
    }
    toast.success("Photo updated!");
    setUploading(false);
    e.target.value = "";
  };

  const handleDeletePhoto = async (index: number) => {
    if (!user || !profile) return;
    const currentPhotos = [...profile.photos];
    currentPhotos.splice(index, 1);
    await supabase.from("profiles").update({ photos: currentPhotos }).eq("id", user.id);
    setProfile(prev => prev ? { ...prev, photos: currentPhotos } : prev);
    setForm(prev => prev ? { ...prev, photos: currentPhotos } : prev);
    toast.success("Photo removed");
  };

  const handleVerificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !user) return;
    if (!rawFile.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (rawFile.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setVerifying(true);
    const file = await compressImage(rawFile);

    const ext = file.name.split(".").pop();
    const path = `${user.id}/verification_id_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); setVerifying(false); return; }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const imageUrl = urlData.publicUrl;

    await supabase.from("verification_requests").insert({
      user_id: user.id,
      id_card_image_url: imageUrl,
      status: "pending",
    });

    setVerificationStatus("pending");

    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "verification",
      title: "Verification Submitted",
      message: "Your college ID has been submitted for verification. We'll review it shortly.",
    });

    toast.success("ID submitted for verification!");
    setVerifying(false);
    e.target.value = "";
  };

  const toggleInterest = (interest: string) => {
    if (!form) return;
    const has = form.interests.includes(interest);
    setForm({
      ...form,
      interests: has ? form.interests.filter(i => i !== interest) : [...form.interests, interest],
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const displayProfile = editing ? form : profile;
  if (!displayProfile) return null;

  const showVerifyButton = !displayProfile.is_verified && verificationStatus !== "pending";

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <TopBar
        title="My Profile"
        rightContent={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors"
              >
                <Shield className="h-3 w-3" /> Admin
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-3 w-3" /> Logout
            </button>
          </div>
        }
      />

      {/* Followers/Following modal (own profile) */}
      {followModal && user && (
        <FollowersModal profileId={user.id} type={followModal} onClose={() => setFollowModal(null)} />
      )}

      {/* Add Photo modal */}
      {showAddPhoto && (
        <AddPhotoModal
          currentCount={galleryPhotos.length}
          onClose={() => setShowAddPhoto(false)}
          onAdded={fetchGalleryPhotos}
        />
      )}

      <div className="mx-auto max-w-md px-4 pt-6">
        <div className="flex flex-col items-center">
          <div className="relative h-24 w-24">
            <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-primary/20">
              <img src={displayProfile.photo_url || "/placeholder.svg"} alt={displayProfile.name} className="h-full w-full object-cover" />
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => handlePhotoUpload(e)} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:scale-105 disabled:opacity-50"
            >
              {uploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            {[0, 1, 2].map((index) => {
              const photoUrl = displayProfile.photos?.[index];
              return (
                <div key={index} className="relative h-20 w-20 rounded-xl overflow-hidden border-2 border-dashed border-border bg-muted">
                  {photoUrl ? (
                    <>
                      <img src={photoUrl} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                      <button
                        onClick={() => handleDeletePhoto(index)}
                        className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <label className="flex h-full w-full cursor-pointer items-center justify-center">
                      <Camera className="h-5 w-5 text-muted-foreground" />
                      <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, displayProfile.photos?.length || 0)} className="hidden" />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Add up to 3 additional photos</p>

          <div className="mt-3 flex items-center gap-2">
            {editing ? (
              <div className="flex gap-2">
                <input value={form?.name || ""} onChange={e => setForm({...form!, name: e.target.value})} className="rounded-lg border border-border bg-card px-2 py-1 text-center font-display text-lg font-bold text-foreground w-32" />
                <input type="number" value={form?.age || ""} onChange={e => setForm({...form!, age: parseInt(e.target.value) || null})} className="rounded-lg border border-border bg-card px-2 py-1 text-center font-display text-lg font-bold text-foreground w-16" placeholder="Age" />
              </div>
            ) : (
              <>
                <h2 className="font-display text-xl font-bold text-foreground">{displayProfile.name}{displayProfile.age ? `, ${displayProfile.age}` : ""}</h2>
                {displayProfile.is_verified && (
                  <img src={verifiedBadge} alt="Verified" className="h-5 w-5" />
                )}
              </>
            )}
          </div>
          {editing ? (
            <input value={form?.branch || ""} onChange={e => setForm({...form!, branch: e.target.value})} placeholder="Branch (e.g. B.A. English)" className="mt-1 rounded-lg border border-border bg-card px-2 py-1 text-center text-sm text-muted-foreground w-48" />
          ) : (
            <p className="text-sm text-muted-foreground">{displayProfile.branch || "Add your branch"}</p>
          )}
          {editing ? (
            <div className="mt-2 flex gap-2">
              {["Male", "Female", "Other"].map(g => (
                <button key={g} onClick={() => setForm({...form!, gender: g})} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${form?.gender === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border border-border"}`}>{g}</button>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{displayProfile.gender || "Set your gender"}</p>
          )}
        </div>

        {/* Followers / Following counts - CLICKABLE on own profile */}
        <div className="mt-4 flex items-center justify-center gap-6">
          <button onClick={() => setFollowModal("followers")} className="text-center transition-opacity active:opacity-70">
            <p className="font-display text-lg font-bold text-foreground">{followersCount}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </button>
          <div className="h-8 w-px bg-border" />
          <button onClick={() => setFollowModal("following")} className="text-center transition-opacity active:opacity-70">
            <p className="font-display text-lg font-bold text-foreground">{followingCount}</p>
            <p className="text-xs text-muted-foreground">Following</p>
          </button>
        </div>

        {/* Photo Gallery */}
        {galleryPhotos.length > 0 && (
          <PhotoGallery photos={galleryPhotos} onPhotoLiked={fetchGalleryPhotos} ownerName={displayProfile.name} />
        )}

        {/* Add Gallery Photo button (own profile) */}
        {galleryPhotos.length < 5 && (
          <button
            onClick={() => setShowAddPhoto(true)}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Camera className="h-4 w-4" /> Add Gallery Photo ({galleryPhotos.length}/5)
          </button>
        )}

        {/* Admin Info Section */}
        {isAdmin && user && (
          <div className="mt-4 rounded-2xl bg-card p-4 border border-accent/30">
            <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Admin Info
            </p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">User ID: <span className="text-foreground font-mono text-[11px]">{user.id}</span></p>
              <p className="text-xs text-muted-foreground">Email: <span className="text-foreground">{adminEmail}</span></p>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-card p-4">
          {editing ? (
            <textarea value={form?.bio || ""} onChange={e => setForm({...form!, bio: e.target.value})} placeholder="Write a short bio..." className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none" rows={2} />
          ) : (
            <p className="text-sm text-foreground">{displayProfile.bio || "No bio yet"}</p>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Looking for</p>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                {LOOKING_FOR_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => setForm({...form!, looking_for: opt})} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${form?.looking_for === opt ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground border border-border"}`}>{opt}</button>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground">{displayProfile.looking_for}</p>
            )}
          </div>

          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Interests</p>
            <div className="flex flex-wrap gap-1.5">
              {editing ? ALL_INTERESTS.map(i => (
                <InterestTag key={i} interest={i} selected={form?.interests.includes(i)} onClick={() => toggleInterest(i)} />
              )) : displayProfile.interests.map(i => (
                <InterestTag key={i} interest={i} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Contact</p>
            {editing ? (
              <div className="space-y-2">
                <input value={form?.instagram || ""} onChange={e => setForm({...form!, instagram: e.target.value})} placeholder="Instagram handle" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                <input value={form?.phone || ""} onChange={e => setForm({...form!, phone: e.target.value})} placeholder="Phone number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
              </div>
            ) : (
              <>
                {displayProfile.instagram && (
                  <button
                    onClick={() => {
                      const handle = displayProfile.instagram!.replace(/^@/, "");
                      window.open(`https://instagram.com/${handle}`, "_blank");
                    }}
                    className="flex items-center gap-2 text-sm text-primary font-medium"
                  >
                    <Instagram className="h-4 w-4 text-secondary" /> {displayProfile.instagram}
                  </button>
                )}
                {displayProfile.phone && (
                  <div className="mt-1 flex items-center gap-2 text-sm text-foreground">
                    <span className="text-primary">📱</span> {displayProfile.phone}
                  </div>
                )}
                {!displayProfile.instagram && !displayProfile.phone && (
                  <p className="text-xs text-muted-foreground">No contact info added</p>
                )}
              </>
            )}
          </div>

          {/* Verification section */}
          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Verification</p>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-accent" />
              <span className={`text-sm font-medium ${
                displayProfile.is_verified ? "text-accent" :
                verificationStatus === "pending" ? "text-yellow-600 dark:text-yellow-400" :
                verificationStatus === "rejected" ? "text-destructive" :
                "text-muted-foreground"
              }`}>
                {displayProfile.is_verified ? "✅ Verified" :
                 verificationStatus === "pending" ? "⏳ Pending Verification" :
                 verificationStatus === "rejected" ? "❌ Rejected — Reapply below" :
                 "Not Verified"}
              </span>
            </div>
            {showVerifyButton && (
              <>
                <p className="text-xs text-muted-foreground mb-2">Upload your college ID card to get verified</p>
                <input ref={verifyInputRef} type="file" accept="image/*" className="hidden" onChange={handleVerificationUpload} />
                <button
                  onClick={() => verifyInputRef.current?.click()}
                  disabled={verifying}
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-accent py-2.5 text-sm font-display font-bold text-accent-foreground active:scale-[0.98] disabled:opacity-50"
                >
                  {verifying ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground border-t-transparent" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {verifying ? "Uploading..." : verificationStatus === "rejected" ? "Reapply for Verification" : "Verify Profile"}
                </button>
              </>
            )}
            {verificationStatus === "pending" && !displayProfile.is_verified && (
              <p className="text-xs text-muted-foreground">Your ID is being reviewed. You'll be notified once approved.</p>
            )}
          </div>
        </div>

        {editing ? (
          <div className="mt-6 flex gap-3">
            <button onClick={() => { setEditing(false); setForm(profile); }} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border py-3 font-display text-sm font-bold text-muted-foreground transition-all active:scale-[0.98]">
              <X className="h-4 w-4" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display text-sm font-bold text-primary-foreground transition-all active:scale-[0.98]">
            <Edit className="h-4 w-4" /> Edit Profile
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
