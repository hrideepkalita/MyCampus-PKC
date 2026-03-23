import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import verifiedBadge from "@/assets/verified-badge.png";

interface SearchProfile {
  id: string;
  name: string;
  age: number | null;
  branch: string | null;
  photo_url: string | null;
  interests: string[];
  is_verified: boolean;
}

const SearchPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!user || !query.trim()) return;
    setLoading(true);
    setSearched(true);

    const searchTerm = query.trim().toLowerCase();

    const { data: nameResults } = await supabase
      .from("profiles")
      .select("id, name, age, branch, photo_url, interests, is_verified")
      .neq("id", user.id)
      .ilike("name", `%${searchTerm}%`)
      .limit(20);

    const { data: interestResults } = await supabase
      .from("profiles")
      .select("id, name, age, branch, photo_url, interests, is_verified")
      .neq("id", user.id)
      .contains("interests", [searchTerm])
      .limit(20);

    const allResults = [...(nameResults || []), ...(interestResults || [])];
    const unique = Array.from(new Map(allResults.map((r) => [r.id, r])).values());

    setResults(unique as SearchProfile[]);
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name or interest..."
              autoFocus
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground flex-shrink-0"
          >
            Go
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !searched ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Search className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 font-display text-base font-bold text-foreground">Find people</p>
            <p className="mt-1 text-sm text-muted-foreground">Search by name or interest</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="font-display text-base font-bold text-foreground">No results found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search term</p>
          </div>
        ) : (
          results.map((profile) => (
            <button
              key={profile.id}
              onClick={() => navigate(`/profile/${profile.id}`)}
              className="w-full flex items-center gap-3 rounded-2xl bg-card p-3 transition-all active:scale-[0.98] text-left"
            >
              <div className="h-12 w-12 overflow-hidden rounded-full flex-shrink-0">
                <img src={profile.photo_url || "/placeholder.svg"} alt={profile.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-display text-sm font-bold text-foreground truncate">{profile.name}</p>
                  {profile.age && <span className="text-xs text-muted-foreground">{profile.age}</span>}
                  {profile.verified === "verified" && (
                    <span className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                      <Check className="h-2.5 w-2.5 mr-0.5" />✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{profile.branch || "No branch"}</p>
                {profile.interests?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {profile.interests.slice(0, 3).map((i) => (
                      <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">{i}</span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default SearchPage;
