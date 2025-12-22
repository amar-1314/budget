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

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase service credentials not configured" }, 500);
    }

    const { ocrText } = await req.json().catch(() => ({}));
    if (!ocrText || typeof ocrText !== "string") {
      return jsonResponse({ error: "Missing ocrText" }, 400);
    }

    const GEMINI_API_KEY = await getSecret(SUPABASE_URL, SERVICE_ROLE_KEY, "GEMINI_API_KEY");

    const prompt = `You are given OCR text extracted from a grocery receipt. Extract receipt data and return ONLY valid JSON.

Return JSON in this exact schema:
{
  "store": "store/merchant name",
  "date": "YYYY-MM-DD format",
  "total": number,
  "items": [
    {
      "raw_description": "exact line item text from receipt",
      "description": "cleaned, normalized grocery item name",
      "quantity": number,
      "quantity_unit": "lb|kg|oz|g|ct|ea|gal|qt|pt|l|ml",
      "unit_price": number,
      "total_price": number
    }
  ]
}

Rules:
- Return ONLY JSON (no markdown)
- Normalize items: remove store codes, abbreviations, and extra whitespace
- Keep brand if it's important for identifying the item
- quantity_unit must be one of the allowed values (default "ea")
- If weight-based item is detected (e.g. "0.66 lb"), set quantity=0.66 and quantity_unit="lb"
- For non-weight items, quantity=1 and quantity_unit="ea" unless explicit
- Prices should be numbers without currency symbols

OCR TEXT:
${ocrText}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
    };

    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify(requestBody),
      },
    );

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      const msg = data?.error?.message || `Gemini request failed: ${resp.status}`;
      return jsonResponse({ error: msg }, resp.status);
    }

    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      return jsonResponse({ error: "No text response from Gemini" }, 500);
    }

    let jsonStr = String(textResponse).trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);
    return jsonResponse({ data: parsed });
  } catch (e) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
