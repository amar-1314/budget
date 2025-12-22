import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
    const OCR_SPACE_API_KEY = Deno.env.get("OCR_SPACE_API_KEY");
    if (!OCR_SPACE_API_KEY) {
      return jsonResponse({ error: "OCR_SPACE_API_KEY is not configured" }, 500);
    }

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
