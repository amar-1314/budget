import { serve } from "https://deno.land/std@0.152.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const TO_ADDRESSES = ["amar.macha@icloud.com", "supriiya135@gmail.com"];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { type, record } = payload;

    if (type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Not an insert event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('New expense added:', record);

    const smtpUser = Deno.env.get('SMTP_USER') ?? '';
    const smtpPass = Deno.env.get('SMTP_PASS') ?? '';
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'Budget <budget@amarmacha.com>';
    if (!smtpUser || !smtpPass) throw new Error('SMTP credentials not configured');

    const amount = `$${Number(record.Actual || 0).toFixed(2)}`;
    const subject = `New Expense: ${record.Item} - ${amount}`;

    // Basic HTML escaping for any free-text fields.
    const esc = (s: unknown) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const row = (label: string, value: string) =>
      `<tr><td style="padding:5px 0;color:#888;width:160px">${label}</td><td style="padding:5px 0">${value}</td></tr>`;

    // NOTE: keep this on a single line (no inter-tag newlines/indentation).
    // denomailer quoted-printable-encodes the body and wraps at 76 chars; a
    // space that lands before a soft line-break gets encoded as a literal
    // "=20" that some mail clients (Apple Mail) render as visible text.
    const html =
      `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px">` +
      `<h2 style="margin:0 0 12px">New Expense Added</h2>` +
      `<table style="border-collapse:collapse;width:100%">` +
      row('Item', `<strong>${esc(record.Item || 'N/A')}</strong>`) +
      row('Category', esc(record.Category || 'N/A')) +
      row('Amount', `<strong>${amount}</strong>`) +
      row('Date', `${esc(record.Month)}/${esc(record.Day)}/${esc(record.Year)}`) +
      row('LLC', record.LLC ? 'Yes' : 'No') +
      row('Amar\u2019s share', `$${Number(record.AmarContribution || 0).toFixed(2)}`) +
      row('Priya\u2019s share', `$${Number(record.PriyaContribution || 0).toFixed(2)}`) +
      (record.Notes ? row('Notes', esc(record.Notes)) : '') +
      `</table>` +
      `<p style="margin:16px 0 0"><a href="https://budget.amarmacha.com">View budget</a></p>` +
      `</div>`;

    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.mail.me.com',
        port: 465,
        tls: true,
        auth: { username: smtpUser, password: smtpPass },
      },
    });

    await client.send({ from: smtpFrom, to: TO_ADDRESSES, subject, html });
    await client.close();

    console.log('✅ Email sent via iCloud SMTP');
    return new Response(JSON.stringify({ message: 'Email sent successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
