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

async function getSecretFromTable(supabaseUrl: string, serviceRoleKey: string, name: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("name", name)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return String(data?.value || "");
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

function extractJsonObject(raw: string) {
  const s = String(raw || "").trim();
  if (!s) return null;

  const direct = safeJsonParse(s);
  if (direct && typeof direct === "object") return direct;

  const unfenced = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const direct2 = safeJsonParse(unfenced);
  if (direct2 && typeof direct2 === "object") return direct2;

  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const block = unfenced.slice(firstBrace, lastBrace + 1);
    const parsed = safeJsonParse(block);
    if (parsed && typeof parsed === "object") return parsed;
  }

  return null;
}

function normalizeHuggingFaceModel(model: string) {
  const m = String(model || "").trim();
  if (!m) return m;

  const aliases: Record<string, string> = {
    "meta-llama/Meta-Llama-3.1-70B-Instruct": "meta-llama/Llama-3.1-70B-Instruct",
    "meta-llama/Meta-Llama-3.1-8B-Instruct": "meta-llama/Llama-3.1-8B-Instruct",
  };

  return aliases[m] || m;
}

async function callHuggingFaceChatCompletions(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
) {
  const resp = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 600,
      stream: false,
    }),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const errMsg = data?.error?.message || data?.error || `Hugging Face error ${resp.status}`;
    throw new Error(String(errMsg));
  }

  const content = String(data?.choices?.[0]?.message?.content || "").trim();
  const parsed = extractJsonObject(content);
  if (!parsed) {
    throw new Error("Hugging Face returned non-JSON response");
  }

  return parsed;
}

async function callHuggingFace(apiKey: string, model: string, messages: Array<{ role: string; content: string }>) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await callHuggingFaceChatCompletions(apiKey, model, messages);
    } catch (e: any) {
      const msg = String(e?.message || e);
      const isLoading = /loading|currently loading|is loading|try again/i.test(msg);
      if (isLoading && attempt < 3) {
        const waitMs = Math.min(2000 * attempt, 5000);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw e;
    }
  }

  throw new Error("Hugging Face request failed after retries");
}

function toNumber(v: unknown) {
  if (v === null || v === undefined) return Number.NaN;
  if (typeof v === "number") return v;
  const m = String(v).match(/-?\d+(?:\.\d+)?/);
  if (!m) return Number.NaN;
  return parseFloat(m[0]);
}

function clampCandidates(candidates: any[]) {
  const list = Array.isArray(candidates) ? candidates : [];
  return list.slice(0, 60).map((c) => ({
    id: String(c?.id || ""),
    Item: String(c?.Item || ""),
    Category: c?.Category === null || c?.Category === undefined ? null : String(c?.Category),
    Year: Number.isFinite(toNumber(c?.Year)) ? Number(toNumber(c?.Year)) : null,
    Month: c?.Month === null || c?.Month === undefined ? null : String(c?.Month),
    Day: Number.isFinite(toNumber(c?.Day)) ? Number(toNumber(c?.Day)) : null,
    Actual: Number.isFinite(toNumber(c?.Actual)) ? Number(toNumber(c?.Actual)) : null,
    Notes: c?.Notes === null || c?.Notes === undefined ? null : String(c?.Notes),
  }));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true }, 200);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (_e) {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const newExpense = payload?.newExpense || {};
  const item = String(newExpense?.Item || "").trim();
  const year = toNumber(newExpense?.Year);
  const month = String(newExpense?.Month || "").trim();

  if (!item) return jsonResponse({ error: "Missing newExpense.Item" }, 400);
  if (!Number.isFinite(year)) return jsonResponse({ error: "Missing newExpense.Year" }, 400);
  if (!month) return jsonResponse({ error: "Missing newExpense.Month" }, 400);

  let hfKey = String(Deno.env.get("HUGGINGFACE_API_KEY") ?? "").trim();
  if (!hfKey) {
    try {
      hfKey = (await getSecretFromTable(SUPABASE_URL, SERVICE_ROLE_KEY, "HUGGINGFACE_API_KEY")).trim();
    } catch (_e) {
      // ignore
    }
  }
  if (!hfKey) {
    return jsonResponse({ error: "Hugging Face API key not configured (set HUGGINGFACE_API_KEY)" }, 500);
  }

  const hfModel =
    normalizeHuggingFaceModel(String(Deno.env.get("HUGGINGFACE_MODEL") ?? "").trim()) ||
    "meta-llama/Llama-3.1-8B-Instruct";

  const candidates = clampCandidates(payload?.candidates || []);

  const toolSchemaHint = {
    duplicates: [
      {
        id: "string",
        confidence: 0.0,
        isExactDuplicate: false,
        reason: "string",
      },
    ],
  };

  const system =
    "You are a strict duplicate-expense detector for a budgeting app. " +
    "You must determine whether the NEW expense is the same real-world transaction as any candidate expense from the SAME month/year. " +
    "Only flag duplicates when they are very likely the same transaction (same merchant/vendor meaning, very similar description, similar amount, and same day or very close day). " +
    "Do NOT flag as duplicates just because category/date/amount are similar. " +
    "If uncertain, return no duplicates. " +
    "Return a single JSON object ONLY (no markdown fences) matching this schema: " +
    JSON.stringify(toolSchemaHint);

  const user =
    "NEW_EXPENSE (JSON):\n" +
    JSON.stringify({
      Item: String(newExpense?.Item || ""),
      Category: newExpense?.Category ?? null,
      Year: Number(year),
      Month: month,
      Day: newExpense?.Day ?? null,
      Actual: newExpense?.Actual ?? null,
      Notes: newExpense?.Notes ?? null,
    }) +
    "\n\nCANDIDATES (JSON ARRAY):\n" +
    JSON.stringify(candidates);

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  try {
    const result = await callHuggingFace(hfKey, hfModel, messages);
    const duplicatesRaw = Array.isArray((result as any)?.duplicates) ? (result as any).duplicates : [];

    const normalized = duplicatesRaw
      .map((d: any) => ({
        id: String(d?.id || "").trim(),
        confidence: toNumber(d?.confidence),
        isExactDuplicate: Boolean(d?.isExactDuplicate),
        reason: String(d?.reason || "").trim(),
      }))
      .filter((d: any) => d.id)
      .slice(0, 3);

    return jsonResponse({ ok: true, duplicates: normalized }, 200);
  } catch (e: any) {
    return jsonResponse({ error: String(e?.message || e) }, 500);
  }
});
