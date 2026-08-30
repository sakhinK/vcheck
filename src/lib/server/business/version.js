import { unlink } from 'node:fs/promises';
import pool from '$lib/server/db/index.js';
import { BusinessError } from '$lib/server/business/registry.js';
import { listVersionDocuments, absoluteUploadPath } from '$lib/server/business/documents.js';

const joinName = (parts) => (parts || []).filter(Boolean).join(' ');

export async function getVersion(id) {
  const [rows] = await pool.query(
    `SELECT v.*, s.first_name, s.last_name, s.student_code
     FROM data_versions v JOIN students s ON s.id = v.student_id
     WHERE v.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function listVersions(studentId) {
  // Include the linked application (if any) so the UI can distinguish a draft
  // that is still unused from a version currently under review / finished.
  const [rows] = await pool.query(
    `SELECT v.*,
       (SELECT a.id FROM applications a WHERE a.data_version_id = v.id ORDER BY a.id DESC LIMIT 1) AS application_id,
       (SELECT a.application_no FROM applications a WHERE a.data_version_id = v.id ORDER BY a.id DESC LIMIT 1) AS application_no,
       (SELECT a.status FROM applications a WHERE a.data_version_id = v.id ORDER BY a.id DESC LIMIT 1) AS application_status
     FROM data_versions v
     WHERE v.student_id = ?
     ORDER BY v.version_no DESC`,
    [studentId]
  );
  return rows;
}

/** The most recently created data version for a student, or null. */
export async function getLatestVersion(studentId) {
  const [rows] = await pool.query(
    'SELECT * FROM data_versions WHERE student_id = ? ORDER BY version_no DESC LIMIT 1',
    [studentId]
  );
  return rows[0] || null;
}

/** The application that uses this version (most recent), or null. */
export async function getVersionApplication(versionId) {
  const [rows] = await pool.query(
    'SELECT id, application_no, status FROM applications WHERE data_version_id = ? ORDER BY id DESC LIMIT 1',
    [versionId]
  );
  return rows[0] || null;
}

/**
 * Delete an *unused* draft data version. Refuses a version that is locked or
 * already referenced by an application. Uploaded files are removed first; the
 * DB rows cascade from the data_versions delete.
 */
export async function deleteVersion(versionId) {
  const v = await getVersion(versionId);
  if (!v) throw new BusinessError('Data version not found.', 404);
  if (v.status !== 'draft') throw new BusinessError('Only draft data versions can be deleted.');

  const [apps] = await pool.query('SELECT id FROM applications WHERE data_version_id = ? LIMIT 1', [versionId]);
  if (apps[0]) throw new BusinessError('This data version is used by an application and cannot be deleted.');

  const docs = await listVersionDocuments(versionId);
  for (const d of docs) {
    try {
      await unlink(absoluteUploadPath(d.file_path));
    } catch {
      // File already missing — nothing to clean up.
    }
  }

  await pool.query('DELETE FROM data_versions WHERE id = ?', [versionId]);
}

/** Start a new draft data version for a student. */
export async function createVersion(studentId, createdBy) {
  const [rows] = await pool.query(
    'SELECT COALESCE(MAX(version_no), 0) + 1 AS next_no FROM data_versions WHERE student_id = ?',
    [studentId]
  );
  const nextNo = rows[0].next_no;
  const [res] = await pool.query(
    'INSERT INTO data_versions (student_id, version_no, status, created_by) VALUES (?, ?, ?, ?)',
    [studentId, nextNo, 'draft', createdBy]
  );
  return res.insertId;
}

/** Update the manual fields of a draft version (visa, insurance, phone). */
export async function updateVersionDraft(versionId, fields) {
  const allowed = ['passport_issue_date', 'visa_start_date', 'visa_entry_date', 'visa_last_allowed_date', 'phone', 'insurance_company', 'insurance_start_date', 'insurance_end_date'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = ?`);
      params.push(fields[key] || null);
    }
  }
  if (sets.length === 0) return;
  params.push(versionId);
  await pool.query(
    `UPDATE data_versions SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ? AND status = 'draft'`,
    params
  );
}

