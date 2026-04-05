import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Bell, Heart, Users, Shield, Search as SearchIcon, MessageCircle, Check, UserPlus, Eye, Image } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_id: string | null;
}

const typeIcons: Record<string, React.ReactNode> = {
  like: <Heart className="h-4 w-4 text-pink-500" />,
  post_like: <Heart className="h-4 w-4 text-pink-500" />,
  comment: <MessageCircle className="h-4 w-4 text-primary" />,
  match: <Users className="h-4 w-4 text-primary" />,
  follow: <UserPlus className="h-4 w-4 text-primary" />,
  friend_request: <UserPlus className="h-4 w-4 text-primary" />,
  friend_accepted: <Users className="h-4 w-4 text-primary" />,
  profile_view: <Eye className="h-4 w-4 text-muted-foreground" />,
  photo_like: <Image className="h-4 w-4 text-pink-500" />,
  verification: <Shield className="h-4 w-4 text-accent" />,
  lost_found: <SearchIcon className="h-4 w-4 text-muted-foreground" />,
  confession: <MessageCircle className="h-4 w-4 text-secondary" />,
  general: <Bell className="h-4 w-4 text-muted-foreground" />,
};

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
    }

    if (notif.type === "profile_view") return;

    // Post like or comment → feed
    if (["post_like", "comment"].includes(notif.type) && notif.related_id) {
      navigate("/feed");
      return;
    }

    // Friend request / accepted → sender's profile
    if (["friend_request", "friend_accepted"].includes(notif.type) && notif.related_id) {
      navigate(`/profile/${notif.related_id}`);
      return;
    }

    // Like, follow, match, photo_like → sender's profile
    if (notif.related_id && ["like", "follow", "match", "photo_like"].includes(notif.type)) {
      navigate(`/profile/${notif.related_id}`);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  };

  const isClickable = (notif: Notification) => notif.type !== "profile_view" && notif.related_id;

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="font-display text-lg font-bold text-foreground">Notifications</h1>
          </div>
          <button onClick={markAllRead} className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors">
            <Check className="h-3 w-3" /> Mark all read
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 font-display text-lg font-bold text-foreground">No notifications</p>
            <p className="mt-1 text-sm text-muted-foreground">You're all caught up!</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98] ${
                notif.is_read ? "bg-card" : "bg-primary/5 border border-primary/10"
              } ${isClickable(notif) ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {typeIcons[notif.type] || typeIcons.general}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{notif.title}</p>
                    {!notif.is_read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{notif.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">{timeAgo(notif.created_at)}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default NotificationsPage;
