import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseMessaging, getToken, onMessage } from "@/lib/firebase";
import { toast } from "sonner";

function isUnsupportedEnv() {
  try {
    const inIframe = window.self !== window.top;
    const host = window.location.hostname;
    const isLovablePreview =
      host.includes("id-preview--") || host.includes("lovableproject.com");
    return inIframe && isLovablePreview;
  } catch {
    return true;
  }
}

export type PushPermissionState = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    !isUnsupportedEnv();

  // Register SW & check existing token
  useEffect(() => {
    if (!supported) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermissionState);

    // Register firebase messaging SW
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((reg) => console.log("[FCM] SW registered:", reg.scope))
      .catch((err) => console.error("[FCM] SW registration failed:", err));

    // Check if we already have a token stored
    if (user) {
      supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .then(({ data }) => setSubscribed(!!(data && data.length > 0)));
    }
  }, [supported, user]);

  // Foreground message listener
  useEffect(() => {
    if (!supported) return;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging) return;
      unsubscribe = onMessage(messaging, (payload) => {
        console.log("[FCM] Foreground message:", payload);
        const title = payload.notification?.title || payload.data?.title || "MyCampus";
        const body = payload.notification?.body || payload.data?.body || "";
        toast(title, { description: body });
      });
    })();

    return () => unsubscribe?.();
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported || !user) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      console.log("[FCM] Permission result:", perm);
      setPermission(perm as PushPermissionState);
      if (perm !== "granted") return false;

      const messaging = await getFirebaseMessaging();
      if (!messaging) return false;

      const reg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");

      // Get the VAPID key from secrets (stored in edge function env)
      // For FCM getToken we need the VAPID key from Firebase Console
      const vapidKey = await fetchVapidKey();

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: reg,
      });

      console.log("[FCM] Token obtained:", token.slice(0, 20) + "...");

      // Upsert token to DB
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: token, // FCM token stored as endpoint
          p256dh: "fcm", // marker to identify FCM tokens
          auth: "fcm",
          user_agent: navigator.userAgent.slice(0, 200),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );

      console.log("[FCM] Token saved successfully");
      setSubscribed(true);
      return true;
    } catch (e) {
      console.error("[FCM] Subscribe failed:", e);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, user]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !user) return;
    setBusy(true);
    try {
      // Delete all tokens for this user
      await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [supported, user]);

  return { supported, permission, subscribed, busy, subscribe, unsubscribe };
}

/** Fetch the VAPID key via a lightweight edge function call */
async function fetchVapidKey(): Promise<string> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/get-vapid-key`,
  );
  const { vapidKey } = await res.json();
  return vapidKey;
}
