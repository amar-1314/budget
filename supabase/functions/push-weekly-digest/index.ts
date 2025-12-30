import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as webpush from "https://raw.githubusercontent.com/negrel/webpush/0.3.0/mod.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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

type BudgetRow = {
  Year: number;
  Month: string;
  Day: number;
  Category: string;
  Actual: number;
};

function datePartsInTimeZone(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const year = Number(map.year);
  const month = String(map.month);
  const day = Number(map.day);

  return { year, month, day, isoDate: `${map.year}-${map.month}-${map.day}` };
}

function addDaysUtc(date: Date, days: number) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function getWeekWindowEastern(now = new Date()) {
  const timeZone = "America/New_York";

  // Find "today" in Eastern and compute current day-of-week in Eastern.
  // We approximate by taking noon UTC for stability.
  const noonUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  const easternParts = datePartsInTimeZone(noonUtc, timeZone);

  // Convert eastern y-m-d to a Date (UTC midnight) for arithmetic.
  const easternDateUtc = new Date(`${easternParts.isoDate}T00:00:00Z`);

  // Get day-of-week for that UTC date (close enough for our y-m-d arithmetic).
  const dow = easternDateUtc.getUTCDay();
  const mondayOffset = (dow + 6) % 7; // Mon=0, Sun=6

  // Previous week: Monday..Sunday
  const start = addDaysUtc(easternDateUtc, -mondayOffset - 7);
  const end = addDaysUtc(start, 7);

  const startIso = datePartsInTimeZone(start, timeZone).isoDate;
  return { start, end, weekStartDate: startIso };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true }, 200);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
  }

  if (CRON_SECRET) {
    const provided = req.headers.get("x-cron-secret") ?? "";
    if (provided !== CRON_SECRET) return jsonResponse({ error: "Unauthorized" }, 401);
  }

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

  const { weekStartDate, start, end } = getWeekWindowEastern(new Date());

  const { data: alreadySent, error: alreadyErr } = await supabase
    .from("push_weekly_digests_sent")
    .select("week_start_date")
    .eq("week_start_date", weekStartDate)
    .maybeSingle();

  if (alreadyErr) return jsonResponse({ error: alreadyErr.message }, 500);
  if (alreadySent) return jsonResponse({ ok: true, skipped: true, reason: "Already sent", weekStartDate }, 200);

  // Build distinct (Year, Month) pairs for the 7-day window.
  const tz = "America/New_York";
  const pairs = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = addDaysUtc(start, i);
    const p = datePartsInTimeZone(d, tz);
    pairs.add(`${p.year}-${p.month}`);
  }

  let rows: BudgetRow[] = [];
  for (const key of pairs) {
    const [yStr, m] = key.split("-");
    const y = Number(yStr);

    // Fetch that month/year and filter by Day in window.
    const { data, error } = await supabase
      .from("Budget")
      .select("Year,Month,Day,Category,Actual")
      .eq("Year", y)
      .eq("Month", m);

    if (error) return jsonResponse({ error: error.message }, 500);
    rows = rows.concat((data || []) as BudgetRow[]);
  }

  // Filter by window days (Eastern y-m-d).
  const allowed = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = addDaysUtc(start, i);
    allowed.add(datePartsInTimeZone(d, tz).isoDate);
  }

  const filtered = rows.filter((r) => {
    const y = Number((r as any).Year);
    const m = String((r as any).Month).padStart(2, "0");
    const day = Number((r as any).Day);
    const iso = `${String(y).padStart(4, "0")}-${m}-${String(day).padStart(2, "0")}`;
    return allowed.has(iso);
  });

  const totalsByCategory = new Map<string, number>();
  let total = 0;
  for (const r of filtered) {
    const amt = Number((r as any).Actual || 0);
    if (!Number.isFinite(amt)) continue;
    total += amt;
    const cat = String((r as any).Category || "Other");
    totalsByCategory.set(cat, (totalsByCategory.get(cat) || 0) + amt);
  }

  const topCats = Array.from(totalsByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c, v]) => `${c}: $${v.toFixed(2)}`);

  const title = "🧾 Weekly spending summary";
  const body = total > 0
    ? `Total: $${total.toFixed(2)}${topCats.length ? ` | ${topCats.join(" • ")}` : ""}`
    : "No expenses recorded last week.";

  const message = {
    title,
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `weekly-digest-${weekStartDate}`,
    requireInteraction: false,
    data: { url: "./", weekStartDate },
  };

  const { data: subsData, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("device_id,endpoint,keys");

  if (subsErr) return jsonResponse({ error: subsErr.message }, 500);
  const subs = (subsData || []) as SubscriptionRow[];

  let sent = 0;
  const goneDeviceIds: string[] = [];
  const failures: Array<{ device_id: string; status?: number; message: string }> = [];

  await Promise.all(
    subs.map(async (row) => {
      try {
        const sub = appServer.subscribe({ endpoint: row.endpoint, keys: row.keys });
        await sub.pushTextMessage(JSON.stringify(message), {
          urgency: webpush.Urgency.Low,
          ttl: 60 * 60 * 48,
          topic: "weekly-digest",
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

  if (goneDeviceIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("device_id", goneDeviceIds);
  }

  if (sent > 0) {
    await supabase.from("push_weekly_digests_sent").insert({ week_start_date: weekStartDate });
  }

  return jsonResponse(
    {
      ok: true,
      weekStartDate,
      window: { start: start.toISOString(), end: end.toISOString() },
      total,
      topCategories: topCats,
      sent,
      removed: goneDeviceIds.length,
      failures,
    },
    200,
  );
});
