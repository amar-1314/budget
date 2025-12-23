import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64Url } from "https://deno.land/std@0.224.0/encoding/base64url.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as webpush from "https://raw.githubusercontent.com/negrel/webpush/0.3.0/mod.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

async function getSecret(supabase: any, name: string): Promise<string> {
  const { data, error } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("name", name)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return String(data?.value || "");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true }, 200);
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const jwkJson = await getSecret(supabase, "PUSH_VAPID_KEYS_JWK");
    if (jwkJson) {
      const vapidKeys = await webpush.importVapidKeys(JSON.parse(jwkJson), { extractable: false });
      const raw = new Uint8Array(await crypto.subtle.exportKey("raw", vapidKeys.publicKey));
      const publicKey = encodeBase64Url(raw);
      return jsonResponse({ publicKey }, 200);
    }

    const publicKey = await getSecret(supabase, "PUSH_VAPID_PUBLIC_KEY");
    if (!publicKey) return jsonResponse({ error: "Missing PUSH_VAPID_KEYS_JWK or PUSH_VAPID_PUBLIC_KEY in app_secrets" }, 500);
    return jsonResponse({ publicKey }, 200);
  } catch (e: any) {
    return jsonResponse({ error: String(e?.message || e) }, 500);
  }
});
