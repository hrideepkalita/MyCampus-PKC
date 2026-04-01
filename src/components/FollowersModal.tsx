import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import verifiedBadge from "@/assets/verified-badge.png";

interface FollowersModalProps {
  profileId: string;
  type: "followers" | "following";
  onClose: () => void;
}

interface FollowUser {
  id: string;
  name: string;
  photo_url: string | null;
  branch: string | null;
  is_verified: boolean;
}

const FollowersModal = ({ profileId, type, onClose }: FollowersModalProps) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, [profileId, type]);

  const fetchUsers = async () => {
    const column = type === "followers" ? "following_id" : "follower_id";
    const targetColumn = type === "followers" ? "follower_id" : "following_id";

    const { data: follows } = await supabase
      .from("follows")
      .select(targetColumn)
      .eq(column, profileId);

    if (!follows || follows.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const userIds = follows.map((f: any) => f[targetColumn]);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, photo_url, branch, is_verified")
      .in("id", userIds);

    setUsers((profiles as FollowUser[]) || []);
    setLoading(false);
  };

  const handleUserClick = (userId: string) => {
    onClose();
    navigate(`/profile/${userId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[70vh] rounded-t-2xl sm:rounded-2xl bg-background overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-base font-bold text-foreground capitalize">{type}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No {type} yet
            </p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleUserClick(u.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
              >
                <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                  <img src={u.photo_url || "/placeholder.svg"} alt={u.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                    {u.is_verified && (
                      <img src={verifiedBadge} alt="Verified" className="h-4 w-4 object-contain" />
                    )}
                  </div>
                  {u.branch && <p className="text-xs text-muted-foreground truncate">{u.branch}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowersModal;
