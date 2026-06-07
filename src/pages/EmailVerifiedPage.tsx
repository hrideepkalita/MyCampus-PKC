import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { CheckCircle2, XCircle } from "lucide-react";

const EmailVerifiedPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    // Supabase auto-exchanges the code/token in the URL (detectSessionInUrl)
    // Wait briefly for it to settle, then check session.
    let cancelled = false;

    const check = async () => {
      // Give detectSessionInUrl a moment to process
      await new Promise((r) => setTimeout(r, 400));
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setStatus("error");
        return;
      }
      if (data.session) {
        setStatus("success");
      } else {
        // Still check after auth event
        setTimeout(async () => {
          const { data: d2 } = await supabase.auth.getSession();
          if (cancelled) return;
          if (d2.session) setStatus("success");
          else {
            setError("Verification link is invalid or has expired.");
            setStatus("error");
          }
        }, 1200);
      }
    };
    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        setStatus("success");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleContinue = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-black px-6 pt-[18vh]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-lg">
            <img src={logo} alt="MyCampus" loading="eager" decoding="sync" className="h-16 w-16 object-contain" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1a1d2e] p-6 text-center">
          {status === "checking" && (
            <>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <h2 className="mt-4 font-display text-lg font-bold text-white">Verifying your email...</h2>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
              <h2 className="mt-3 font-display text-xl font-bold text-white">Email Verified</h2>
              <p className="mt-2 text-sm text-white/70">
                Your account is now active. You can log in to MyCampus.
              </p>
              <button
                onClick={handleContinue}
                className="mt-5 w-full rounded-xl bg-primary py-3 font-display text-sm font-bold text-primary-foreground"
              >
                Continue to Login
              </button>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="mx-auto h-14 w-14 text-destructive" />
              <h2 className="mt-3 font-display text-lg font-bold text-white">Verification Failed</h2>
              <p className="mt-2 text-sm text-white/70">{error}</p>
              <button
                onClick={() => navigate("/", { replace: true })}
                className="mt-5 w-full rounded-xl bg-primary py-3 font-display text-sm font-bold text-primary-foreground"
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerifiedPage;
