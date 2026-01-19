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

const ALERT_THRESHOLDS = [0.8, 1.0];

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
  const year = Number(payload?.year);
  const month = String(payload?.month || "").trim();
  const category = String(payload?.category || "").trim();

  if (!Number.isFinite(year) || year <= 0) return jsonResponse({ error: "Missing/invalid year" }, 400);
  if (!month) return jsonResponse({ error: "Missing month" }, 400);
  if (!category) return jsonResponse({ error: "Missing category" }, 400);

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

  const { data: budgetRows, error: budgetErr } = await supabase
    .from("Budgets")
    .select("Amount,Budget")
    .eq("Year", year)
    .eq("Month", month)
    .eq("Category", category)
    .limit(1);

  if (budgetErr) return jsonResponse({ error: budgetErr.message }, 500);

  const budgetRow = (budgetRows || [])[0] as { Amount?: number; Budget?: number } | undefined;
  const budgetVal = Number(budgetRow?.Amount ?? budgetRow?.Budget ?? 0);
  if (!Number.isFinite(budgetVal) || budgetVal <= 0) {
    return jsonResponse({ ok: true, skipped: true, reason: "No budget set" }, 200);
  }

  const { data: expenseRows, error: expenseErr } = await supabase
    .from("Budget")
    .select("Actual")
    .eq("Year", year)
    .eq("Month", month)
    .eq("Category", category);

  if (expenseErr) return jsonResponse({ error: expenseErr.message }, 500);

  const total = (expenseRows || []).reduce((acc: number, r: any) => {
    const v = Number(r?.Actual || 0);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);

  const percent = budgetVal > 0 ? total / budgetVal : 0;

  const alertsToSend = ALERT_THRESHOLDS.filter((t) => percent >= t);
  if (alertsToSend.length === 0) {
    return jsonResponse({ ok: true, sent: 0, skipped: true, reason: "Below thresholds" }, 200);
  }

  const { data: subsData, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("device_id,endpoint,keys")
    .neq("device_id", creatorDeviceId || "__no_device__");

  if (subsErr) return jsonResponse({ error: subsErr.message }, 500);
  const subs = (subsData || []) as SubscriptionRow[];

  let sent = 0;
  const goneDeviceIds: string[] = [];
  const failures: Array<{ device_id: string; status?: number; message: string }> = [];
  const sentThresholds: number[] = [];

  for (const threshold of alertsToSend) {
    const { data: alreadySent, error: sentErr } = await supabase
      .from("push_budget_alerts_sent")
      .select("year")
      .eq("year", year)
      .eq("month", month)
      .eq("category", category)
      .eq("threshold", threshold)
      .maybeSingle();

    if (sentErr) return jsonResponse({ error: sentErr.message }, 500);
    if (alreadySent) continue;

    const pctText = `${Math.round(percent * 100)}%`;
    const budgetText = `$${budgetVal.toFixed(2)}`;
    const totalText = `$${total.toFixed(2)}`;

    const title = threshold >= 1 ? "🚨 Budget exceeded" : "📊 Budget alert";
    const body = `${category}: ${totalText} / ${budgetText} (${pctText})`;

    const message = {
      title,
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `budget-${year}-${month}-${category}-${threshold}`,
      requireInteraction: false,
      data: { url: "./", year, month, category, threshold },
    };

    const beforeSent = sent;

    await Promise.all(
      subs.map(async (row) => {
        try {
          const sub = appServer.subscribe({ endpoint: row.endpoint, keys: row.keys });
          await sub.pushTextMessage(JSON.stringify(message), {
            urgency: threshold >= 1 ? webpush.Urgency.High : webpush.Urgency.Normal,
            ttl: 60 * 60 * 12,
          });
          sent += 1;
        } catch (e: any) {
          if (e instanceof webpush.PushMessageError) {
            if (e.isGone()) {
              goneDeviceIds.push(row.device_id);
              return;
            }
            let respBody = "";
            try {
              respBody = await e.response.text();
            } catch (_err) {
              respBody = "";
            }
            failures.push({
              device_id: row.device_id,
              status: e.response.status,
              message: `${e.toString()}${respBody ? ` | ${respBody}` : ""}`,
            });
            return;
          }
          failures.push({ device_id: row.device_id, message: String(e?.message || e) });
        }
      }),
    );

    const hadAnySuccess = sent > beforeSent;
    if (hadAnySuccess) {
      sentThresholds.push(threshold);
      await supabase
        .from("push_budget_alerts_sent")
        .upsert(
          {
            year,
            month,
            category,
            threshold,
            total,
            budget: budgetVal,
          },
          { onConflict: "year,month,category,threshold" },
        );
    }
  }

  if (goneDeviceIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("device_id", goneDeviceIds);
  }

  return jsonResponse(
    {
      ok: true,
      year,
      month,
      category,
      budget: budgetVal,
      total,
      percent,
      thresholdsTriggered: alertsToSend,
      thresholdsSent: sentThresholds,
      sent,
      removed: goneDeviceIds.length,
      failures,
    },
    200,
  );
});
