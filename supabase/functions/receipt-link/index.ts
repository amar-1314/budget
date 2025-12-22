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

    const { expenseId } = await req.json().catch(() => ({}));
    if (!expenseId || typeof expenseId !== "string") {
      return jsonResponse({ error: "Missing expenseId" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: row, error: rowError } = await supabase
      .from("Budget")
      .select("id,Receipt")
      .eq("id", expenseId)
      .maybeSingle();

    if (rowError) throw new Error(rowError.message);
    if (!row?.Receipt) return jsonResponse({ error: "No receipt" }, 404);

    const receiptParsed = parseReceiptField(row.Receipt);
    const arr = Array.isArray(receiptParsed) ? receiptParsed : [receiptParsed];
    const first = arr?.[0] as any;

    const storageType = String(first?.storage || "").toLowerCase();
    const url = String(first?.url || "");

    if (url && url.startsWith("data:")) {
      return jsonResponse({ url });
    }

    if (storageType === "supabase") {
      const bucket = String(first?.bucket || "");
      const path = String(first?.path || "");
      if (!bucket || !path) {
        return jsonResponse({ error: "Invalid receipt pointer" }, 500);
      }

      const { data: signed, error: signedError } = await supabase
        .storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60);

      if (signedError) throw new Error(signedError.message);
      if (!signed?.signedUrl) return jsonResponse({ error: "Unable to sign" }, 500);

      return jsonResponse({ url: signed.signedUrl });
    }

    if (url) {
      return jsonResponse({ url });
    }

    return jsonResponse({ error: "Unsupported receipt type" }, 400);
  } catch (e) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
