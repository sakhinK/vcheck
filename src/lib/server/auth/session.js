import crypto from 'node:crypto';
import pool from '$lib/server/db/index.js';

export const SESSION_COOKIE = 'kkufa_session';

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Create a DB-backed session; returns the opaque token (never stored in full). */
export async function createSession(userId, ttlDays = 14) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [tokenHash, userId, expiresAt]
  );
  return { token, expiresAt };
}

/** Resolve the current user from the session cookie, or null. */
export async function getUserFromCookies(cookies) {
  const token = cookies.get(SESSION_COOKIE);
  if (!token) return null;
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, u.is_dev, s.id AS session_id, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [sha256(token)]
  );
  if (!rows[0]) return null;
  return rows[0];
}

export function setSessionCookie(cookies, token, expiresAt) {
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    // Local Docker dev runs over HTTP; set secure via env in production.
    secure: process.env.NODE_ENV === 'production' && process.env.ORIGIN?.startsWith('https://'),
    expires: expiresAt
  });
}

export async function destroySession(cookies) {
  const token = cookies.get(SESSION_COOKIE);
  if (token) {
    await pool.query('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
