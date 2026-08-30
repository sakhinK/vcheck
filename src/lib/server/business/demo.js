import pool from '$lib/server/db/index.js';

/**
 * Reset the demo simulation back to a clean slate (dev-only). Keeps users and
 * the seeded student registry row, but clears every workflow artifact and
 * unlinks the student so the first-login link happens again.
 *
 * Delete order matters: applications reference data_versions (no ON DELETE),
 * so applications must go first; deleting data_versions then cascades to
 * documents and name_edits.
 */
export async function resetDemoData() {
  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM application_audit');
  await pool.query('DELETE FROM application_documents');
  await pool.query('DELETE FROM applications');
  await pool.query('DELETE FROM name_edits');
  await pool.query('DELETE FROM documents');
  await pool.query('DELETE FROM data_versions');
  await pool.query('UPDATE students SET user_id = NULL');
}
