import { Heart, Flag } from "lucide-react";
import { useState } from "react";
import type { Confession } from "@/lib/mockData";

const tagConfig: Record<string, { emoji: string; bg: string }> = {
  crush: { emoji: "💘", bg: "bg-confession-pink" },
  secret: { emoji: "🤫", bg: "bg-confession-yellow" },
  compliment: { emoji: "💌", bg: "bg-confession-blue" },
  "guess-who": { emoji: "👀", bg: "bg-confession-yellow" },
};

interface ConfessionCardProps {
  confession: Confession;
}

const ConfessionCard = ({ confession }: ConfessionCardProps) => {
  const [liked, setLiked] = useState(confession.liked ?? false);
  const [likes, setLikes] = useState(confession.likes);
  const config = tagConfig[confession.tag] || tagConfig.secret;

  const handleLike = () => {
    setLiked(!liked);
    setLikes((prev) => (liked ? prev - 1 : prev + 1));
  };

  return (
    <div className={`rounded-2xl p-4 ${config.bg} animate-slide-up`}>
      <div className="flex items-start justify-between">
        <span className="rounded-full bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
          {config.emoji} {confession.tag}
        </span>
        <span className="text-[10px] text-muted-foreground">{confession.timestamp}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground">{confession.text}</p>
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95 ${
            liked
              ? "bg-pink/15 text-pink"
              : "bg-background/50 text-muted-foreground"
          }`}
        >
          <Heart className="h-3.5 w-3.5" fill={liked ? "currentColor" : "none"} />
          {likes}
        </button>
        <button className="rounded-full p-1.5 text-muted-foreground/50 hover:text-destructive transition-colors">
          <Flag className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default ConfessionCard;
