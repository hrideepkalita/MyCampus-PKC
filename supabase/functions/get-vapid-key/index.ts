const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const vapidKey = Deno.env.get("FIREBASE_VAPID_KEY") || "";

  return new Response(JSON.stringify({ vapidKey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
