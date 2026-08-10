// api/pickem-notify.js
// Vercel serverless function — emails a member's access code to the pool
// commissioner as an out-of-band backup (fired on join, code change, and
// forgot-code reset). The database stores only salted hashes; this email is
// the commissioner's one copy of the plaintext, which is the product's
// explicit recovery model for a private-group pool.
//
// The payload is AUTHENTICATED against the database before anything is sent:
// the member must exist in the pool and the submitted plaintext must hash to
// the stored passcode_hash (every legitimate caller fires this only after the
// hash write, so verification is race-free). The member's display name comes
// from the DB row, never the client. This keeps the recovery channel honest —
// without it, anyone holding the pool URL could forge backup emails.
//
// Degrades gracefully: without RESEND_API_KEY (or a commissioner email on the
// pool) it reports { sent: false, reason } and the client treats that as
// non-fatal — joining never blocks on email delivery. Invalid lookups return
// the same generic shape so the endpoint is not an enumeration oracle.

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import pkg from '@next/env';
const { loadEnvConfig } = pkg;

if (process.env.NODE_ENV !== 'production') {
  loadEnvConfig(process.cwd());
}

const KINDS = {
  created: 'joined the pool and created their access code',
  changed: 'changed their access code',
  reset: 'reset their access code via email recovery',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { poolId, memberId, passcode, kind } = req.body || {};
  if (typeof poolId !== 'string' || !/^[A-Z0-9]{5}$/i.test(poolId)
    || typeof memberId !== 'string' || !UUID_RE.test(memberId)
    || typeof passcode !== 'string' || passcode.length === 0 || passcode.length > 32
    || !KINDS[kind]) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Resolve pool and member server-side; verify the submitted code against the
  // stored hash. All failures share one generic response.
  const invalid = () => res.status(200).json({ sent: false, reason: 'invalid' });

  const { data: pool } = await supabase
    .from('pickem_pools')
    .select('name, commissioner_email')
    .eq('id', poolId.toUpperCase())
    .single();
  if (!pool) return invalid();

  const { data: member } = await supabase
    .from('pickem_members')
    .select('pool_id, name, passcode_salt, passcode_hash')
    .eq('id', memberId)
    .single();
  if (!member || member.pool_id !== poolId.toUpperCase()) return invalid();

  const submittedHash = createHash('sha256')
    .update(`${member.passcode_salt}:${passcode.trim()}`)
    .digest('hex');
  if (!member.passcode_hash || submittedHash !== member.passcode_hash) return invalid();

  if (!pool.commissioner_email) return res.status(200).json({ sent: false, reason: 'no_commissioner_email' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(200).json({ sent: false, reason: 'not_configured' });

  const from = process.env.PICKEM_EMAIL_FROM || 'Pinfall Fantasy <onboarding@resend.dev>';
  const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const memberName = member.name.slice(0, 60);

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [pool.commissioner_email],
        subject: `[${pool.name}] Access code backup — ${memberName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px">
            <p><b>${esc(memberName)}</b> ${KINDS[kind]} in your pick'em pool
            <b>${esc(pool.name)}</b>.</p>
            <p>Their access code, for your records:</p>
            <p style="font-size:22px;letter-spacing:3px;font-weight:bold;
              background:#f4f0e4;padding:12px 16px;display:inline-block">${esc(passcode.trim())}</p>
            <p style="color:#888;font-size:13px">You hold these backups so you can help
            members who lose access. This is the only copy — the database stores an
            irreversible hash. Keep this email.</p>
          </div>`,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('Resend error:', resp.status, detail);
      return res.status(200).json({ sent: false, reason: 'send_failed' });
    }
    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('pickem-notify failure:', err);
    return res.status(200).json({ sent: false, reason: 'send_failed' });
  }
}
