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

function parseNumberLoose(value: unknown): number {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "number") return value;
  const s = String(value);
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return Number.NaN;
  return parseFloat(m[0]);
}

function parseWeightDetailLine(rawDesc: string) {
  const s = String(rawDesc || "").trim();
  if (!s) return null;

  // Must look like a pricing detail line (e.g., "0.690 lb @ 1 lb /0.50")
  if (!s.includes("@") && !s.includes("/")) return null;

  const qtyUnitMatch = s.match(/(\d+(?:\.\d+)?)\s*(lb|kg|oz|g)\b/i);
  if (!qtyUnitMatch) return null;
  const quantity = parseFloat(qtyUnitMatch[1]);
  const unit = String(qtyUnitMatch[2]).toLowerCase();

  let unitPrice = Number.NaN;
  const slashMatches = [...s.matchAll(/\/\s*(?:\$\s*)?(\d+(?:\.\d+)?)/g)];
  if (slashMatches.length > 0) {
    unitPrice = parseFloat(slashMatches[slashMatches.length - 1][1]);
  } else {
    const atMatch = s.match(/@\s*(?:\$\s*)?(\d+(?:\.\d+)?)/i);
    if (atMatch) unitPrice = parseFloat(atMatch[1]);
  }

  if (!Number.isFinite(unitPrice)) return null;

  let lineTotal = Number.NaN;
  const nums = [...s.matchAll(/\d+(?:\.\d+)?/g)].map((m) => parseFloat(m[0]));
  if (nums.length >= 2) {
    const last = nums[nums.length - 1];
    if (Number.isFinite(last) && last >= 0 && Number.isFinite(unitPrice) && Math.abs(last - unitPrice) > 0.001) {
      lineTotal = last;
    }
  }

  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return { quantity, unit, unitPrice, lineTotal };
}

function normalizeParsedReceipt(parsed: any) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const out: any[] = [];

  for (const rawItem of items) {
    const item = rawItem && typeof rawItem === "object" ? { ...rawItem } : {};
    const rawDesc = String(item.raw_description || item.description || "").trim();
    const lower = rawDesc.toLowerCase();
    const looksLikeWeightLine = Boolean(rawDesc) && (lower.includes("lb") || lower.includes("kg") || lower.includes("oz") || lower.includes(" g"));

    if (looksLikeWeightLine && out.length > 0) {
      const parsedWeight = parseWeightDetailLine(rawDesc);
      if (parsedWeight) {
        const prev = out[out.length - 1];
        prev.quantity = parsedWeight.quantity;
        prev.quantity_unit = parsedWeight.unit || prev.quantity_unit || "ea";
        if (Number.isFinite(parsedWeight.unitPrice) && parsedWeight.unitPrice >= 0) {
          prev.unit_price = parsedWeight.unitPrice;
        }
        if (Number.isFinite(parsedWeight.lineTotal) && parsedWeight.lineTotal >= 0) {
          prev.total_price = Math.round(parsedWeight.lineTotal * 100) / 100;
        } else if (!Number.isFinite(parseNumberLoose(prev.total_price)) || parseNumberLoose(prev.total_price) === 0) {
          const computed = parseNumberLoose(prev.quantity) * parseNumberLoose(prev.unit_price);
          prev.total_price = Number.isFinite(computed) ? Math.round(computed * 100) / 100 : 0;
        }
        continue;
      }
    }

    const qty = parseNumberLoose(item.quantity);
    const unitPrice = parseNumberLoose(item.unit_price);
    const totalPrice = parseNumberLoose(item.total_price);

    item.quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
    item.quantity_unit = String(item.quantity_unit || "").trim() || "ea";
    item.unit_price = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
    item.total_price = Number.isFinite(totalPrice) && totalPrice >= 0 ? totalPrice : 0;

    if ((!item.total_price || item.total_price === 0) && item.unit_price && item.quantity) {
      const computed = item.quantity * item.unit_price;
      item.total_price = Number.isFinite(computed) ? Math.round(computed * 100) / 100 : 0;
    }
    if ((!item.unit_price || item.unit_price === 0) && item.total_price && item.quantity) {
      const computed = item.total_price / (item.quantity || 1);
      item.unit_price = Number.isFinite(computed) ? Math.round(computed * 100) / 100 : item.unit_price;
    }

    out.push(item);
  }

  return { ...parsed, items: out };
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

serve(async (req: Request) => {
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

    const { ocrText, imageDataUrl } = await req.json().catch(() => ({}));
    const hasOcrText = Boolean(ocrText && typeof ocrText === "string");
    const hasImage = Boolean(imageDataUrl && typeof imageDataUrl === "string");
    if (!hasOcrText && !hasImage) {
      return jsonResponse({ error: "Missing ocrText or imageDataUrl" }, 400);
    }

    const GEMINI_API_KEY = await getSecret(SUPABASE_URL, SERVICE_ROLE_KEY, "GEMINI_API_KEY");

    const prompt = hasOcrText
      ? `You are given OCR text extracted from a grocery receipt. Extract receipt data and return ONLY valid JSON.

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
${ocrText}`
      : `You are given an image of a grocery receipt. Extract receipt data and return ONLY valid JSON.

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
- Prices should be numbers without currency symbols`;

    const parts: Array<Record<string, unknown>> = [{ text: prompt }];
    if (hasImage) {
      const m = String(imageDataUrl).match(/^data:([^;]+);base64,(.+)$/i);
      if (!m) {
        return jsonResponse({ error: "Invalid imageDataUrl (expected data:<mime>;base64,...)" }, 400);
      }
      parts.push({
        inline_data: {
          mime_type: m[1],
          data: m[2],
        },
      });
    }

    const requestBody = {
      contents: [{ parts }],
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

    const firstObj = jsonStr.indexOf("{");
    const lastObj = jsonStr.lastIndexOf("}");
    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
      jsonStr = jsonStr.slice(firstObj, lastObj + 1);
    }
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1").trim();

    try {
      const parsed = JSON.parse(jsonStr);
      const normalized = normalizeParsedReceipt(parsed);
      return jsonResponse({ data: normalized });
    } catch (parseErr) {
      const err = parseErr as Error;
      return jsonResponse(
        {
          error: `Failed to parse Gemini JSON: ${err?.message || String(err)}`,
          geminiText: String(textResponse).slice(0, 1200),
        },
        422,
      );
    }
  } catch (e) {
    const err = e as Error;
    return jsonResponse({ error: err?.message || String(err) }, 500);
  }
});
