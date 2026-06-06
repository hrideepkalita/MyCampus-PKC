import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import luitxLogo from "@/assets/luitx-logo.png";
import { Eye, EyeOff } from "lucide-react";

const LoginPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user) navigate("/feed", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, gender },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage("Check your email to confirm your account!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/feed");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center bg-black px-6 pb-6 pt-[22vh] overflow-hidden">
      <div className="relative z-10 w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="flex h-36 w-36 items-center justify-center rounded-[2rem] bg-white shadow-xl">
            <img src={logo} alt="MyCampus" loading="eager" decoding="sync" className="h-28 w-28 object-contain" />
          </div>
          <h1 className="mt-7 font-display text-4xl font-bold text-white">MyCampus</h1>
          <div className="text-sm text-white/70 mt-3 text-center leading-relaxed">
            <p>Computer Science Department</p>
            <p>Pub Kamrup College, Baihata Chariali</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-[#1a1d2e] px-4 py-3.5 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                {["Male", "Female", "Other"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition-colors ${
                      gender === g
                        ? "bg-primary text-primary-foreground"
                        : "border border-white/10 bg-[#1a1d2e] text-white/60"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </>
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-[#1a1d2e] px-4 py-3.5 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-white/10 bg-[#1a1d2e] px-4 py-3.5 pr-11 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {!isSignUp && (
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          {message && (
            <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3.5 font-display text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Please wait..." : isSignUp ? "Create Account" : "Log In"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-white/70">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); setMessage(""); }}
            className="font-semibold text-primary"
          >
            {isSignUp ? "Log In" : "Sign Up"}
          </button>
        </p>
      </div>

      <div className="mt-auto flex flex-col items-center pt-10">
        <div className="flex items-center gap-2">
          <p className="text-xs text-white/80 font-serif italic">
            Crafted with <span className="text-red-500">❤️</span> by
          </p>
          <img src={luitxLogo} alt="LuitX" loading="eager" decoding="sync" className="h-7 object-contain" />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
