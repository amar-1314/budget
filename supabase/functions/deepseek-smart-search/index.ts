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

function pad2(n: unknown) {
  const v = String(n ?? "").padStart(2, "0");
  return v.length === 2 ? v : v.slice(-2);
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

  // Strip ```json fences
  const unfenced = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const direct2 = safeJsonParse(unfenced);
  if (direct2 && typeof direct2 === "object") return direct2;

  // Extract first {...} block
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const block = unfenced.slice(firstBrace, lastBrace + 1);
    const parsed = safeJsonParse(block);
    if (parsed && typeof parsed === "object") return parsed;
  }

  return null;
}

function messagesToPrompt(messages: Array<{ role: string; content: string }>) {
  // Keep this simple and model-agnostic.
  // Many HF text-generation models follow instruction formats reasonably well with role tags.
  return (
    messages
      .map((m) => {
        const role = String(m?.role || "").trim().toUpperCase();
        const content = String(m?.content || "").trim();
        return `${role}: ${content}`;
      })
      .join("\n\n") +
    "\n\nASSISTANT:"
  );
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
      temperature: 0.2,
      max_tokens: 900,
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

type BudgetRow = {
  Category: string | null;
  Year: number | null;
  Month: number | string | null;
  Amount: number | string | null;
  Recurring?: unknown;
};

type ExpenseRow = {
  id: number | string;
  Item?: string | null;
  Category?: string | null;
  Year?: number | null;
  Month?: number | string | null;
  Day?: number | string | null;
  Actual?: number | string | null;
  Budget?: number | string | null;
  LLC?: string | null;
  Tags?: unknown;
  Notes?: string | null;
};

function toNumber(v: unknown) {
  if (v === null || v === undefined) return Number.NaN;
  if (typeof v === "number") return v;
  const m = String(v).match(/-?\d+(?:\.\d+)?/);
  if (!m) return Number.NaN;
  return parseFloat(m[0]);
}

function buildDataPack(expenses: ExpenseRow[], budgets: BudgetRow[]) {
  const monthlyCategorySpending: Record<string, Record<string, number>> = {};
  const categories = new Set<string>();
  const months = new Set<string>();

  for (const e of expenses) {
    const y = Number(e.Year);
    const m = pad2(e.Month);
    const cat = String(e.Category || "Uncategorized").trim() || "Uncategorized";
    const amt = toNumber(e.Actual);
    if (!Number.isFinite(y) || !m) continue;
    if (!Number.isFinite(amt)) continue;

    const monthKey = `${y}-${m}`;
    categories.add(cat);
    months.add(monthKey);

    monthlyCategorySpending[monthKey] ||= {};
    monthlyCategorySpending[monthKey][cat] = (monthlyCategorySpending[monthKey][cat] || 0) + amt;
  }

  const monthlyCategoryBudgets: Record<string, Record<string, number>> = {};
  for (const b of budgets) {
    const y = Number(b.Year);
    const m = pad2(b.Month);
    const cat = String(b.Category || "").trim();
    const amt = toNumber(b.Amount);
    if (!Number.isFinite(y) || !m || !cat) continue;
    if (!Number.isFinite(amt)) continue;

    const monthKey = `${y}-${m}`;
    categories.add(cat);
    months.add(monthKey);

    monthlyCategoryBudgets[monthKey] ||= {};
    monthlyCategoryBudgets[monthKey][cat] = amt;
  }

  const monthList = [...months].sort();
  const categoryList = [...categories].sort();

  const overspendByMonthCategory: Array<{ month: string; category: string; spent: number; budget: number; over: number }> = [];
  for (const month of monthList) {
    const spendCats = monthlyCategorySpending[month] || {};
    const budgetCats = monthlyCategoryBudgets[month] || {};
    for (const cat of Object.keys(spendCats)) {
      const spent = spendCats[cat] || 0;
      const budget = budgetCats[cat] || 0;
      if (budget > 0 && spent > budget + 0.01) {
        overspendByMonthCategory.push({
          month,
          category: cat,
          spent: Math.round(spent * 100) / 100,
          budget: Math.round(budget * 100) / 100,
          over: Math.round((spent - budget) * 100) / 100,
        });
      }
    }
  }

  overspendByMonthCategory.sort((a, b) => b.over - a.over);

  // Last 6 months helper
  const last6 = monthList.slice(-6);
  const last6SpendByCategory: Record<string, Array<{ month: string; spent: number }>> = {};
  for (const month of last6) {
    const spendCats = monthlyCategorySpending[month] || {};
    for (const cat of Object.keys(spendCats)) {
      last6SpendByCategory[cat] ||= [];
      last6SpendByCategory[cat].push({ month, spent: Math.round(spendCats[cat] * 100) / 100 });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    notes: [
      "Budgets are taken from the Budgets table (base budgets).",
      "Spending is summed from the Budget table (Actual field).",
      "Rollover logic is not applied server-side in this data pack.",
    ],
    months: monthList,
    categories: categoryList,
    spending: monthlyCategorySpending,
    budgets: monthlyCategoryBudgets,
    overspends: overspendByMonthCategory.slice(0, 200),
    last_6_months: {
      months: last6,
      spending_by_category: last6SpendByCategory,
    },
  };
}

async function callHuggingFace(apiKey: string, model: string, messages: Array<{ role: string; content: string }>) {
  // The old api-inference.huggingface.co endpoint is deprecated.
  // Use the new Inference Providers router endpoint (OpenAI-compatible).
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

  const query = String(payload?.query || "").trim();
  const history = Array.isArray(payload?.history) ? payload.history : [];
  if (!query) return jsonResponse({ error: "Missing query" }, 400);

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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: expensesRaw, error: expensesErr } = await supabase
    .from("Budget")
    .select("id,Item,Category,Year,Month,Day,Actual,Budget,LLC,Tags,Notes")
    .order("id", { ascending: false })
    .range(0, 4999);
  if (expensesErr) return jsonResponse({ error: expensesErr.message }, 500);

  const { data: budgetsRaw, error: budgetsErr } = await supabase
    .from("Budgets")
    .select("Category,Year,Month,Amount,Recurring")
    .order("Year", { ascending: true });

  // Budgets table is optional in some setups
  const budgets: BudgetRow[] = budgetsErr ? [] : (budgetsRaw as any[]);
  const expenses: ExpenseRow[] = (expensesRaw as any[]) || [];

  const dataPack = buildDataPack(expenses, budgets);

  const toolSchemaHint = {
    answer_markdown: "string",
    tables: [
      {
        title: "string",
        columns: ["string"],
        rows: [["string"]],
      },
    ],
    followups: ["string"],
  };

  const system =
    "You are an expert personal finance analyst for a budgeting app. " +
    "Answer the user's question using ONLY the provided JSON data pack. " +
    "If the data pack is insufficient, ask a clarifying question. " +
    "Return a single JSON object ONLY (no markdown fences) matching this schema: " +
    JSON.stringify(toolSchemaHint) +
    ". answer_markdown should be easy to read.";

  const dataMsg =
    "DATA_PACK (JSON):\n" +
    JSON.stringify(dataPack);

  const priorMessages: Array<{ role: string; content: string }> = [];
  for (const m of history.slice(-8)) {
    const role = String(m?.role || "").trim();
    const content = String(m?.content || "");
    if (role === "user" || role === "assistant") {
      priorMessages.push({ role, content: content.slice(0, 5000) });
    }
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: system },
    { role: "system", content: dataMsg },
    ...priorMessages,
    { role: "user", content: query },
  ];

  try {
    const result = await callHuggingFace(hfKey, hfModel, messages);
    return jsonResponse({ ok: true, result }, 200);
  } catch (e: any) {
    return jsonResponse({ error: String(e?.message || e) }, 500);
  }
});
