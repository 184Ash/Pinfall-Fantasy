// ─── ACCESS CODE UTILITIES ────────────────────────────────────────────────────
// Members secure their pool identity with a short access code. Codes are
// deliberately low-ceremony: they're shared with the commissioner by design
// (out-of-band email backup), so the UI tells people NOT to reuse a real
// password. We store only a salted SHA-256 hash — Web Crypto, no dependencies.

const CODE_MIN_LENGTH = 4;
const CODE_MAX_LENGTH = 32;
// Unambiguous alphabet (no 0/O, 1/I/L) — same spirit as generateJoinCode()
const GEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function validatePasscode(raw) {
  const code = (raw || '').trim();
  if (code.length < CODE_MIN_LENGTH) return { ok: false, reason: `Use at least ${CODE_MIN_LENGTH} characters.` };
  if (code.length > CODE_MAX_LENGTH) return { ok: false, reason: `Keep it under ${CODE_MAX_LENGTH} characters.` };
  return { ok: true, code };
}

export function generatePasscode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => GEN_ALPHABET[b % GEN_ALPHABET.length]).join('');
}

export function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPasscode(passcode, salt) {
  const data = new TextEncoder().encode(`${salt}:${passcode.trim()}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function passcodeMatches(passcode, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const actual = await hashPasscode(passcode, salt);
  return actual === expectedHash;
}
