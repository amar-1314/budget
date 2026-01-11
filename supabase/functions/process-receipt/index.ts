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
    if (Number.isFinite(last) && last >= 0 && Math.abs(last - unitPrice) > 0.001) {
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
        prev.unit_price = parsedWeight.unitPrice;
        if (Number.isFinite(parsedWeight.lineTotal) && parsedWeight.lineTotal >= 0) {
          prev.total_price = Math.round(parsedWeight.lineTotal * 100) / 100;
        } else {
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

async function runOcrSpace(apiKey: string, input: { imageUrl?: string; base64Image?: string }) {
  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("language", "eng");
  form.append("isOverlayRequired", "false");
  form.append("OCREngine", "2");

  if (input.base64Image) form.append("base64Image", input.base64Image);
  else if (input.imageUrl) form.append("url", input.imageUrl);
  else throw new Error("Missing imageUrl/base64Image");

  const resp = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body: form,
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data?.ErrorMessage?.[0] || `OCR.Space failed: ${resp.status}`;
    throw new Error(msg);
  }
  if (data?.IsErroredOnProcessing) {
    const msg = data?.ErrorMessage?.[0] || "OCR.Space processing error";
    throw new Error(msg);
  }

  const text = data?.ParsedResults?.[0]?.ParsedText || "";
  return String(text);
}

async function callGeminiForOcrText(geminiApiKey: string, ocrText: string) {
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
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify(requestBody),
    },
  );

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data?.error?.message || `Gemini request failed: ${resp.status}`;
    throw new Error(msg);
  }

  const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) throw new Error("No text response from Gemini");

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

  const parsed = JSON.parse(jsonStr);
  return normalizeParsedReceipt(parsed);
}