/**
 * Write the MRZ-derived identity fields. This is the ONLY code path that may
 * write passport_number / date_of_birth / passport_expiry_date / nationality /
 * sex — a form can never reach it. (Rule 1: identity data comes only from a
 * server-verified scan.)
 */
export async function applyScanToVersion(versionId, mrz, createdBy, { misread = false } = {}) {
  await pool.query(
    `UPDATE data_versions SET
       passport_number = ?,
       date_of_birth = ?,
       passport_expiry_date = ?,
       nationality = ?,
       sex = ?,
       name_primary = ?,
       name_secondary = ?,
       name_source = 'mrz',
       mrz_raw_name_primary = ?,
       mrz_raw_name_secondary = ?,
       dates_incomplete = ?,
       mrz_misread = ?,
       updated_at = NOW()
     WHERE id = ? AND status = 'draft'`,
    [
      mrz.passportNumber,
      mrz.dob.iso,
      mrz.expiry.iso,
      mrz.nationality,
      mrz.sex,
      joinName(mrz.name.primary),
      joinName(mrz.name.secondary),
      joinName(mrz.name.primary),
      joinName(mrz.name.secondary),
      mrz.dob.complete && mrz.expiry.complete ? 0 : 1,
      misread ? 1 : 0,
      versionId
    ]
  );
}

/**
 * Name confirmation. Enforced server-side (rule 4): the certification tick is
 * a real business rule, not an HTML `required` attribute.
 */
export async function certifyName(versionId, { primary, secondary, certified }, userId) {
  if (certified !== true && certified !== 'true' && certified !== 'on' && certified !== '1') {
    throw new BusinessError('You must tick the confirmation box to certify that this name matches the passport exactly.');
  }
  const v = await getVersion(versionId);
  if (!v) throw new BusinessError('Data version not found.', 404);
  if (v.status !== 'draft') throw new BusinessError('This version is locked and can no longer be edited.');

  const primaryName = (primary || '').trim();
  if (!primaryName) throw new BusinessError('Primary identifier (surname) is required.');

  const sameAsMrz =
    primaryName === (v.mrz_raw_name_primary || '') &&
    (secondary || '').trim() === (v.mrz_raw_name_secondary || '');

  await pool.query(
    `UPDATE data_versions SET
       name_primary = ?, name_secondary = ?, name_source = ?,
       name_certified = 1, name_certified_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [primaryName, (secondary || '').trim(), sameAsMrz ? 'mrz' : 'applicant_edited', versionId]
  );
}

/**
 * Faculty / IAD name correction (rule 6): always records the old value, new
 * value, who, role, when and why. History is visible to reviewer AND student.
 */
export async function officerEditName(versionId, { primary, secondary, reason }, editor) {
  const v = await getVersion(versionId);
  if (!v) throw new BusinessError('Data version not found.', 404);
  if (!(primary || '').trim()) throw new BusinessError('Primary identifier (surname) is required.');
  if (!(reason || '').trim()) throw new BusinessError('A reason is required when correcting a name.');

  await pool.query(
    `INSERT INTO name_edits
       (data_version_id, old_primary, old_secondary, new_primary, new_secondary, edited_by, role, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [versionId, v.name_primary, v.name_secondary, (primary || '').trim(), (secondary || '').trim(), editor.id, editor.role, (reason || '').trim()]
  );
  await pool.query(
    `UPDATE data_versions SET name_primary = ?, name_secondary = ?, name_source = 'officer_edited', updated_at = NOW() WHERE id = ?`,
    [(primary || '').trim(), (secondary || '').trim(), versionId]
  );
}

export async function getNameEdits(versionId) {
  const [rows] = await pool.query(
    `SELECT ne.*, u.name AS editor_name, u.email AS editor_email
     FROM name_edits ne LEFT JOIN users u ON u.id = ne.edited_by
     WHERE ne.data_version_id = ?
     ORDER BY ne.created_at ASC`,
    [versionId]
  );
  return rows;
}
