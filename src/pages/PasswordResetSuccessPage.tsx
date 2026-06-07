import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { CheckCircle2 } from "lucide-react";

const PasswordResetSuccessPage = () => {
  const navigate = useNavigate();

  const handleLogin = async () => {
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
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h2 className="mt-3 font-display text-xl font-bold text-white">Password Reset Successful</h2>
          <p className="mt-2 text-sm text-white/70">
            Your password has been updated. Please log in with your new password.
          </p>
          <button
            onClick={handleLogin}
            className="mt-5 w-full rounded-xl bg-primary py-3 font-display text-sm font-bold text-primary-foreground"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetSuccessPage;
