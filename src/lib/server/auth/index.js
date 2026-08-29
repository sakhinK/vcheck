import pool from '$lib/server/db/index.js';

export const ROLES = {
  student: 'international_student',
  faculty: 'faculty_officer',
  advisor: 'advisor',
  iad: 'iad_officer',
  director: 'iad_director'
};

export const ROLE_LABELS = {
  international_student: 'International Student',
  faculty_officer: 'Faculty Officer',
  advisor: 'Advisor',
  iad_officer: 'IAD Officer',
  iad_director: 'IAD Director'
};

/** Whether the user holds one of the given roles. */
export function hasRole(user, ...roles) {
  return Boolean(user && roles.includes(user.role));
}

/** Link the student registry record whose email matches this login, if any.
 *  Idempotent: only sets user_id when it is currently unlinked or already this user. */
export async function linkStudentByEmail(userId, email) {
  const normalized = email.trim().toLowerCase();
  const [res] = await pool.query(
    'UPDATE students SET user_id = ? WHERE email = ? AND (user_id IS NULL OR user_id = ?)',
    [userId, normalized, userId]
  );
  return res.affectedRows > 0;
}

/**
 * Mock KKU-SSO: resolve (or create) a user by institutional email, then link
 * a registered student record by matching email on first login.
 * Returns { user, linked }.
 */
export async function ssoLogin(email, name) {
  const normalized = email.trim().toLowerCase();
  let [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [normalized]);
  let user = rows[0];

  if (!user) {
    const [res] = await pool.query(
      "INSERT INTO users (email, name, role) VALUES (?, ?, 'international_student')",
      [normalized, name || normalized.split('@')[0]]
    );
    [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [res.insertId]);
    user = rows[0];
  }

  // One-time link: attach this login to the student registry record whose
  // email matches, if that record has not been linked yet.
  const linked = await linkStudentByEmail(user.id, normalized);

  return { user, linked };
}

/** List seeded dev users for the dev-login screen (role switching). */
export async function listDevUsers() {
  const [rows] = await pool.query(
    'SELECT id, email, name, role FROM users WHERE is_dev = 1 ORDER BY role, email'
  );
  return rows;
}

export async function getDevUser(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND is_dev = 1', [id]);
  return rows[0] || null;
}
