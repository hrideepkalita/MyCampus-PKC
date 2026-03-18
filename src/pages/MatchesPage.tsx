import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import { mockMatches } from "@/lib/mockData";
import { Instagram, Phone, ChevronRight } from "lucide-react";
import type { UserProfile } from "@/lib/mockData";

const MatchesPage = () => {
  const [selectedMatch, setSelectedMatch] = useState<UserProfile | null>(null);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="font-display text-lg font-bold text-foreground">Matches</h1>
          <p className="text-xs text-muted-foreground">{mockMatches.length} connections</p>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4 space-y-3">
        {mockMatches.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="text-5xl">💫</span>
            <p className="mt-4 font-display text-lg font-bold text-foreground">No matches yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Keep swiping to find your match!</p>
          </div>
        ) : (
          mockMatches.map((match) => (
            <button
              key={match.id}
              onClick={() => setSelectedMatch(selectedMatch?.id === match.id ? null : match)}
              className="w-full text-left"
            >
              <div className="flex items-center gap-3 rounded-2xl bg-card p-3 transition-all active:scale-[0.98]">
                <div className="h-14 w-14 overflow-hidden rounded-full">
                  <img src={match.photo} alt={match.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm font-bold text-foreground">{match.name}</p>
                  <p className="text-xs text-muted-foreground">{match.branch}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>

              {selectedMatch?.id === match.id && (
                <div className="mt-2 rounded-2xl bg-card p-4 animate-slide-up">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Contact Info</p>
                  {match.instagram && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Instagram className="h-4 w-4 text-pink" />
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
            </button>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default MatchesPage;
