import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import FloatingHearts from "@/components/FloatingHearts";
import ErrorBoundary from "@/components/ErrorBoundary";
import SplashScreen from "@/components/SplashScreen";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyOtpPage from "./pages/VerifyOtpPage";
import FeedPage from "./pages/FeedPage";
import FriendsPage from "./pages/FriendsPage";
import DiscoverPage from "./pages/DiscoverPage";
import ConfessionsPage from "./pages/ConfessionsPage";
import ProfilePage from "./pages/ProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import LostFoundPage from "./pages/LostFoundPage";
import SearchPage from "./pages/SearchPage";
import ViewProfilePage from "./pages/ViewProfilePage";
import AdminPage from "./pages/AdminPage";
import NoticesPage from "./pages/NoticesPage";
import NotFound from "./pages/NotFound";
import { useState, useEffect, createContext, useContext } from "react";

// Context for floating hearts toggle
interface FloatingHeartsContextType {
  enabled: boolean;
  toggle: () => void;
}

const FloatingHeartsContext = createContext<FloatingHeartsContextType>({
  enabled: false,
  toggle: () => {},
});

export const useFloatingHearts = () => useContext(FloatingHeartsContext);

const queryClient = new QueryClient();

const AppContent = () => {
  const { loading, user } = useAuth();
  const { supported, permission, subscribed, subscribe } = usePushNotifications();
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  // Show splash for at least 2 seconds on app open
  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Auto-subscribe to push notifications when user is logged in
  useEffect(() => {
    if (user && supported && permission !== "denied" && !subscribed) {
      subscribe().then((ok) => {
        if (ok) console.log("[Push] Auto-subscribed successfully");
      });
    }
  }, [user, supported, permission, subscribed, subscribe]);
  const [heartsEnabled, setHeartsEnabled] = useState(() => {
    try {
      return localStorage.getItem("floating_hearts_enabled") === "true";
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setHeartsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("floating_hearts_enabled", String(next));
      return next;
    });
  };

  // Show splash while checking auth
  if (loading || !minSplashElapsed) {
    return <SplashScreen />;
  }

  return (
    <FloatingHeartsContext.Provider value={{ enabled: heartsEnabled, toggle }}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {heartsEnabled && <FloatingHearts count={18} />}
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
            <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
            <Route path="/confessions" element={<ProtectedRoute><ConfessionsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/profile/:id" element={<ProtectedRoute><ViewProfilePage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/lost-found" element={<ProtectedRoute><LostFoundPage /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/notices" element={<ProtectedRoute><NoticesPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </FloatingHeartsContext.Provider>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
