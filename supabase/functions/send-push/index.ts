// Send push notifications via Firebase Cloud Messaging HTTP v1 API.
// Invoked from the `dispatch_push_notification` DB trigger.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Parse service account from base64-encoded secret
function getServiceAccount() {
  const b64 = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_BASE64");
  if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 not set");
  const json = atob(b64);
  return JSON.parse(json);
}

// Generate OAuth2 access token from service account for FCM API
async function getAccessToken(): Promise<string> {
  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);

  // Build JWT header + claims
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const signingInput = enc(header) + "." + enc(claims);

  // Import the RSA private key
  const pemBody = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = signingInput + "." + sigB64;

  // Exchange JWT for access token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get access token: " + JSON.stringify(data));
  return data.access_token;
}

interface Payload {
  user_id: string;
  title: string;
  message: string;
  type?: string;
  related_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SERVICE_ROLE}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.user_id || !body.title) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch all FCM tokens for this user
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint")
    .eq("user_id", body.user_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err: any) {
    console.error("[send-push] Failed to get access token:", err.message);
    return new Response(JSON.stringify({ error: "FCM auth failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sa = getServiceAccount();
  const projectId = sa.project_id;
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const clickUrl = routeFor(body.type, body.related_id);

  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: s.endpoint, // FCM token
              notification: {
                title: body.title,
                body: body.message || "",
              },
              data: {
                type: body.type || "general",
                related_id: body.related_id || "",
                url: clickUrl,
              },
              webpush: {
                fcm_options: {
                  link: clickUrl,
                },
              },
            },
          }),
        });

        if (res.ok) {
          sent++;
        } else {
          const err = await res.json();
          console.error("[send-push] FCM error:", JSON.stringify(err));
          // Token no longer valid
          if (
            err?.error?.code === 404 ||
            err?.error?.code === 410 ||
            err?.error?.details?.some((d: any) =>
              d["@type"]?.includes("UNREGISTERED")
            )
          ) {
            stale.push(s.id);
          }
        }
      } catch (err: any) {
        console.error("[send-push] Send failed:", err.message);
      }
    }),
  );

  // Clean up stale tokens
  if (stale.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", stale);
  }

  return new Response(
    JSON.stringify({ ok: true, sent, removed: stale.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

function routeFor(type?: string, relatedId?: string | null): string {
  switch (type) {
    case "friend_request":
    case "friend_accepted":
    case "friend_accept":
      return "/friends";
    case "follow":
      return relatedId ? `/profile/${relatedId}` : "/friends";
    case "like":
    case "post_like":
    case "comment":
    case "comment_reply":
      return "/feed";
    case "profile_view":
      return "/notifications";
    default:
      return "/notifications";
  }
}
