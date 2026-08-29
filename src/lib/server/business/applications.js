import pool, { withTransaction } from '$lib/server/db/index.js';
import { BusinessError } from '$lib/server/business/registry.js';
import { ROLES } from '$lib/server/auth/index.js';
import {
  canTransition,
  transitionRequirement,
  isOnBehalf,
  isTerminal,
  milestoneIndex,
  STATUS_LABELS
} from '$lib/server/business/workflow.js';

const REQUIRED_DOC_KEYS = ['passport_photo', 'visa_stamp', 'entry_stamp', 'student_evidence', 'insurance'];

// Applicant-visible milestones plus return/cancel decisions. Internal moves
// (advisor_pending, iad_pending, iad_dir_pending) stay hidden.
function isPublicTransition(to) {
  return milestoneIndex(to) !== -1 || to === 'rejected' || to === 'terminated';
}

async function nextApplicationNo(conn) {
  const year = new Date().getFullYear();
  const [rows] = await conn.query(
    "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(application_no, '-', -1) AS UNSIGNED)), 0) + 1 AS next_no FROM applications WHERE application_no LIKE ?",
    [`VISA-${year}-%`]
  );
  return `VISA-${year}-${String(rows[0].next_no).padStart(5, '0')}`;
}

async function addAudit(conn, applicationId, round, from, to, actor, comment, visible, actedOnBehalfOf = null) {
  await conn.query(
    `INSERT INTO application_audit
       (application_id, round, from_status, to_status, actor_user_id, actor_role, comment, visible_to_applicant, acted_on_behalf_of)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [applicationId, round, from, to, actor?.id ?? null, actor?.role ?? null, comment || null, visible ? 1 : 0, actedOnBehalfOf]
  );
}

async function missingRequiredDocs(conn, dataVersionId) {
  const [rows] = await conn.query(
    'SELECT doc_key FROM documents WHERE data_version_id = ? AND doc_key IN (?)',
    [dataVersionId, REQUIRED_DOC_KEYS]
  );
  const have = new Set(rows.map((r) => r.doc_key));
  return REQUIRED_DOC_KEYS.filter((k) => !have.has(k));
}

async function lockApplication(conn, id) {
  const [rows] = await conn.query('SELECT * FROM applications WHERE id = ? FOR UPDATE', [id]);
  const app = rows[0];
  if (!app) throw new BusinessError('Application not found.', 404);
  return app;
}

async function hasSignedDocument(conn, applicationId, docType) {
  const [rows] = await conn.query(
    'SELECT id FROM application_documents WHERE application_id = ? AND doc_type = ? LIMIT 1',
    [applicationId, docType]
  );
  return rows[0] || null;
}

/**
 * Submit a brand-new application (status -> pending).
 * Rule 7 is enforced here: lock the applicant's student row with SELECT ...
 * FOR UPDATE, then check for an existing non-terminal application, so two
 * simultaneous submissions cannot both pass.
 */
export async function createApplication({ studentId, dataVersionId, createdBy }) {
  return withTransaction(async (conn) => {
    await conn.query('SELECT id FROM students WHERE id = ? FOR UPDATE', [studentId]);

    const [existing] = await conn.query(
      "SELECT application_no FROM applications WHERE student_id = ? AND status NOT IN ('completed','terminated') LIMIT 1",
      [studentId]
    );
    if (existing[0]) {
      throw new BusinessError(`You already have an open application (#${existing[0].application_no}). Only one pending application is allowed per applicant.`);
    }

    const [ver] = await conn.query('SELECT * FROM data_versions WHERE id = ? AND student_id = ?', [dataVersionId, studentId]);
    const version = ver[0];
    if (!version) throw new BusinessError('Data version does not belong to this student.', 404);
    if (version.name_certified !== 1) {
      throw new BusinessError('You must confirm the passport name before submitting.');
    }

    const missing = await missingRequiredDocs(conn, dataVersionId);
    if (missing.length > 0) {
      throw new BusinessError(`Missing required document(s): ${missing.join(', ')}.`);
    }

    const applicationNo = await nextApplicationNo(conn);
    const [res] = await conn.query(
      `INSERT INTO applications (application_no, student_id, data_version_id, status, current_round, submitted_at, created_by)
       VALUES (?, ?, ?, 'pending', 1, NOW(), ?)`,
      [applicationNo, studentId, dataVersionId, createdBy]
    );
    const applicationId = res.insertId;
    await addAudit(conn, applicationId, 1, null, 'pending', { id: createdBy, role: ROLES.student }, 'Application submitted', true);
    return { applicationId, applicationNo };
  });
}

/** Resubmit a returned application (rejected -> pending) under the same number. */
export async function resubmitApplication(applicationId, actor) {
  return withTransaction(async (conn) => {
    const app = await lockApplication(conn, applicationId);
    if (app.status !== 'rejected') throw new BusinessError('Only a returned application can be resubmitted.');
    const round = app.current_round + 1;
    await conn.query(
      "UPDATE applications SET status = 'pending', current_round = ?, submitted_at = NOW(), updated_at = NOW() WHERE id = ?",
      [round, applicationId]
    );
    await addAudit(conn, applicationId, round, 'rejected', 'pending', actor, 'Resubmitted after correction', true);
    return { applicationId, round };
  });
}

