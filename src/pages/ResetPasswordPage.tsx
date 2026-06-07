import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { Eye, EyeOff } from "lucide-react";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[ResetPassword] auth event:", event, !!session);
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        setReady(true);
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = window.location.hash;

        // Handle errors in URL
        const errDesc = url.searchParams.get("error_description") || new URLSearchParams(hash.replace(/^#/, "")).get("error_description");
        if (errDesc) {
          setError(decodeURIComponent(errDesc));
          return;
        }

        // PKCE code flow (?code=...)
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[ResetPassword] exchangeCodeForSession error:", error);
            setError(error.message);
            return;
          }
          if (data.session) {
            setReady(true);
            // Clean URL
            window.history.replaceState({}, "", "/reset-password");
            return;
          }
        }

        // Implicit/hash flow (#access_token=...&type=recovery)
        if (hash && hash.includes("access_token")) {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              setError(error.message);
              return;
            }
            setReady(true);
            window.history.replaceState({}, "", "/reset-password");
            return;
          }
        }

        // Fallback: existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setReady(true);
      } catch (e: any) {
        console.error("[ResetPassword] init error:", e);
        setError(e.message || "Failed to initialize recovery session.");
      }
    })();

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      navigate("/password-reset-success", { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-black px-6 pt-[20vh]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-lg">
            <img src={logo} alt="MyCampus" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-white">Reset Password</h1>
          <p className="mt-2 text-sm text-white/60 text-center">Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-white/10 bg-[#1a1d2e] px-4 py-3.5 pr-11 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-xl border border-white/10 bg-[#1a1d2e] px-4 py-3.5 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          {!ready && (
            <p className="rounded-lg bg-yellow-500/10 px-3 py-2 text-xs text-yellow-500">
              Waiting for recovery session...
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !ready}
            className="w-full rounded-xl bg-primary py-3.5 font-display text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

      </div>
    </div>
  );
};

export default ResetPasswordPage;
