import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VAPID_PUBLIC_KEY } from "@/lib/push-config";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isPreviewIframe() {
  try {
    const inIframe = window.self !== window.top;
    const host = window.location.hostname;
    return inIframe || host.includes("id-preview--") || host.includes("lovableproject.com");
  } catch {
    return true;
  }
}

export type PushPermissionState = "default" | "granted" | "denied" | "unsupported";

/**
 * Manages Web Push subscription lifecycle:
 * - Registers /push-sw.js
 * - Exposes permission state and subscribe()/unsubscribe()
 * - Persists subscription to public.push_subscriptions
 *
 * Disabled inside the Lovable preview iframe to avoid SW pollution.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !isPreviewIframe();

  useEffect(() => {
    if (!supported) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermissionState);
    navigator.serviceWorker
      .register("/push-sw.js")
      .then((reg) => {
        console.log("[Push] Service worker registered:", reg.scope);
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        console.log("[Push] Existing subscription:", !!sub);
        setSubscribed(!!sub);
      })
      .catch((err) => console.error("[Push] SW registration failed:", err));
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported || !user) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      console.log("[Push] Permission result:", perm);
      setPermission(perm as PushPermissionState);
      if (perm !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh || bufToB64(sub.getKey("p256dh"));
      const auth = json.keys?.auth || bufToB64(sub.getKey("auth"));

      await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 200),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );

      setSubscribed(true);
      return true;
    } catch (e) {
      console.error("Push subscribe failed:", e);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, user]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !user) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [supported, user]);

  return { supported, permission, subscribed, busy, subscribe, unsubscribe };
}
