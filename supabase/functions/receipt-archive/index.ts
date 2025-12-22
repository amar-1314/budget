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

async function getSecret(supabase: any, name: string): Promise<string> {
  const { data, error } = await supabase.from("app_secrets").select("value").eq("name", name).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) throw new Error(`Missing secret: ${name}`);
  return String(data.value);
}

async function ensureWebDavDir(baseUrl: string, path: string, auth: string) {
  const url = `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const resp = await fetch(url, { method: "MKCOL", headers: { Authorization: auth } });
  if (resp.status === 201 || resp.status === 405) return;
  if (resp.ok) return;
  const txt = await resp.text().catch(() => "");
  throw new Error(`WebDAV MKCOL failed ${resp.status}: ${txt}`);
}

async function ensureWebDavDirsRecursive(baseUrl: string, fullPath: string, auth: string) {
  const cleaned = fullPath.replace(/\/+$/, "");
  const parts = cleaned.split("/").filter((p) => p.length > 0);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    await ensureWebDavDir(baseUrl, current, auth);
  }
}

function monthPad(m: unknown) {
  return String(m ?? "").padStart(2, "0");
}

function toDate(Year: any, Month: any, Day: any) {
  const y = Number(Year);
  const m = Number(Month);
  const d = Number(Day || 1);
  if (!y || !m) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function extFromMime(mime: string) {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("bmp")) return "bmp";
  if (m.includes("tiff")) return "tiff";
  return "jpg";
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

    const { months, limit, deleteFromSupabase } = await req.json().catch(() => ({}));

    const monthsToArchive = Number(months || 12);
    const rowLimit = Number(limit || 25);
    const doDelete = Boolean(deleteFromSupabase);

    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - monthsToArchive);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const providedSecret = req.headers.get("x-archive-secret") || "";
    const requiredSecret = await getSecret(supabase, "RECEIPT_ARCHIVE_JOB_SECRET");
    if (!providedSecret || providedSecret !== requiredSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const baseUrl = await getSecret(supabase, "PCLOUD_WEBDAV_BASE_URL");
    const username = await getSecret(supabase, "PCLOUD_WEBDAV_USERNAME");
    const password = await getSecret(supabase, "PCLOUD_WEBDAV_PASSWORD");
    const rootPath = await getSecret(supabase, "PCLOUD_WEBDAV_ROOT_PATH");

    const auth = "Basic " + btoa(`${username}:${password}`);

    const pageSize = Math.max(50, Math.min(500, rowLimit * 10));
    let offset = 0;
    let scanned = 0;
    let archived = 0;
    const errors: Array<{ id: string; error: string }> = [];

    while (archived < rowLimit) {
      const { data: rows, error: rowsError } = await supabase
        .from("Budget")
        .select("id,Year,Month,Day,Receipt,has_receipt")
        .eq("has_receipt", true)
        .order("Year", { ascending: true })
        .order("Month", { ascending: true })
        .order("Day", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (rowsError) throw new Error(rowsError.message);
      if (!rows || rows.length === 0) break;

      scanned += rows.length;

      const candidates = (rows || []).filter((r: any) => {
        const dt = toDate(r.Year, r.Month, r.Day);
        if (!dt) return false;
        if (dt >= cutoff) return false;

        const parsed = parseReceiptField(r.Receipt);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const first = arr?.[0] as any;
        const storage = String(first?.storage || "").toLowerCase();
        if (storage !== "supabase") return false;
        return true;
      });

      for (const r of candidates) {
        if (archived >= rowLimit) break;

        const parsed = parseReceiptField(r.Receipt);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const first = arr?.[0] as any;
        const bucket = String(first?.bucket || "");
        const path = String(first?.path || "");
        const mime = String(first?.type || "application/octet-stream");
        const ext = extFromMime(mime);

        if (!bucket || !path) {
          errors.push({ id: r.id, error: "Invalid supabase receipt pointer" });
          continue;
        }

        try {
          const { data: file, error: dlError } = await supabase.storage.from(bucket).download(path);
          if (dlError) throw new Error(dlError.message);
          if (!file) throw new Error("Download returned empty file");

          const bytes = new Uint8Array(await file.arrayBuffer());

          const y = String(r.Year || "unknown");
          const m = monthPad(r.Month || "unknown");
          const cleanedRoot = rootPath.replace(/\/+$/, "");
          const yearDir = `${cleanedRoot}/${y}`;
          const monthDir = `${cleanedRoot}/${y}/${m}`;

          await ensureWebDavDirsRecursive(baseUrl, cleanedRoot, auth);
          await ensureWebDavDirsRecursive(baseUrl, yearDir, auth);
          await ensureWebDavDirsRecursive(baseUrl, monthDir, auth);

          const destPath = `${monthDir}/${r.id}.${ext}`;
          const destUrl = `${baseUrl.replace(/\/+$/, "")}${destPath.startsWith("/") ? "" : "/"}${destPath}`;

          const put = await fetch(destUrl, {
            method: "PUT",
            headers: {
              Authorization: auth,
              "Content-Type": mime,
              "Content-Length": String(bytes.byteLength),
            },
            body: bytes,
          });

          if (!put.ok) {
            const txt = await put.text().catch(() => "");
            throw new Error(`WebDAV PUT failed ${put.status}: ${txt}`);
          }

          const newPointer = {
            storage: "pcloud_webdav",
            baseUrl,
            path: destPath,
            type: mime,
            archivedAt: new Date().toISOString(),
          };

          await supabase
            .from("Budget")
            .update({ Receipt: JSON.stringify([newPointer]) })
            .eq("id", r.id);

          if (doDelete) {
            await supabase.storage.from(bucket).remove([path]);
          }

          archived += 1;
        } catch (e: any) {
          errors.push({ id: r.id, error: e?.message || String(e) });
        }
      }

      offset += pageSize;
    }

    return jsonResponse({
      cutoff: cutoff.toISOString(),
      scanned,
      archived,
      errors,
    });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
