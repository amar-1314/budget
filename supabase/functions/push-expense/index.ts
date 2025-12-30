import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as webpush from "https://raw.githubusercontent.com/negrel/webpush/0.3.0/mod.ts";

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

async function getSecret(supabase: any, name: string): Promise<string> {
  const { data, error } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("name", name)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return String(data?.value || "");
}

type SubscriptionRow = {
  device_id: string;
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
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (_e) {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const creatorDeviceId = String(payload?.creatorDeviceId || "").trim();
  const expenseId = String(payload?.expenseId || "").trim();
  const item = String(payload?.item || "Expense").trim();
  const amount = Number(payload?.amount || 0);

  if (!creatorDeviceId) return jsonResponse({ error: "Missing creatorDeviceId" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let vapidKeysJson = "";
  let contact = "";
  try {
    vapidKeysJson = await getSecret(supabase, "PUSH_VAPID_KEYS_JWK");
    contact = await getSecret(supabase, "PUSH_VAPID_CONTACT");
  } catch (e: any) {
    return jsonResponse({ error: String(e?.message || e) }, 500);
  }

  if (!vapidKeysJson) return jsonResponse({ error: "Missing PUSH_VAPID_KEYS_JWK in app_secrets" }, 500);
  if (!contact) return jsonResponse({ error: "Missing PUSH_VAPID_CONTACT in app_secrets" }, 500);

  let vapidKeys: CryptoKeyPair;
  try {
    vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidKeysJson), { extractable: false });
  } catch (_e) {
    return jsonResponse({ error: "Invalid PUSH_VAPID_KEYS_JWK JSON" }, 500);
  }

  const appServer = await webpush.ApplicationServer.new({
    contactInformation: contact,
    vapidKeys,
  });

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("device_id,endpoint,keys")
    .neq("device_id", creatorDeviceId);

  if (error) return jsonResponse({ error: error.message }, 500);

  const subs = (data || []) as SubscriptionRow[];

  const bodyText = `${item} - $${isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
  const message = {
    title: "💰 New Expense Added",
    body: bodyText,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "expense-notification",
    requireInteraction: false,
    data: { url: "./", expenseId },
  };

  let sent = 0;
  const goneDeviceIds: string[] = [];
  const failures: Array<{ device_id: string; status?: number; message: string }> = [];

  await Promise.all(
    subs.map(async (row) => {
      try {
        const sub = appServer.subscribe({ endpoint: row.endpoint, keys: row.keys });
        await sub.pushTextMessage(JSON.stringify(message), { urgency: webpush.Urgency.High, ttl: 60 * 60, topic: "expense" });
        sent += 1;
      } catch (e: any) {
        if (e instanceof webpush.PushMessageError) {
          if (e.isGone()) {
            goneDeviceIds.push(row.device_id);
            return;
          }
          failures.push({ device_id: row.device_id, status: e.response.status, message: e.toString() });
          return;
        }
        failures.push({ device_id: row.device_id, message: String(e?.message || e) });
      }
    }),
  );

  if (goneDeviceIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("device_id", goneDeviceIds);
  }

  return jsonResponse({ ok: true, sent, removed: goneDeviceIds.length, failures }, 200);
});
