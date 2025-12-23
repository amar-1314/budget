import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

type PushSubscription = {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true }, 200);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (_e) {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const deviceId = String(payload?.deviceId || "").trim();
  const subscription = payload?.subscription as PushSubscription | undefined;
  const userAgent = String(payload?.userAgent || "").trim();

  if (!deviceId) return jsonResponse({ error: "Missing deviceId" }, 400);
  if (!subscription?.endpoint) return jsonResponse({ error: "Missing subscription.endpoint" }, 400);
  if (!subscription?.keys?.auth || !subscription?.keys?.p256dh) {
    return jsonResponse({ error: "Missing subscription.keys" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        device_id: deviceId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        user_agent: userAgent,
        updated_at: now,
      },
      { onConflict: "device_id" },
    );

  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ ok: true }, 200);
});
