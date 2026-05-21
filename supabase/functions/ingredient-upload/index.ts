import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Uploads an ingredient scan image straight to pCloud over WebDAV.
// Unlike receipts (which land in Supabase Storage first and are archived
// to pCloud later by receipt-archive), ingredient images have no aging
// lifecycle — we skip the Supabase Storage hop and write to pCloud once.
//
// Request:  POST { scanId, dataUrl, year?, month? }
// Response: { pointer: { storage:'pcloud_webdav', baseUrl, path, type, size } }

function corsHeaders(extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...extra,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders({ "Content-Type": "application/json" }) },
  });
}

function extFromMime(mime: string) {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("bmp")) return "bmp";
  if (m.includes("tiff")) return "tiff";
  return "jpg";
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  const mime = match[1];
  const b64 = match[2];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return { mime, bytes };
}

async function getSecret(supabase: any, name: string): Promise<string> {
  const { data, error } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("name", name)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) throw new Error(`Missing secret: ${name}`);
  return String(data.value);
}

async function ensureWebDavDir(baseUrl: string, path: string, auth: string) {
  const url = `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const resp = await fetch(url, { method: "MKCOL", headers: { Authorization: auth } });
  // 201 = created, 405 = already exists (Method Not Allowed on existing dir).
  if (resp.status === 201 || resp.status === 405 || resp.ok) return;
  const txt = await resp.text().catch(() => "");
  throw new Error(`WebDAV MKCOL failed ${resp.status}: ${txt}`);
}

async function ensureWebDavDirsRecursive(baseUrl: string, fullPath: string, auth: string) {
  const cleaned = fullPath.replace(/\/+$/, "");
  const parts = cleaned.split("/").filter((p) => p.length > 0);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    await ensureWebDavDir(baseUrl, current, auth);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase service credentials not configured" }, 500);
    }

    const { scanId, dataUrl, year, month } = await req.json().catch(() => ({}));

    if (!scanId || typeof scanId !== "string") {
      return jsonResponse({ error: "Missing scanId" }, 400);
    }
    if (!/^[A-Za-z0-9_\-]+$/.test(scanId)) {
      return jsonResponse({ error: "Invalid scanId" }, 400);
    }
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      return jsonResponse({ error: "Missing dataUrl" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const baseUrl = await getSecret(supabase, "PCLOUD_WEBDAV_BASE_URL");
    const username = await getSecret(supabase, "PCLOUD_WEBDAV_USERNAME");
    const password = await getSecret(supabase, "PCLOUD_WEBDAV_PASSWORD");
    // Reuse the receipts root if a dedicated ingredients root isn't set.
    let ingredientsRoot = "";
    try {
      ingredientsRoot = await getSecret(supabase, "PCLOUD_WEBDAV_INGREDIENTS_ROOT");
    } catch (_e) {
      const receiptsRoot = await getSecret(supabase, "PCLOUD_WEBDAV_ROOT_PATH");
      ingredientsRoot = `${receiptsRoot.replace(/\/+$/, "")}/ingredients`;
    }

    const { mime, bytes } = decodeDataUrl(dataUrl);
    const ext = extFromMime(mime);

    const now = new Date();
    const y = String(year || now.getUTCFullYear());
    const m = String(month || (now.getUTCMonth() + 1)).padStart(2, "0");

    const cleanedRoot = ingredientsRoot.replace(/\/+$/, "");
    const yearDir = `${cleanedRoot}/${y}`;
    const monthDir = `${cleanedRoot}/${y}/${m}`;
    const destPath = `${monthDir}/${scanId}.${ext}`;

    const auth = "Basic " + btoa(`${username}:${password}`);

    await ensureWebDavDirsRecursive(baseUrl, cleanedRoot, auth);
    await ensureWebDavDirsRecursive(baseUrl, yearDir, auth);
    await ensureWebDavDirsRecursive(baseUrl, monthDir, auth);

    const destUrl = `${baseUrl.replace(/\/+$/, "")}${destPath.startsWith("/") ? "" : "/"}${destPath}`;
    const put = await fetch(destUrl, {
      method: "PUT",
      headers: {
        Authorization: auth,
        "Content-Type": mime,
        "Content-Length": String(bytes.byteLength),
      },
      body: bytes,
    });

    if (!put.ok) {
      const txt = await put.text().catch(() => "");
      throw new Error(`WebDAV PUT failed ${put.status}: ${txt}`);
    }

    const pointer = {
      storage: "pcloud_webdav",
      baseUrl,
      path: destPath,
      type: mime,
      size: bytes.byteLength,
      uploadedAt: new Date().toISOString(),
    };

    return jsonResponse({ pointer });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
