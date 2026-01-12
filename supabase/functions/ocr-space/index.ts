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

async function getSecret(supabaseUrl: string, serviceRoleKey: string, name: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("name", name)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.value) throw new Error(`Missing secret: ${name}`);
  return String(data.value);
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

  return jsonResponse({ error: "OCR proxy is disabled (client-only)" }, 410);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase service credentials not configured" }, 500);
    }

    const OCR_SPACE_API_KEY = await getSecret(SUPABASE_URL, SERVICE_ROLE_KEY, "OCR_SPACE_API_KEY");

    const { imageUrl, base64Image } = await req.json().catch(() => ({}));

    if (!imageUrl && !base64Image) {
      return jsonResponse({ error: "Missing imageUrl or base64Image" }, 400);
    }

    const form = new FormData();
    form.append("apikey", OCR_SPACE_API_KEY);
    form.append("language", "eng");
    form.append("isOverlayRequired", "false");
    form.append("OCREngine", "2");

    if (base64Image) {
      form.append("base64Image", base64Image);
    } else {
      form.append("url", imageUrl);
    }

    const resp = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form,
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      const msg = data?.ErrorMessage?.[0] || `OCR.Space failed: ${resp.status}`;
      return jsonResponse({ error: msg }, resp.status);
    }

    if (data?.IsErroredOnProcessing) {
      const msg = data?.ErrorMessage?.[0] || "OCR.Space processing error";
      return jsonResponse({ error: msg }, 400);
    }

    const text = data?.ParsedResults?.[0]?.ParsedText || "";
    return jsonResponse({ text });
  } catch (e) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
