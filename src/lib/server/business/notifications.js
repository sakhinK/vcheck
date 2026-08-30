import pool from '$lib/server/db/index.js';

const REVIEWER_ROLES = ['faculty_officer', 'iad_officer', 'iad_director'];

/**
 * Notify every faculty officer / IAD officer / IAD director that an applicant
 * submitted an application whose name was edited by the applicant (does not
 * match the MRZ value). Runs on the caller's connection so it can participate
 * in the surrounding transaction.
 */
export async function notifyNameEdited(db, { applicationId, applicationNo, studentName }) {
  const [reviewers] = await db.query('SELECT id FROM users WHERE role IN (?)', [REVIEWER_ROLES]);
  if (!reviewers.length) return;

  const values = reviewers.map((u) => [
    u.id,
    'name_edited',
    'Applicant edited their name',
    `${studentName} submitted ${applicationNo} with a name that does not match the passport MRZ.`,
    `/applications/${applicationId}`
  ]);

  await db.query(
    'INSERT INTO notifications (user_id, type, title, message, link) VALUES ?',
    [values]
  );
}

export async function listNotifications(userId, { limit = 25 } = {}) {
  const [rows] = await pool.query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
  return rows;
}

export async function markNotificationsRead(userId) {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [userId]);
}