function getExpenseIdFromPayload(payload: any): string {
  const direct = String(payload?.expenseId || "").trim();
  if (direct) return direct;

  const candidates = [payload?.record?.id, payload?.new?.id, payload?.new_record?.id, payload?.data?.id, payload?.id];
  for (const c of candidates) {
    const v = String(c || "").trim();
    if (v) return v;
  }
  return "";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true }, 200);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase service credentials not configured" }, 500);
    }

    const payload = await req.json().catch(() => ({}));
    const expenseId = getExpenseIdFromPayload(payload);
    if (!expenseId) return jsonResponse({ error: "Missing expenseId" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Acquire a "processing lock" by conditionally transitioning status to "processing".
    // This makes webhook + client kickoff idempotent.
    const { data: lockedRows, error: lockErr } = await supabase
      .from("Budget")
      .update({ receipt_processing_status: "processing", receipt_error: null })
      .eq("id", expenseId)
      .eq("has_receipt", true)
      .eq("receipt_scanned", false)
      .or("receipt_processing_status.is.null,receipt_processing_status.in.(pending,failed,processing)")
      .select("id,Item,Category,Year,Month,Day,has_receipt,receipt_scanned,receipt_processing_status,Receipt");

    if (lockErr) throw new Error(lockErr.message);
    if (!lockedRows || lockedRows.length === 0) {
      console.log("process-receipt: skipped (lock not acquired)", { expenseId });
      return jsonResponse({ ok: true, skipped: true, reason: "Not pending (already processing/completed/dismissed/skipped)" }, 200);
    }

    const row = lockedRows[0];
    if (!row) return jsonResponse({ error: "Expense not found" }, 404);

    const category = String((row as any).Category || "").toLowerCase();
    const isGrocery = category.includes("grocery") || category.includes("groceries");
    if (!isGrocery) {
      await supabase
        .from("Budget")
        .update({ receipt_processing_status: "skipped", receipt_error: null, receipt_scanned: true })
        .eq("id", expenseId);
      console.log("process-receipt: skipped (not grocery)", { expenseId, category });
      return jsonResponse({ ok: true, skipped: true, reason: "Not grocery" }, 200);
    }

    let receiptValue = (row as any).Receipt;
    if (!receiptValue) {
      for (let attempt = 1; attempt <= 6; attempt++) {
        await new Promise((r) => setTimeout(r, 650 * attempt));
        const { data: refreshed, error: refreshErr } = await supabase
          .from("Budget")
          .select("Receipt")
          .eq("id", expenseId)
          .maybeSingle();
        if (refreshErr) break;
        if (refreshed?.Receipt) {
          receiptValue = (refreshed as any).Receipt;
          break;
        }
      }
    }

    if (!receiptValue) {
      await supabase
        .from("Budget")
        .update({ receipt_processing_status: "pending", receipt_error: "Receipt not uploaded yet" })
        .eq("id", expenseId);
      console.log("process-receipt: retryable (receipt pointer missing)", { expenseId });
      return jsonResponse({ ok: false, retryable: true, reason: "Receipt not uploaded yet" }, 503);
    }

    const OCR_SPACE_API_KEY = await getSecret(SUPABASE_URL, SERVICE_ROLE_KEY, "OCR_SPACE_API_KEY");
    const GEMINI_API_KEY = await getSecret(SUPABASE_URL, SERVICE_ROLE_KEY, "GEMINI_API_KEY");

    // Derive an OCR input (prefer signed URL for Supabase storage receipts)
    let imageUrl = "";
    let base64Image = "";

    const rawReceipt = receiptValue;
    const parsedReceipt = typeof rawReceipt === "string" ? (() => {
      const s = rawReceipt.trim();
      if (s.startsWith("data:")) return [{ url: s }];
      if (s.startsWith("[") || s.startsWith("{")) {
        try {
          return JSON.parse(s);
        } catch (_e) {
          return [{ url: s }];
        }
      }
      return [{ url: s }];
    })() : rawReceipt;

    const arr = Array.isArray(parsedReceipt) ? parsedReceipt : [parsedReceipt];
    const first = (arr?.[0] || {}) as any;

    const url = String(first?.url || "");
    const storageType = String(first?.storage || "").toLowerCase();

    if (url && url.startsWith("data:")) {
      base64Image = url;
    } else if (storageType === "supabase") {
      const bucket = String(first?.bucket || "receipts");
      const path = String(first?.path || "");
      if (!path) throw new Error("Invalid receipt pointer (missing path)");
      const { data: signed, error: signedErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      if (signedErr) throw new Error(signedErr.message);
      imageUrl = String(signed?.signedUrl || "");
    } else if (url) {
      imageUrl = url;
    }

    if (!imageUrl && !base64Image) throw new Error("Unable to resolve receipt image");

    let ocrText = "";
    let lastErr: unknown = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (!ocrText) {
          ocrText = await runOcrSpace(OCR_SPACE_API_KEY, base64Image ? { base64Image } : { imageUrl });
        }

        if (!ocrText || ocrText.trim().length < 10) {
          throw new Error("OCR returned no text");
        }

        const parsed = await callGeminiForOcrText(GEMINI_API_KEY, ocrText);
        const items = Array.isArray((parsed as any)?.items) ? (parsed as any).items : [];
        if (!items.length) throw new Error("No items found");

        const y = Number((row as any).Year) || new Date().getFullYear();
        const m = String((row as any).Month || "01").padStart(2, "0");
        const d = String((row as any).Day || 1).padStart(2, "0");
        const purchaseDate = String((parsed as any).date || `${y}-${m}-${d}`);
        const store = String((parsed as any).store || (row as any).Item || "Unknown");

        // Avoid duplicates if retried while still pending/processing
        await supabase.from("ReceiptItems").delete().eq("expense_id", expenseId);

        for (const it of items) {
          const unit = String(it?.quantity_unit || "").trim();
          const baseName = String(it?.description || it?.raw_description || "Unknown Item").trim() || "Unknown Item";
          const itemName = unit && unit !== "ea" ? `${baseName} (${unit})` : baseName;

          const quantity = parseNumberLoose(it?.quantity);
          const unitPrice = parseNumberLoose(it?.unit_price);
          const totalPrice = parseNumberLoose(it?.total_price);

          await supabase.from("ReceiptItems").insert({
            expense_id: expenseId,
            item_name: itemName,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
            total_price: Number.isFinite(totalPrice) && totalPrice >= 0 ? totalPrice : 0,
            store,
            purchase_date: purchaseDate,
          });
        }

        await supabase
          .from("Budget")
          .update({ receipt_scanned: true, receipt_processing_status: "completed", receipt_error: null })
          .eq("id", expenseId);

        return jsonResponse({ ok: true, expenseId, itemCount: items.length }, 200);
      } catch (e) {
        lastErr = e;
        // backoff
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }

    const msg = String((lastErr as any)?.message || lastErr || "Unknown error");
    await supabase
      .from("Budget")
      .update({ receipt_processing_status: "failed", receipt_error: msg.slice(0, 255), receipt_scanned: false })
      .eq("id", expenseId);

    return jsonResponse({ ok: false, expenseId, error: msg }, 500);
  } catch (e: any) {
    return jsonResponse({ error: String(e?.message || e) }, 500);
  }
});
