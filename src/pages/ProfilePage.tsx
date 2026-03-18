import { useState, useEffect, useRef } from "react";
import BottomNav from "@/components/BottomNav";
import InterestTag from "@/components/InterestTag";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Check, LogOut, Edit, Shield, Instagram, Save, X, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ALL_INTERESTS, LOOKING_FOR_OPTIONS } from "@/lib/mockData";
import { toast } from "sonner";

interface Profile {
  name: string;
  age: number | null;
  gender: string | null;
  branch: string | null;
  bio: string | null;
  photo_url: string | null;
  interests: string[];
  looking_for: string | null;
  verified: string | null;
  instagram: string | null;
  phone: string | null;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchProfile();
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
        interests: (data.interests as string[]) || [],
        looking_for: data.looking_for,
        verified: data.verified,
        instagram: data.instagram,
        phone: data.phone,
      };
      setProfile(p);
      setForm(p);
    }
    setLoading(false);
  };

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const photoUrl = urlData.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ photo_url: photoUrl }).eq("id", user.id);
    setProfile(prev => prev ? { ...prev, photo_url: photoUrl } : prev);
    setForm(prev => prev ? { ...prev, photo_url: photoUrl } : prev);
    toast.success("Photo updated!");
    setUploading(false);
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const displayProfile = editing ? form : profile;
  if (!displayProfile) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="font-display text-lg font-bold text-foreground">My Profile</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-3 w-3" /> Logout
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-6">
        <div className="flex flex-col items-center">
          <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-primary/20">
            <img src={displayProfile.photo_url || "/placeholder.svg"} alt={displayProfile.name} className="h-full w-full object-cover" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            {editing ? (
              <div className="flex gap-2">
                <input value={form?.name || ""} onChange={e => setForm({...form!, name: e.target.value})} className="rounded-lg border border-border bg-card px-2 py-1 text-center font-display text-lg font-bold text-foreground w-32" />
                <input type="number" value={form?.age || ""} onChange={e => setForm({...form!, age: parseInt(e.target.value) || null})} className="rounded-lg border border-border bg-card px-2 py-1 text-center font-display text-lg font-bold text-foreground w-16" placeholder="Age" />
              </div>
            ) : (
              <>
                <h2 className="font-display text-xl font-bold text-foreground">{displayProfile.name}{displayProfile.age ? `, ${displayProfile.age}` : ""}</h2>
                {displayProfile.verified === "verified" && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                    <Check className="h-3 w-3" /> Verified
                  </span>
                )}
              </>
            )}
          </div>
          {editing ? (
            <input value={form?.branch || ""} onChange={e => setForm({...form!, branch: e.target.value})} placeholder="Branch (e.g. B.A. English)" className="mt-1 rounded-lg border border-border bg-card px-2 py-1 text-center text-sm text-muted-foreground w-48" />
          ) : (
            <p className="text-sm text-muted-foreground">{displayProfile.branch || "Add your branch"}</p>
          )}
        </div>

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
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Instagram className="h-4 w-4 text-pink" /> {displayProfile.instagram}
                  </div>
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

          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Verification</p>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium capitalize text-foreground">{displayProfile.verified}</span>
            </div>
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
