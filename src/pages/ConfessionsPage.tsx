import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import ConfessionCard from "@/components/ConfessionCard";
import { mockConfessions } from "@/lib/mockData";
import { Flame, Plus } from "lucide-react";

type Tab = "latest" | "trending";

const ConfessionsPage = () => {
  const [tab, setTab] = useState<Tab>("latest");
  const [showCompose, setShowCompose] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTag, setNewTag] = useState<string>("crush");

  const sorted = tab === "trending"
    ? [...mockConfessions].sort((a, b) => b.likes - a.likes)
    : mockConfessions;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="font-display text-lg font-bold text-foreground">Confessions</h1>
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-90 transition-transform"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mx-auto flex max-w-md gap-2 px-4 pb-3">
          <button
            onClick={() => setTab("latest")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === "latest" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            Latest
          </button>
          <button
            onClick={() => setTab("trending")}
            className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === "trending" ? "bg-pink text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            <Flame className="h-3 w-3" /> Trending
          </button>
        </div>
      </div>

      {showCompose && (
        <div className="mx-auto max-w-md px-4 pt-4 animate-slide-up">
          <div className="rounded-2xl bg-card p-4">
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Write your anonymous confession..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
              rows={3}
            />
            <div className="mt-2 flex items-center gap-2">
              {["crush", "secret", "compliment", "guess-who"].map((t) => (
                <button
                  key={t}
                  onClick={() => setNewTag(t)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    newTag === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground border border-border"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowCompose(false);
                setNewText("");
              }}
              className="mt-3 w-full rounded-xl bg-primary py-2 text-sm font-display font-bold text-primary-foreground active:scale-[0.98]"
            >
              Post Anonymously
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-md space-y-3 px-4 pt-4">
        {sorted.map((confession) => (
          <ConfessionCard key={confession.id} confession={confession} />
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default ConfessionsPage;
