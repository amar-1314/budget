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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
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

    const { expenseId, dataUrl, year, month, filename } = await req.json().catch(() => ({}));

    if (!expenseId || typeof expenseId !== "string") {
      return jsonResponse({ error: "Missing expenseId" }, 400);
    }
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      return jsonResponse({ error: "Missing dataUrl" }, 400);
    }

    const { mime, bytes } = decodeDataUrl(dataUrl);
    const ext = extFromMime(mime);
    const safeYear = String(year || "unknown");
    const safeMonth = String(month || "unknown");
    const objectPath = `${safeYear}/${safeMonth}/${expenseId}.${ext}`;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(objectPath, bytes, {
        contentType: mime,
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);

    const pointer = {
      storage: "supabase",
      bucket: "receipts",
      path: objectPath,
      filename: filename || `${expenseId}.${ext}`,
      type: mime,
      size: bytes.byteLength,
    };

    return jsonResponse({ receipt: pointer });
  } catch (e) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
