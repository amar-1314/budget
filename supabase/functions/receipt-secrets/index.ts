import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const ocrSpaceApiKey = await getSecret(supabase, "OCR_SPACE_API_KEY");
    const geminiApiKey = await getSecret(supabase, "GEMINI_API_KEY");

    if (!ocrSpaceApiKey || !geminiApiKey) {
      return jsonResponse(
        {
          error: "Missing OCR_SPACE_API_KEY and/or GEMINI_API_KEY in app_secrets",
          missing: {
            OCR_SPACE_API_KEY: !ocrSpaceApiKey,
            GEMINI_API_KEY: !geminiApiKey,
          },
        },
        500,
      );
    }

    return jsonResponse({ ocrSpaceApiKey, geminiApiKey }, 200);
  } catch (e: any) {
    return jsonResponse({ error: String(e?.message || e) }, 500);
  }
});
