import BottomNav from "@/components/BottomNav";
import InterestTag from "@/components/InterestTag";
import { mockProfiles } from "@/lib/mockData";
import { Check, LogOut, Edit, Shield, Instagram } from "lucide-react";
import { useNavigate } from "react-router-dom";

const me = {
  ...mockProfiles[1],
  name: "Rahul Das",
  phone: "+91 98765 43210",
  instagram: "@rahul.das21",
};

const ProfilePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="font-display text-lg font-bold text-foreground">My Profile</h1>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-3 w-3" /> Logout
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-6">
        {/* Photo + name */}
        <div className="flex flex-col items-center">
          <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-primary/20">
            <img src={me.photo} alt={me.name} className="h-full w-full object-cover" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-foreground">{me.name}, {me.age}</h2>
            {me.verified === "verified" && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                <Check className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{me.branch}</p>
        </div>

        {/* Bio */}
        <div className="mt-6 rounded-2xl bg-card p-4">
          <p className="text-sm text-foreground">{me.bio}</p>
        </div>

        {/* Details */}
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Looking for</p>
            <p className="text-sm font-medium text-foreground">{me.lookingFor}</p>
          </div>

          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Interests</p>
            <div className="flex flex-wrap gap-1.5">
              {me.interests.map((i) => (
                <InterestTag key={i} interest={i} />
              ))}
            </div>
          </div>

          {me.instagram && (
            <div className="rounded-2xl bg-card p-4 flex items-center gap-2">
              <Instagram className="h-4 w-4 text-pink" />
              <span className="text-sm text-foreground">{me.instagram}</span>
            </div>
          )}

          <div className="rounded-2xl bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Verification</p>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium capitalize text-foreground">{me.verified}</span>
            </div>
          </div>
        </div>

        <button className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display text-sm font-bold text-primary-foreground transition-all active:scale-[0.98]">
          <Edit className="h-4 w-4" /> Edit Profile
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
