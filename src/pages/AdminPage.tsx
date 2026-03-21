import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, Shield } from "lucide-react";
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

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) return;
    fetchRequests();
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
      setRequests(
        data.map((r) => ({
          ...r,
          profile_name: profileMap.get(r.user_id)?.name || "Unknown",
          profile_photo: profileMap.get(r.user_id)?.photo_url || undefined,
        }))
      );
    } else {
      setRequests([]);
    }
    setLoading(false);
  };

  const handleAction = async (req: VerificationRequest, action: "approved" | "rejected") => {
    setProcessing(req.id);

    const updates: any = { status: action };

    if (action === "approved") {
      updates.is_verified = true;
      updates.verified = "verified";
    }

    const { error: updateError } = await supabase
      .from("verification_requests")
      .update({ status: action })
      .eq("id", req.id);

    if (!updateError && action === "approved") {
      await supabase
        .from("profiles")
        .update({ is_verified: true, verified: "verified" })
        .eq("id", req.user_id);
    }

    await supabase.from("notifications").insert({
      user_id: req.user_id,
      type: "verification",
      title: action === "approved" ? "Verification Approved ✅" : "Verification Rejected ❌",
      message:
        action === "approved"
          ? "Your college ID has been verified! You now have a verified badge."
          : "Your verification was rejected. Please upload a clearer photo of your college ID.",
    });

    toast.success(`Request ${action}`);
    setProcessing(null);
    fetchRequests();
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background">
        <Shield className="h-12 w-12 text-destructive mb-4" />
        <p className="font-display text-lg font-bold text-foreground">Access Denied</p>
        <p className="mt-1 text-sm text-muted-foreground">You don't have admin privileges.</p>
        <button onClick={() => navigate("/discover")} className="mt-4 rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground">
          Go Home
        </button>
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

      <div className="mx-auto max-w-md px-4 pt-4">
        <h2 className="font-display text-sm font-bold text-muted-foreground mb-3">
          Pending Verification Requests
        </h2>

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
              <div key={req.id} className="rounded-2xl bg-card p-4">
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
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div
                  className="w-full aspect-video overflow-hidden rounded-xl bg-muted mb-3 cursor-pointer"
                  onClick={() => setPreviewImage(req.id_card_image_url)}
                >
                  <img src={req.id_card_image_url} alt="ID Card" className="h-full w-full object-contain" />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(req, "approved")}
                    disabled={processing === req.id}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm font-display font-bold text-accent-foreground disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button
                    onClick={() => handleAction(req, "rejected")}
                    disabled={processing === req.id}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-destructive py-2.5 text-sm font-display font-bold text-destructive-foreground disabled:opacity-50"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
