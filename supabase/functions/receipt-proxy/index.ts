import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function corsHeaders(extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...extra,
  };
}

function parseReceiptField(raw: unknown): unknown {
  if (!raw) return null;

  if (typeof raw === "string") {
    const s = raw.trim();
    if (s.startsWith("data:")) return [{ url: s }];
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        return JSON.parse(s);
      } catch (_e) {
        return [{ url: s }];
      }
    }
    return [{ url: s }];
  }

  return raw;
}

async function getSecret(supabase: any, name: string): Promise<string> {
  const { data, error } = await supabase.from("app_secrets").select("value").eq("name", name).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) throw new Error(`Missing secret: ${name}`);
  return String(data.value);
}

function base64UrlEncode(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSignBase64Url(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

function constantTimeEqual(a: string, b: string) {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders({ "Content-Type": "application/json" }),
      },
    });
  }

  try {
    const url = new URL(req.url);
    const expenseId = url.searchParams.get("expenseId") || "";
    const expRaw = url.searchParams.get("exp") || "";
    const sig = url.searchParams.get("sig") || "";

    if (!expenseId) {
      return new Response(JSON.stringify({ error: "Missing expenseId" }), {
        status: 400,
        headers: {
          ...corsHeaders({ "Content-Type": "application/json" }),
        },
      });
    }

    if (!expRaw || !sig) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: {
          ...corsHeaders({ "Content-Type": "application/json" }),
        },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Supabase service credentials not configured" }), {
        status: 500,
        headers: {
          ...corsHeaders({ "Content-Type": "application/json" }),
        },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const signingSecret = await getSecret(supabase, "RECEIPT_PROXY_SIGNING_SECRET");
    const exp = Number(expRaw);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(exp) || exp < now - 30 || exp > now + 60 * 60) {
      return new Response(JSON.stringify({ error: "Expired signature" }), {
        status: 401,
        headers: {
          ...corsHeaders({ "Content-Type": "application/json" }),
        },
      });
    }

    const msg = `${expenseId}.${exp}`;
    const expectedSig = await hmacSignBase64Url(signingSecret, msg);
    if (!constantTimeEqual(expectedSig, sig)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: {
          ...corsHeaders({ "Content-Type": "application/json" }),
        },
      });
    }

    const { data: row, error: rowError } = await supabase
      .from("Budget")
      .select("id,Receipt")
      .eq("id", expenseId)
      .maybeSingle();

    if (rowError) throw new Error(rowError.message);

    const receiptParsed = parseReceiptField(row?.Receipt);
    const arr = Array.isArray(receiptParsed) ? receiptParsed : [receiptParsed];
    const first = arr?.[0] as any;

    const storageType = String(first?.storage || "").toLowerCase();

    if (storageType !== "pcloud_webdav") {
      return new Response(JSON.stringify({ error: "Not an archived receipt" }), {
        status: 400,
        headers: {
          ...corsHeaders({ "Content-Type": "application/json" }),
        },
      });
    }

    const baseUrl = String(first?.baseUrl || "") || (await getSecret(supabase, "PCLOUD_WEBDAV_BASE_URL"));
    const path = String(first?.path || "");

    if (!baseUrl || !path) {
      return new Response(JSON.stringify({ error: "Invalid archived receipt pointer" }), {
        status: 500,
        headers: {
          ...corsHeaders({ "Content-Type": "application/json" }),
        },
      });
    }

    const username = await getSecret(supabase, "PCLOUD_WEBDAV_USERNAME");
    const password = await getSecret(supabase, "PCLOUD_WEBDAV_PASSWORD");

    const auth = "Basic " + btoa(`${username}:${password}`);
    const fileUrl = `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

    const upstream = await fetch(fileUrl, {
      method: "GET",
      headers: {
        Authorization: auth,
      },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: `Archive fetch failed: ${upstream.status}` }), {
        status: 502,
        headers: {
          ...corsHeaders({ "Content-Type": "application/json" }),
        },
      });
    }

    const contentType = upstream.headers.get("content-type") || String(first?.type || "application/octet-stream");

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders({ "Content-Type": contentType, "Cache-Control": "private, max-age=300" }),
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: {
        ...corsHeaders({ "Content-Type": "application/json" }),
      },
    });
  }
});