/**
 * Advance (or return/cancel) an application. Enforces the state machine,
 * signed-document requirements, and records an append-only audit row.
 */
export async function applyTransition({ applicationId, to, actor, comment, advisorId }) {
  return withTransaction(async (conn) => {
    const app = await lockApplication(conn, applicationId);
    const from = app.status;

    if (!canTransition(from, to, actor.role)) {
      throw new BusinessError(`Transition "${from} -> ${to}" is not allowed for role "${actor.role}".`);
    }

    const requirement = transitionRequirement(from, to);
    if (requirement === 'signed_memo') {
      const doc = await hasSignedDocument(conn, applicationId, 'signed_memo');
      if (!doc) throw new BusinessError('You must upload the signed memo (PDF) before sending to IAD.');
    }
    if (requirement === 'signed_letter') {
      const doc = await hasSignedDocument(conn, applicationId, 'signed_letter');
      if (!doc) throw new BusinessError('You must upload the signed letter (PDF) before completing.');
    }

    // IAD acting in place of a faculty officer is recorded, never hidden.
    const actedOnBehalf = actor.role === ROLES.iad && isOnBehalf(from, to) ? 'faculty_officer' : null;

    const round = from === 'rejected' && to === 'pending' ? app.current_round + 1 : app.current_round;

    await conn.query('UPDATE applications SET status = ?, current_round = ?, updated_at = NOW() WHERE id = ?', [to, round, applicationId]);

    if (to === 'advisor_pending' && advisorId) {
      await conn.query('UPDATE applications SET assigned_advisor_id = ? WHERE id = ?', [advisorId, applicationId]);
    }

    await addAudit(conn, applicationId, round, from, to, actor, comment, isPublicTransition(to), actedOnBehalf);

    // Terminal status locks the data version used by this application.
    if (isTerminal(to)) {
      await conn.query("UPDATE data_versions SET status = 'locked' WHERE id = ?", [app.data_version_id]);
    }

    return { applicationId, from, to };
  });
}

export async function getApplication(id) {
  const [rows] = await pool.query(
    `SELECT a.*, s.first_name, s.last_name, s.student_code, s.faculty, s.program,
            v.version_no, v.name_primary, v.name_secondary, v.name_source,
            v.mrz_raw_name_primary, v.mrz_raw_name_secondary, v.passport_number,
            v.date_of_birth, v.passport_expiry_date, v.nationality, v.sex,
            v.dates_incomplete, v.name_certified,
            v.visa_start_date, v.visa_entry_date, v.visa_last_allowed_date, v.phone,
            v.insurance_company, v.insurance_start_date, v.insurance_end_date,
            u.name AS assigned_advisor_name
     FROM applications a
     JOIN students s ON s.id = a.student_id
     JOIN data_versions v ON v.id = a.data_version_id
     LEFT JOIN users u ON u.id = a.assigned_advisor_id
     WHERE a.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function listApplications(user, { query = '', status = '' } = {}) {
  const where = [];
  const params = [];

  if (user.role === ROLES.student) {
    const student = await pool.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [user.id]).then(([r]) => r[0]);
    where.push('a.student_id = ?');
    params.push(student?.id ?? -1);
  } else if (user.role === ROLES.faculty) {
    where.push("s.faculty = 'Faculty of Engineering'");
  } else if (user.role === ROLES.advisor) {
    where.push('a.assigned_advisor_id = ?');
    params.push(user.id);
  }
  // IAD officer / director: no extra filter (see everything).

  if (status) {
    where.push('a.status = ?');
    params.push(status);
  }
  if (query) {
    where.push('(a.application_no LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)');
    const q = `%${query}%`;
    params.push(q, q, q);
  }

  const sql = `SELECT a.id, a.application_no, a.status, a.current_round, a.submitted_at, a.created_at,
              s.first_name, s.last_name, s.student_code, s.faculty
       FROM applications a JOIN students s ON s.id = a.student_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY a.created_at DESC LIMIT 200`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getAuditTrail(applicationId, applicantView = false) {
  const [rows] = await pool.query(
    `SELECT aa.*, u.name AS actor_name, u.email AS actor_email
     FROM application_audit aa LEFT JOIN users u ON u.id = aa.actor_user_id
     WHERE aa.application_id = ?
     ORDER BY aa.id ASC`,
    [applicationId]
  );
  return applicantView ? rows.filter((r) => r.visible_to_applicant === 1) : rows;
}

export async function getApplicationDocuments(applicationId) {
  const [rows] = await pool.query(
    'SELECT * FROM application_documents WHERE application_id = ? ORDER BY created_at DESC',
    [applicationId]
  );
  return rows;
}

export async function listAdvisors() {
  const [rows] = await pool.query("SELECT id, name, email FROM users WHERE role = 'advisor' ORDER BY name");
  return rows;
}

export { STATUS_LABELS };

