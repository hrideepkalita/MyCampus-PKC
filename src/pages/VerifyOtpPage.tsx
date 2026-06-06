import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import luitxLogo from "@/assets/luitx-logo.png";
import { ArrowLeft } from "lucide-react";

const OTP_TTL_SECONDS = 600; // 10 minutes
const RESEND_COOLDOWN = 60;

const VerifyOtpPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const type = (params.get("type") as "signup" | "recovery") || "signup";

  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) navigate("/", { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      setResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleChange = (i: number, val: string) => {
    const v = val.replace(/\D/g, "").slice(0, 1);
    const next = [...code];
    next[i] = v;
    setCode(next);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (txt.length === 6) {
      e.preventDefault();
      setCode(txt.split(""));
      inputsRef.current[5]?.focus();
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    const token = code.join("");
    if (token.length !== 6) {
      setError("Please enter the full 6-digit code");
      return;
    }
    if (secondsLeft === 0) {
      setError("Code expired. Please request a new one.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: type === "recovery" ? "recovery" : "email",
      });
      if (error) throw error;
      if (type === "recovery") {
        navigate("/reset-password", { replace: true });
      } else {
        navigate("/feed", { replace: true });
      }
    } catch (err: any) {
      setError(err.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setResending(true);
    setError("");
    try {
      if (type === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resend({ type: "signup", email });
        if (error) throw error;
      }
      setSecondsLeft(OTP_TTL_SECONDS);
      setResendIn(RESEND_COOLDOWN);
    } catch (err: any) {
      setError(err.message || "Could not resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center bg-black px-6 pb-6 pt-[14vh]">
      <Link
        to={type === "recovery" ? "/forgot-password" : "/"}
        className="absolute left-5 top-6 flex items-center gap-1 text-sm text-white/70 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-lg">
            <img src={logo} alt="MyCampus" loading="eager" decoding="sync" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-white">Verify your email</h1>
          <p className="mt-2 text-sm text-white/60 text-center">
            Enter the 6-digit code we sent to<br />
            <span className="font-semibold text-white">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="flex justify-between gap-2" onPaste={handlePaste}>
            {code.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputsRef.current[i] = el)}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                inputMode="numeric"
                maxLength={1}
                className="h-14 w-12 rounded-xl border border-white/10 bg-[#1a1d2e] text-center text-xl font-bold text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className={`${secondsLeft === 0 ? "text-destructive" : "text-white/60"}`}>
              {secondsLeft > 0 ? `Expires in ${fmt(secondsLeft)}` : "Code expired"}
            </span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendIn > 0 || resending}
              className="font-semibold text-primary disabled:text-white/30"
            >
              {resending ? "Sending..." : resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
            </button>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3.5 font-display text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
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

export default VerifyOtpPage;
