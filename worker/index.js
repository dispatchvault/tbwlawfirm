/**
 * Worker in front of the static assets. wrangler.jsonc routes only /api/* and
 * /media/* through it; every other request is served straight from dist/.
 *
 *   POST /api/forms  website forms (ZINC forms protocol:
 *                    ~/Projects/zinc-tooling/forms-protocol.md): store in D1
 *                    first, then email the firm via Resend, then optionally
 *                    send the visitor a confirmation.
 *   GET  /media/*    adds HTTP Range (206) support. Cloudflare's asset server
 *                    always answers 200 with the whole file, and Safari / iOS
 *                    refuse to play <video> without partial responses.
 *
 * Configuration (Cloudflare dashboard, not this public repo):
 *   RESEND_API_KEY     secret
 *   FORM_NOTIFY_TO     comma-separated recipients
 *   FORM_NOTIFY_FROM   e.g. "TBW Law Website <website@tbwlawfirm.com>"
 *   FORM_CONFIRM_FROM  optional; when set, the visitor gets a confirmation
 *   DB                 D1 binding (wrangler.jsonc)
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/forms') return handleForm(request, env, url);
    if (url.pathname.startsWith('/media/')) return serveMedia(request, env);
    return env.ASSETS.fetch(request);
  }
};

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

const MAX_BODY = 32 * 1024;
const RATE_LIMIT = 10; // submissions per IP per 10 minutes
const FIRM_CONTACT = 'call (949) 706-7100';
const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid'];
// form field names -> labels in the notification email, in display order
const FIELD_LABELS = {
  'First-Name': 'First name',
  'Last-Name': 'Last name',
  Email: 'Email',
  'email-2': 'Email',
  'Lead-Type': 'I am a',
  'How-can-we-help-you': 'How can we help'
};
const INTERNAL_FIELDS = new Set(['_form', 'company-website', '_page', '_referrer', '_tracking']);

async function handleForm(request, env, url) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return reply(wantsJson, 403, 'Forbidden');
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return reply(wantsJson, 413, 'Too large');

  let form;
  try {
    form = await request.formData();
  } catch (_e) {
    return reply(wantsJson, 400, 'Bad request');
  }
  const fields = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string' && !INTERNAL_FIELDS.has(key)) fields[key] = value.trim().slice(0, 5000);
  }
  // bots fill the honeypot; give them a success so they move on
  if ((form.get('company-website') || '').toString().trim()) return reply(wantsJson, 200, 'ok');

  const formName = String(form.get('_form') || 'Contact').slice(0, 60);
  const email = (fields.Email || fields['email-2'] || fields.email || '').toLowerCase();
  const name = [fields['First-Name'], fields['Last-Name']].filter(Boolean).join(' ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(wantsJson, 400, 'Please enter a valid email address.');

  if (!env.DB) {
    console.error('forms: DB binding missing — submission not stored');
    return reply(wantsJson, 503, `Our form is temporarily unavailable. Please ${FIRM_CONTACT}.`);
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM form_submissions WHERE ip = ?1 AND created_at > datetime('now', '-10 minutes')"
  ).bind(ip).first();
  if (recent && recent.n >= RATE_LIMIT) return reply(wantsJson, 429, `Too many submissions. Please ${FIRM_CONTACT}.`);

  let tracking = {};
  try {
    const t = JSON.parse(String(form.get('_tracking') || '{}'));
    for (const k of TRACKING_KEYS) if (t[k]) tracking[k] = String(t[k]).slice(0, 300);
  } catch (_e) {
    tracking = {};
  }

  const id = crypto.randomUUID();
  const pageUrl = String(form.get('_page') || request.headers.get('Referer') || '').slice(0, 1000);
  try {
    await env.DB.prepare(
      `INSERT INTO form_submissions
         (id, form_name, email, name, fields, page_url, referrer, tracking, user_agent, country, ip, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'new')`
    ).bind(
      id, formName, email, name, JSON.stringify(fields), pageUrl,
      String(form.get('_referrer') || '').slice(0, 1000), JSON.stringify(tracking),
      (request.headers.get('User-Agent') || '').slice(0, 300), (request.cf && request.cf.country) || '', ip
    ).run();
  } catch (e) {
    console.error('forms: store failed', e);
    return reply(wantsJson, 500, `Something went wrong. Please ${FIRM_CONTACT}.`);
  }

  // stored — from here on nothing can lose the lead; email failures are logged
  const submission = { id, formName, email, name, fields, pageUrl, tracking };
  if (await sendNotification(env, submission)) {
    await env.DB.prepare("UPDATE form_submissions SET notified_at = datetime('now') WHERE id = ?1").bind(id).run();
  }
  if (env.FORM_CONFIRM_FROM && formName === 'Contact' && (await sendConfirmation(env, submission))) {
    await env.DB.prepare("UPDATE form_submissions SET confirmed_at = datetime('now') WHERE id = ?1").bind(id).run();
  }
  return reply(wantsJson, 200, 'ok');
}

function reply(wantsJson, status, message) {
  if (wantsJson) {
    return new Response(JSON.stringify({ ok: status === 200, message }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
  // no-JavaScript fallback: a plain page with the outcome and a way back
  const title = status === 200 ? 'Thank you! Your submission has been received.' : message;
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TBW Law</title><body style="font-family:sans-serif;max-width:36em;margin:4em auto;padding:0 1em"><p>${escapeHtml(title)}</p><p><a href="/">Back to tbwlawfirm.com</a></p></body>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function sendNotification(env, s) {
  const to = (env.FORM_NOTIFY_TO || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!env.RESEND_API_KEY || !env.FORM_NOTIFY_FROM || !to.length) {
    console.error(`forms: notification not configured — submission ${s.id} stored only`);
    return false;
  }
  const rows = [];
  const seen = new Set();
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    if (s.fields[key]) { rows.push([label, s.fields[key]]); seen.add(key); }
  }
  for (const [key, value] of Object.entries(s.fields)) {
    if (!seen.has(key) && value) rows.push([key.replace(/[-_]+/g, ' '), value]);
  }
  rows.push(['Page', s.pageUrl]);
  const trackingText = Object.entries(s.tracking).map(([k, v]) => `${k}=${v}`).join(', ');
  if (trackingText) rows.push(['Ad tracking', trackingText]);
  rows.push(['Reference', s.id]);

  const subject = `New website lead: ${s.name || s.email} (${s.formName})`;
  const text = `${subject}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nReply to this email to answer ${s.name || 'the sender'} directly.`;
  const html = `<p><strong>${escapeHtml(subject)}</strong></p><table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="color:#666;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td>${escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('')}</table><p style="font-family:sans-serif;font-size:13px;color:#666">Reply to this email to answer ${escapeHtml(s.name || 'the sender')} directly.</p>`;
  return resend(env, { from: env.FORM_NOTIFY_FROM, to, reply_to: s.email, subject, text, html }, s.id);
}

async function sendConfirmation(env, s) {
  const first = s.fields['First-Name'] || '';
  // wording pending the firm's approval (FORM_CONFIRM_FROM stays unset until then)
  const text = [
    `Hi${first ? ' ' + first : ''},`,
    '',
    'Thank you for contacting TBW Law. We received your message and a member of our team will be in touch soon.',
    '',
    'If your matter is urgent, please call us at (949) 706-7100.',
    '',
    'TBW Law',
    '1000 Newport Center Dr., Newport Beach, CA 92660',
    '',
    'Contacting us does not create an attorney-client relationship.'
  ].join('\n');
  const html = text.split('\n\n').map((p) => `<p style="font-family:sans-serif;font-size:14px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  const replyTo = (env.FORM_NOTIFY_TO || '').split(',')[0].trim() || undefined;
  return resend(env, { from: env.FORM_CONFIRM_FROM, to: [s.email], reply_to: replyTo, subject: 'We received your message — TBW Law', text, html }, s.id);
}

async function resend(env, payload, id) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`forms: Resend ${res.status} for submission ${id}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`forms: Resend error for submission ${id}`, e);
    return false;
  }
}

function escapeHtml(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* Media with Range support                                            */
/* ------------------------------------------------------------------ */

async function serveMedia(request, env) {
  const res = await env.ASSETS.fetch(request.url, { method: request.method === 'HEAD' ? 'HEAD' : 'GET' });
  if (res.status !== 200) return res;

  const headers = new Headers(res.headers);
  headers.set('Accept-Ranges', 'bytes');
  const range = request.headers.get('Range');
  if (request.method === 'HEAD' || !range) {
    return new Response(res.body, { status: 200, headers });
  }

  const body = await res.arrayBuffer();
  const size = body.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start;
  let end;
  if (m && m[1] !== '') {
    start = Number(m[1]);
    end = m[2] !== '' ? Math.min(Number(m[2]), size - 1) : size - 1;
  } else if (m && m[2] !== '') {
    // suffix range: the last N bytes
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  }
  if (start === undefined || start > end || start >= size) {
    headers.set('Content-Range', `bytes */${size}`);
    headers.delete('Content-Length');
    return new Response(null, { status: 416, headers });
  }

  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(new Uint8Array(body, start, end - start + 1), { status: 206, headers });
}
