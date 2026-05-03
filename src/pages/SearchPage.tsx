import { useState, useEffect, useRef, useCallback } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import verifiedBadge from "@/assets/verified-badge.png";
import DefaultAvatar from "@/components/DefaultAvatar";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (searchTerm: string) => {
    if (!user || !searchTerm.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    const term = searchTerm.trim().toLowerCase();

    const [{ data: nameResults }, { data: interestResults }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, age, branch, photo_url, interests, is_verified")
        .neq("id", user.id)
        .ilike("name", `%${term}%`)
        .limit(10),
      supabase
        .from("profiles")
        .select("id, name, age, branch, photo_url, interests, is_verified")
        .neq("id", user.id)
        .contains("interests", [term])
        .limit(10),
    ]);

    const allResults = [...(nameResults || []), ...(interestResults || [])];
    const unique = Array.from(new Map(allResults.map((r) => [r.id, r])).values());
    setResults(unique.slice(0, 10) as SearchProfile[]);
    setLoading(false);
  }, [user]);

  // Debounced live search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => performSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, performSearch]);

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
              placeholder="Search by name or interest..."
              autoFocus
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
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
              <DefaultAvatar src={profile.photo_url} alt={profile.name} className="h-12 w-12" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-display text-sm font-bold text-foreground truncate">{profile.name}</p>
                  {profile.age && <span className="text-xs text-muted-foreground">{profile.age}</span>}
                  {profile.is_verified && (
                    <img src={verifiedBadge} alt="Verified" className="h-4 w-4" />
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
