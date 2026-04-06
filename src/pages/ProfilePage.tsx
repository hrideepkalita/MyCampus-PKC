import { useState, useEffect, useRef, useCallback } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import InterestTag from "@/components/InterestTag";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Edit, Shield, Instagram, Save, X, Camera, Upload, ChevronRight, Trash2, Eye } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import verifiedBadge from "@/assets/verified-badge.png";
import { useNavigate } from "react-router-dom";
import { ALL_INTERESTS, LOOKING_FOR_OPTIONS } from "@/lib/mockData";
import { toast } from "sonner";
import AddPhotoModal from "@/components/AddPhotoModal";
import FollowersModal from "@/components/FollowersModal";
import DefaultAvatar from "@/components/DefaultAvatar";
import PostScrollViewer from "@/components/PostScrollViewer";

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
  semester: string | null;
}

interface GalleryPhoto {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

interface UserPost {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  created_at: string;
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

  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const [showFullGallery, setShowFullGallery] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showPostScroller, setShowPostScroller] = useState(false);

  const [userPosts, setUserPosts] = useState<UserPost[]>([]);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);

  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!user) return;
    fetchProfile();
    fetchVerificationStatus();
    fetchFollowCounts();
    fetchGalleryPhotos();
    fetchUserPosts();
    if (isAdmin) setAdminEmail(user.email ?? null);
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      const p: Profile = {
        name: data.name, age: data.age, gender: data.gender, branch: data.branch,
        bio: data.bio, photo_url: data.photo_url, photos: (data.photos as string[]) || [],
        interests: (data.interests as string[]) || [], looking_for: data.looking_for,
        verified: data.verified, is_verified: (data as any).is_verified ?? false,
        instagram: data.instagram, phone: data.phone,
        semester: (data as any).semester || null,
      };
      setProfile(p);
      setForm(p);
    }
    setLoading(false);
  };

  const fetchVerificationStatus = async () => {
    if (!user) return;
    const { data } = await supabase.from("verification_requests").select("status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
    if (data && data.length > 0) setVerificationStatus(data[0].status);
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
      .select("id, user_id, image_url, caption, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setGalleryPhotos((photos as GalleryPhoto[]) || []);
  }, [user]);

  const fetchUserPosts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("posts")
      .select("id, content, media_url, media_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setUserPosts((data as UserPost[]) || []);
  };

  const handleSave = async () => {
    if (!user || !form) return;
    setSaving(true);
    await supabase.from("profiles").update({
      name: form.name, age: form.age, gender: form.gender, branch: form.branch,
      bio: form.bio, interests: form.interests, looking_for: form.looking_for,
      instagram: form.instagram, phone: form.phone, photos: form.photos,
      semester: form.semester,
    } as any).eq("id", user.id);
    setProfile(form);
    setEditing(false);
    setSaving(false);
  };

  const handleLogout = async () => { await signOut(); navigate("/"); };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !user) return;
    if (!rawFile.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    setUploading(true);
    const file = await compressImage(rawFile);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const photoUrl = urlData.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ photo_url: photoUrl }).eq("id", user.id);
    setProfile(prev => prev ? { ...prev, photo_url: photoUrl } : prev);
    setForm(prev => prev ? { ...prev, photo_url: photoUrl } : prev);
    toast.success("Photo updated!");
    setUploading(false);
    e.target.value = "";
  };

  const handleDeleteGalleryPhoto = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return;
    await supabase.from("profile_photos").delete().eq("id", photoId);
    setGalleryPhotos(prev => prev.filter(p => p.id !== photoId));
    toast.success("Photo deleted");
  };

  const handleVerificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !user) return;
    if (!rawFile.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    setVerifying(true);
    const file = await compressImage(rawFile);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/verification_id_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); setVerifying(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("verification_requests").insert({ user_id: user.id, id_card_image_url: urlData.publicUrl, status: "pending" });
    setVerificationStatus("pending");
    await supabase.from("notifications").insert({ user_id: user.id, type: "verification", title: "Verification Submitted", message: "Your college ID has been submitted for verification." });
    toast.success("ID submitted for verification!");
    setVerifying(false);
    e.target.value = "";
  };

  const toggleInterest = (interest: string) => {
    if (!form) return;
    const has = form.interests.includes(interest);
    setForm({ ...form, interests: has ? form.interests.filter(i => i !== interest) : [...form.interests, interest] });
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

  const galleryPreview = galleryPhotos.slice(0, 5);
  const allGalleryItems = [...galleryPhotos.map(g => ({ ...g, _type: "gallery" as const })), ...userPosts.filter(p => p.media_url).map(p => ({ ...p, _type: "post" as const }))];
  const deptSemDisplay = [displayProfile.branch, displayProfile.semester ? `Sem ${displayProfile.semester}` : null].filter(Boolean).join(" • ");

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <TopBar
        title="My Profile"
        rightContent={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => navigate("/admin")} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
                <Shield className="h-3 w-3" /> Admin
              </button>
            )}
            <button onClick={handleLogout} className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">
              <LogOut className="h-3 w-3" /> Logout
            </button>
          </div>
        }
      />

      {followModal && user && <FollowersModal profileId={user.id} type={followModal} onClose={() => setFollowModal(null)} />}
      {showAddPhoto && <AddPhotoModal currentCount={galleryPhotos.length} onClose={() => setShowAddPhoto(false)} onAdded={fetchGalleryPhotos} />}

      {/* Fullscreen image viewer */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Full" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
        </div>
      )}

      {/* Post scroll viewer */}
      {showPostScroller && user && (
        <PostScrollViewer userId={user.id} onClose={() => setShowPostScroller(false)} />
      )}

      {/* Full Gallery View */}
      {showFullGallery && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
            <h2 className="font-display text-lg font-bold text-foreground">Gallery</h2>
            <button onClick={() => setShowFullGallery(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-3 gap-1">
              {allGalleryItems.map((item, idx) => {
                const isPost = item._type === "post";
                const url = isPost ? (item as any).media_url : (item as any).image_url;
                const isVideo = isPost && (item as any).media_type === "video";
                return (
                  <div key={idx} className="relative aspect-square overflow-hidden rounded-lg bg-muted group">
                    {isVideo ? (
                      <div className="h-full w-full bg-black flex items-center justify-center">
                        <span className="text-muted-foreground text-xs">▶</span>
                      </div>
                    ) : (
                      <button onClick={() => setSelectedImage(url!)} className="w-full h-full">
                        <img src={url!} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    )}
                    {isVideo && (
                      <div className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/50 px-1 py-0.5 text-[9px] text-white">
                        <Eye className="h-2.5 w-2.5" /> Video
                      </div>
                    )}
                    {!isPost && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteGalleryPhoto((item as GalleryPhoto).id); }}
                        className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {allGalleryItems.length === 0 && (
              <div className="flex flex-col items-center py-20 text-center">
                <p className="text-muted-foreground text-sm">No photos or posts yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-md px-4 pt-6">
        <div className="flex flex-col items-center">
          <div className="relative h-24 w-24">
            <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-primary/20">
              <DefaultAvatar src={displayProfile.photo_url} alt={displayProfile.name} className="h-full w-full" />
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md disabled:opacity-50">
              {uploading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Camera className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            {editing ? (
              <div className="space-y-2">
                <input value={form?.name || ""} onChange={e => setForm({ ...form!, name: e.target.value })} className="rounded-lg border border-border bg-card px-3 py-2 text-center font-display text-lg font-bold text-foreground w-48" placeholder="Name" />
                <input type="number" value={form?.age || ""} onChange={e => setForm({ ...form!, age: parseInt(e.target.value) || null })} className="rounded-lg border border-border bg-card px-3 py-2 text-center text-sm text-foreground w-48" placeholder="Age" />
                <div className="flex gap-2 justify-center">
                  {["Male", "Female", "Other"].map(g => (
                    <button key={g} onClick={() => setForm({ ...form!, gender: g })} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${form?.gender === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border border-border"}`}>{g}</button>
                  ))}
                </div>
                <input value={form?.branch || ""} onChange={e => setForm({ ...form!, branch: e.target.value })} placeholder="Department (e.g. CSE)" className="rounded-lg border border-border bg-card px-3 py-2 text-center text-sm text-foreground w-48" />
                <input value={form?.semester || ""} onChange={e => setForm({ ...form!, semester: e.target.value })} placeholder="Semester (e.g. 6th)" className="rounded-lg border border-border bg-card px-3 py-2 text-center text-sm text-foreground w-48" />
              </div>
            ) : (
              <>
                <h2 className="font-display text-xl font-bold text-foreground">{displayProfile.name}{displayProfile.age ? `, ${displayProfile.age}` : ""}</h2>
                {displayProfile.is_verified && <img src={verifiedBadge} alt="Verified" className="h-5 w-5" />}
              </>
            )}
          </div>
          {!editing && (
            <>
              {deptSemDisplay && <p className="text-sm text-muted-foreground mt-0.5">{deptSemDisplay}</p>}
              {displayProfile.gender && <p className="mt-0.5 text-xs text-muted-foreground">{displayProfile.gender}</p>}
            </>
          )}
        </div>

        {/* Followers / Following */}
        <div className="mt-4 flex items-center justify-center gap-6">
          <button onClick={() => setFollowModal("followers")} className="text-center active:opacity-70">
            <p className="font-display text-lg font-bold text-foreground">{followersCount}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </button>
          <div className="h-8 w-px bg-border" />
          <button onClick={() => setFollowModal("following")} className="text-center active:opacity-70">
            <p className="font-display text-lg font-bold text-foreground">{followingCount}</p>
            <p className="text-xs text-muted-foreground">Following</p>
          </button>
        </div>

        {/* Gallery - horizontal preview + All button */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground">Gallery</p>
            <button onClick={() => setShowFullGallery(true)} className="flex items-center gap-1 text-xs font-medium text-primary">
              All <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {galleryPreview.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {galleryPreview.map(photo => (
                <div key={photo.id} className="relative flex-shrink-0 w-[45vw] max-w-[180px] group">
                  <div className="aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                    <button onClick={() => setSelectedImage(photo.image_url)} className="w-full h-full">
                      <img src={photo.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleDeleteGalleryPhoto(photo.id)}
                    className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">No gallery photos yet</p>
          )}
        </div>

        {/* Add Gallery Photo */}
        <button
          onClick={() => setShowAddPhoto(true)}
          className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Camera className="h-4 w-4" /> Add Gallery Photo
        </button>

        {/* User Posts Grid */}
        {userPosts.filter(p => p.media_url).length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground">My Posts</p>
              <button onClick={() => setShowPostScroller(true)} className="flex items-center gap-1 text-xs font-medium text-primary">
                View All <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {userPosts.filter(p => p.media_url).slice(0, 6).map(post => (
                <button key={post.id} onClick={() => setShowPostScroller(true)} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {post.media_type === "video" ? (
                    <div className="h-full w-full bg-black flex items-center justify-center">
                      <span className="text-muted-foreground text-xs">▶</span>
                    </div>
                  ) : (
                    <img src={post.media_url!} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                  {post.media_type === "video" && (
                    <div className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/50 px-1 py-0.5 text-[9px] text-white">
                      <Eye className="h-2.5 w-2.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Admin Info */}
        {isAdmin && user && (
          <div className="mt-4 rounded-2xl bg-card p-4 border border-accent/30">
            <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Admin Info</p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">User ID: <span className="text-foreground font-mono text-[11px]">{user.id}</span></p>
              <p className="text-xs text-muted-foreground">Email: <span className="text-foreground">{adminEmail}</span></p>
            </div>
          </div>
        )}

        {/* Bio */}
        <div className="mt-4 rounded-2xl bg-card p-4">
          {editing ? (
            <textarea value={form?.bio || ""} onChange={e => setForm({ ...form!, bio: e.target.value })} placeholder="Write a short bio..." className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none" rows={2} />
          ) : (
            <p className="text-sm text-foreground">{displayProfile.bio || "No bio yet"}</p>
          )}
        </div>

        {/* Details */}
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Looking for</p>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                {LOOKING_FOR_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => setForm({ ...form!, looking_for: opt })} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${form?.looking_for === opt ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground border border-border"}`}>{opt}</button>
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
                <input value={form?.instagram || ""} onChange={e => setForm({ ...form!, instagram: e.target.value })} placeholder="Instagram handle" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                <input value={form?.phone || ""} onChange={e => setForm({ ...form!, phone: e.target.value })} placeholder="Phone number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
              </div>
            ) : (
              <>
                {displayProfile.instagram && (
                  <button onClick={() => window.open(`https://instagram.com/${displayProfile.instagram!.replace(/^@/, "")}`, "_blank")} className="flex items-center gap-2 text-sm text-primary font-medium">
                    <Instagram className="h-4 w-4 text-secondary" /> {displayProfile.instagram}
                  </button>
                )}
                {displayProfile.phone && <div className="mt-1 flex items-center gap-2 text-sm text-foreground"><span className="text-primary">📱</span> {displayProfile.phone}</div>}
                {!displayProfile.instagram && !displayProfile.phone && <p className="text-xs text-muted-foreground">No contact info added</p>}
              </>
            )}
          </div>

          {/* Verification */}
          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Verification</p>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-accent" />
              <span className={`text-sm font-medium ${displayProfile.is_verified ? "text-accent" : verificationStatus === "pending" ? "text-yellow-600 dark:text-yellow-400" : verificationStatus === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                {displayProfile.is_verified ? "✅ Verified" : verificationStatus === "pending" ? "⏳ Pending" : verificationStatus === "rejected" ? "❌ Rejected" : "Not Verified"}
              </span>
            </div>
            {showVerifyButton && (
              <>
                <p className="text-xs text-muted-foreground mb-2">Upload your college ID to get verified</p>
                <input ref={verifyInputRef} type="file" accept="image/*" className="hidden" onChange={handleVerificationUpload} />
                <button onClick={() => verifyInputRef.current?.click()} disabled={verifying} className="flex items-center justify-center gap-2 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-accent-foreground active:scale-[0.98] disabled:opacity-50">
                  {verifying ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground border-t-transparent" /> : <Upload className="h-4 w-4" />}
                  {verifying ? "Uploading..." : "Verify Profile"}
                </button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <div className="mt-6 flex gap-3">
            <button onClick={() => { setEditing(false); setForm(profile); }} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold text-muted-foreground active:scale-[0.98]">
              <X className="h-4 w-4" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98]">
            <Edit className="h-4 w-4" /> Edit Profile
          </button>
        )}

        <p className="mt-8 mb-4 text-center text-xs text-muted-foreground">
          Made by PKCian for PKCians ❤️
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
