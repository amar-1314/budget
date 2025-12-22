/*
  One-time migration script:
  - Finds Budget rows that still have legacy base64 receipts stored in Postgres.
  - Uploads them to Supabase Storage via the receipt-upload Edge Function.
  - Replaces Budget.Receipt with a JSON pointer (small) to reduce DB growth.

  Usage:
    SUPABASE_URL="https://<project-ref>.supabase.co" \
    SUPABASE_ANON_KEY="<anon-key>" \
    node scripts/migrate-legacy-receipts-to-storage.mjs

  Optional:
    BATCH_SIZE=25 MAX_ROWS=500 DRY_RUN=1 node scripts/migrate-legacy-receipts-to-storage.mjs
*/

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars');
  process.exit(1);
}

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 25);
const MAX_ROWS = Number(process.env.MAX_ROWS || 1000000);
const DRY_RUN = String(process.env.DRY_RUN || '').trim() === '1';

const headersJson = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

function isDataUrl(s) {
  return typeof s === 'string' && s.trim().startsWith('data:');
}

function extractDataUrlFromReceiptField(receiptField) {
  if (!receiptField) return null;

  if (typeof receiptField === 'string') {
    const s = receiptField.trim();
    if (isDataUrl(s)) return s;

    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        const parsed = JSON.parse(s);
        return extractDataUrlFromReceiptField(parsed);
      } catch {
        return null;
      }
    }

    return null;
  }

  if (Array.isArray(receiptField)) {
    const first = receiptField[0];
    if (first && typeof first === 'object' && isDataUrl(first.url)) return first.url;
    if (isDataUrl(first)) return first;
    return null;
  }

  if (typeof receiptField === 'object') {
    if (isDataUrl(receiptField.url)) return receiptField.url;
    return null;
  }

  return null;
}

async function supabaseGetBudgetBatch(offset) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/Budget`);
  url.searchParams.set('select', 'id,Year,Month,Day,Receipt,has_receipt');
  url.searchParams.set('order', 'id.asc');
  url.searchParams.set('limit', String(BATCH_SIZE));
  url.searchParams.set('offset', String(offset));

  const resp = await fetch(url.toString(), { headers: headersJson });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Budget fetch failed ${resp.status}: ${txt}`);
  }
  return await resp.json();
}

async function updateBudgetReceipt(expenseId, receiptPointerArrayJson) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/Budget`);
  url.searchParams.set('id', `eq.${expenseId}`);

  const resp = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      ...headersJson,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ Receipt: receiptPointerArrayJson, has_receipt: true }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Budget update failed ${resp.status}: ${txt}`);
  }
}

async function uploadViaEdgeFunction(expenseId, dataUrl, year, month, filename) {
  const endpoint = `${SUPABASE_URL}/functions/v1/receipt-upload`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: headersJson,
    body: JSON.stringify({ expenseId, dataUrl, year, month, filename }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json?.error || `receipt-upload failed ${resp.status}`);
  }
  if (!json?.receipt) throw new Error('receipt-upload missing receipt pointer');
  return json.receipt;
}

function inferFilename(expenseId, dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,/);
  const mime = match ? match[1].toLowerCase() : '';
  let ext = 'jpg';
  if (mime.includes('png')) ext = 'png';
  else if (mime.includes('webp')) ext = 'webp';
  else if (mime.includes('gif')) ext = 'gif';
  return `${expenseId}.${ext}`;
}

async function main() {
  let offset = 0;
  let scanned = 0;
  let migrated = 0;

  console.log(`Starting legacy receipt migration (batch=${BATCH_SIZE}, maxRows=${MAX_ROWS}, dryRun=${DRY_RUN})`);

  while (scanned < MAX_ROWS) {
    const rows = await supabaseGetBudgetBatch(offset);
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const expenseId = row.id;
      const dataUrl = extractDataUrlFromReceiptField(row.Receipt);

      if (!dataUrl) continue;

      const year = row.Year || new Date().getFullYear();
      const month = String(row.Month || 1).padStart(2, '0');
      const filename = inferFilename(expenseId, dataUrl);

      console.log(`[${migrated + 1}] migrating expense=${expenseId} year=${year} month=${month}`);

      if (DRY_RUN) {
        migrated += 1;
        continue;
      }

      const pointer = await uploadViaEdgeFunction(expenseId, dataUrl, year, month, filename);

      const receiptPointerArrayJson = JSON.stringify([
        {
          ...pointer,
          migratedFrom: 'legacy_base64',
          migratedAt: new Date().toISOString(),
        },
      ]);

      await updateBudgetReceipt(expenseId, receiptPointerArrayJson);
      migrated += 1;
    }

    offset += rows.length;
  }

  console.log(`Done. scanned=${scanned} migrated=${migrated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
