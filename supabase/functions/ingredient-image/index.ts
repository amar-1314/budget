import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Streams the original ingredient-scan image back from pCloud.
// The pointer is looked up server-side from public.ingredient_scans so
// pCloud credentials never leave the edge runtime.
//
// Request:  GET /ingredient-image?scanId=<id>
// Response: image bytes with the original content-type

function corsHeaders(extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    ...extra,
  };
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders({ "Content-Type": "application/json" }) },
  });
}

async function getSecret(supabase: any, name: string): Promise<string> {
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
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return errorResponse("Supabase service credentials not configured", 500);
    }

    const url = new URL(req.url);
    const scanId = url.searchParams.get("scanId") || "";
    if (!scanId || !/^[A-Za-z0-9_\-]+$/.test(scanId)) {
      return errorResponse("Missing or invalid scanId", 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: row, error: rowError } = await supabase
      .from("ingredient_scans")
      .select("id,image_pointer")
      .eq("id", scanId)
      .maybeSingle();

    if (rowError) throw new Error(rowError.message);
    if (!row) return errorResponse("Scan not found", 404);

    const pointer = row.image_pointer as any;
    const storage = String(pointer?.storage || "").toLowerCase();
    if (storage !== "pcloud_webdav") {
      return errorResponse("No image stored for this scan", 404);
    }

    const baseUrl =
      String(pointer?.baseUrl || "") ||
      (await getSecret(supabase, "PCLOUD_WEBDAV_BASE_URL"));
    const path = String(pointer?.path || "");
    if (!baseUrl || !path) {
      return errorResponse("Invalid image pointer", 500);
    }

    const username = await getSecret(supabase, "PCLOUD_WEBDAV_USERNAME");
    const password = await getSecret(supabase, "PCLOUD_WEBDAV_PASSWORD");
    const auth = "Basic " + btoa(`${username}:${password}`);

    const fileUrl = `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
    const upstream = await fetch(fileUrl, {
      method: "GET",
      headers: { Authorization: auth },
    });

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text().catch(() => "");
      return errorResponse(`pCloud fetch failed ${upstream.status}: ${txt}`, 502);
    }

    const contentType =
      upstream.headers.get("content-type") ||
      String(pointer?.type || "application/octet-stream");

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders({
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=300",
        }),
      },
    });
  } catch (e: any) {
    return errorResponse(e?.message || String(e), 500);
  }
});
