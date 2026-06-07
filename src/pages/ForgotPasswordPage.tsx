import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import luitxLogo from "@/assets/luitx-logo.png";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@gmail.com")) {
      setError("Only Gmail accounts are allowed for MyCampus registration.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center bg-black px-6 pb-6 pt-[18vh]">
      <Link
        to="/"
        className="absolute left-5 top-6 flex items-center gap-1 text-sm text-white/70 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-lg">
            <img src={logo} alt="MyCampus" loading="eager" decoding="sync" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-white">Forgot Password</h1>
          <p className="mt-2 text-sm text-white/60 text-center">
            Enter your registered email to receive a password reset link.
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-white/10 bg-[#1a1d2e] p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-3 font-display text-lg font-bold text-white">Email Sent</h2>
            <p className="mt-2 text-sm text-white/70">
              Check <span className="font-semibold text-white">{email}</span> for the password reset link.
            </p>
            <Link
              to="/"
              className="mt-5 inline-block w-full rounded-xl bg-primary py-3 font-display text-sm font-bold text-primary-foreground"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-[#1a1d2e] px-4 py-3.5 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3.5 font-display text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-10">
        <p className="text-xs text-white/80 font-serif italic">
          Crafted with <span className="text-red-500">❤️</span> by
        </p>
        <img src={luitxLogo} alt="LuitX" loading="eager" decoding="sync" className="h-7 object-contain" />
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
