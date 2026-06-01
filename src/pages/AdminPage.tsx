import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, Shield, Users, Bell, Send } from "lucide-react";
import DefaultAvatar from "@/components/DefaultAvatar";
import verifiedBadge from "@/assets/verified-badge.png";
import { toast } from "sonner";

const ADMIN_EMAIL = "rangiavlog@gmail.com";

interface VerificationRequest {
  id: string;
  user_id: string;
  id_card_image_url: string;
  status: string;
  created_at: string;
  profile_name?: string;
  profile_photo?: string;
}

interface RegisteredUser {
  id: string;
  name: string;
  photo_url: string | null;
  is_verified: boolean;
  branch: string | null;
}

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [tab, setTab] = useState<"verify" | "users" | "notify">("verify");
  const [notifyUserId, setNotifyUserId] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [sending, setSending] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) return;
    fetchRequests();
    fetchAllUsers();
  }, [isAdmin]);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("verification_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const userIds = data.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, photo_url")
        .in("id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Generate signed URLs for verification ID images (stored as paths in private bucket)
      const enriched = await Promise.all(data.map(async (r) => {
        let imageUrl = r.id_card_image_url;
        // If it's a storage path (not a full URL), generate a signed URL
        if (imageUrl && !imageUrl.startsWith("http")) {
          const { data: signedData } = await supabase.storage
            .from("verification-ids")
            .createSignedUrl(imageUrl, 300); // 5 min TTL
          imageUrl = signedData?.signedUrl || imageUrl;
        }
        return {
          ...r,
          id_card_image_url: imageUrl,
          profile_name: profileMap.get(r.user_id)?.name || "Unknown",
          profile_photo: profileMap.get(r.user_id)?.photo_url || undefined,
        };
      }));
      setRequests(enriched);
    } else {
      setRequests([]);
    }
    setLoading(false);
  };

  const fetchAllUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, photo_url, is_verified, branch")
      .order("created_at", { ascending: false });
    setAllUsers((data as RegisteredUser[]) || []);
  };

  const handleAction = async (req: VerificationRequest, action: "approved" | "rejected") => {
    setProcessing(req.id);
    setRequests(prev => prev.filter(r => r.id !== req.id));

    try {
      // Update verification request status
      const { error: reqError } = await supabase
        .from("verification_requests")
        .update({ status: action })
        .eq("id", req.id);
      if (reqError) throw reqError;

      if (action === "approved") {
        // Update profile - set both fields
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ is_verified: true, verified: "verified" })
          .eq("id", req.user_id);
        if (profileError) throw profileError;

        // Immediately update local users list
        setAllUsers(prev => prev.map(u => u.id === req.user_id ? { ...u, is_verified: true } : u));
      }

      // Send notification
      await supabase.rpc("create_notification", {
        _target_user_id: req.user_id,
        _type: "verification",
        _title: action === "approved" ? "Verification Approved ✅" : "Verification Rejected ❌",
        _message: action === "approved"
          ? "Your college ID has been verified! You now have a verified badge."
          : "Your verification was rejected. Please upload a clearer photo of your college ID.",
      });

      toast.success(`Request ${action}!`);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
      fetchRequests();
    }
    setProcessing(null);
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background">
        <Shield className="h-12 w-12 text-destructive mb-4" />
        <p className="font-display text-lg font-bold text-foreground">Access Denied</p>
        <button onClick={() => navigate("/feed")} className="mt-4 rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground">Go Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-8">
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="ID Card" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
        </div>
      )}

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-display text-lg font-bold text-foreground">Admin Panel</h1>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-3">
        <div className="flex gap-1 mb-4">
          <button onClick={() => setTab("verify")} className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${tab === "verify" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            Verification {requests.length > 0 && `(${requests.length})`}
          </button>
          <button onClick={() => setTab("users")} className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${tab === "users" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <Users className="h-3 w-3 inline mr-1" /> Users
          </button>
          <button onClick={() => setTab("notify")} className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${tab === "notify" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <Bell className="h-3 w-3 inline mr-1" /> Notify
          </button>
        </div>

        {tab === "verify" ? (
          <>
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Check className="h-10 w-10 text-accent mb-3" />
                <p className="font-display text-base font-bold text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground">No pending verification requests.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div key={req.id} className="rounded-2xl bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                        {req.profile_photo ? (
                          <img src={req.profile_photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">?</div>
                        )}
                      </div>
                      <div>
                        <p className="font-display text-sm font-bold text-foreground">{req.profile_name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{req.user_id.slice(0, 8)}...</p>
                      </div>
                    </div>
                    <div className="w-full aspect-video overflow-hidden rounded-xl bg-muted mb-3 cursor-pointer" onClick={() => setPreviewImage(req.id_card_image_url)}>
                      <img src={req.id_card_image_url} alt="ID Card" className="h-full w-full object-contain" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(req, "approved")} disabled={processing === req.id} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm font-display font-bold text-accent-foreground disabled:opacity-50 active:scale-[0.98]">
                        <Check className="h-4 w-4" /> Approve
                      </button>
                      <button onClick={() => handleAction(req, "rejected")} disabled={processing === req.id} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-destructive py-2.5 text-sm font-display font-bold text-destructive-foreground disabled:opacity-50 active:scale-[0.98]">
                        <X className="h-4 w-4" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : tab === "users" ? (
          <div className="space-y-2">
            <div className="rounded-2xl bg-card p-3 mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Total Registered Users</span>
              <span className="font-display text-lg font-bold text-primary">{allUsers.length}</span>
            </div>
            {allUsers.map(u => (
              <button key={u.id} onClick={() => navigate(`/profile/${u.id}`)} className="w-full flex items-center gap-3 rounded-2xl bg-card p-3 transition-all active:scale-[0.98]">
                <DefaultAvatar src={u.photo_url} alt={u.name} className="h-10 w-10" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                    {u.is_verified && <img src={verifiedBadge} alt="Verified" className="h-4 w-4" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{u.id}</p>
                </div>
                <p className="text-xs text-muted-foreground">{u.branch || "—"}</p>
              </button>
            ))}
          </div>

        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Send a custom push + in-app notification to any user.</p>
            <div>
              <label className="text-xs font-semibold text-foreground">Target User</label>
              <select
                value={notifyUserId}
                onChange={(e) => setNotifyUserId(e.target.value)}
                className="mt-1 w-full rounded-xl bg-card border border-border px-3 py-2 text-sm text-foreground"
              >
                <option value="">Select a user…</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.id.slice(0, 8)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Title</label>
              <input
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
                placeholder="Notification title"
                className="mt-1 w-full rounded-xl bg-card border border-border px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Message</label>
              <textarea
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                placeholder="Notification body"
                rows={3}
                className="mt-1 w-full rounded-xl bg-card border border-border px-3 py-2 text-sm text-foreground resize-none"
              />
            </div>
            <button
              disabled={sending || !notifyUserId || !notifyTitle}
              onClick={async () => {
                setSending(true);
                try {
                  const { error } = await supabase.rpc("create_notification", {
                    _target_user_id: notifyUserId,
                    _type: "general",
                    _title: notifyTitle,
                    _message: notifyMessage || "",
                  });
                  if (error) throw error;
                  toast.success("Notification sent! Check push + in-app.");
                  setNotifyTitle("");
                  setNotifyMessage("");
                } catch (err: any) {
                  toast.error("Failed: " + err.message);
                } finally {
                  setSending(false);
                }
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send Notification"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
