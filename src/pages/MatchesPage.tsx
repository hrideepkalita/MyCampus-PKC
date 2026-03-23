import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Instagram, Phone, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import verifiedBadge from "@/assets/verified-badge.png";

interface MatchProfile {
  id: string;
  name: string;
  branch: string | null;
  photo_url: string | null;
  instagram: string | null;
  phone: string | null;
  is_verified: boolean;
}

const MatchesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchMatches();
  }, [user]);

  const fetchMatches = async () => {
    if (!user) return;

    const { data: matchRows } = await supabase
      .from("matches")
      .select("user1_id, user2_id")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (!matchRows?.length) {
      setLoading(false);
      return;
    }

    const otherIds = matchRows.map(m => m.user1_id === user.id ? m.user2_id : m.user1_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, branch, photo_url, instagram, phone")
      .in("id", otherIds);

    setMatches((profiles as MatchProfile[]) || []);
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <TopBar title="Friends" />

      <div className="mx-auto max-w-md px-4 pt-1">
        <p className="text-xs text-muted-foreground mb-3">{matches.length} friends</p>
      </div>

      <div className="mx-auto max-w-md px-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="text-5xl">💫</span>
            <p className="mt-4 font-display text-lg font-bold text-foreground">No friends yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Keep swiping to find your match!</p>
          </div>
        ) : (
          matches.map((match) => (
            <div key={match.id}>
              <button
                onClick={() => navigate(`/profile/${match.id}`)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-3 rounded-2xl bg-card p-3 transition-all active:scale-[0.98]">
                  <div className="h-14 w-14 overflow-hidden rounded-full">
                    <img src={match.photo_url || "/placeholder.svg"} alt={match.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm font-bold text-foreground">{match.name}</p>
                    <p className="text-xs text-muted-foreground">{match.branch || "No branch"}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setSelectedId(selectedId === match.id ? null : match.id); }}
                className="mt-1 ml-17 text-xs text-primary font-medium"
              >
                {selectedId === match.id ? "Hide contact" : "Show contact info"}
              </button>

              {selectedId === match.id && (
                <div className="mt-2 rounded-2xl bg-card p-4 animate-slide-up">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Contact Info</p>
                  {match.instagram && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Instagram className="h-4 w-4 text-secondary" />
                      {match.instagram}
                    </div>
                  )}
                  {match.phone && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-foreground">
                      <Phone className="h-4 w-4 text-primary" />
                      {match.phone}
                    </div>
                  )}
                  {!match.instagram && !match.phone && (
                    <p className="text-xs text-muted-foreground">No contact info shared</p>
                  )}
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

export default MatchesPage;
