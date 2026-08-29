import pool from '$lib/server/db/index.js';
import { ROLES } from '$lib/server/auth/index.js';

export class BusinessError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'BusinessError';
    this.status = status;
  }
}

/** Faculty/IAD register an international student in their care. */
export async function registerStudent({ studentCode, firstName, lastName, country, email, faculty, program, degreeLevel }, registeredBy) {
  const [res] = await pool.query(
    `INSERT INTO students (student_code, first_name, last_name, country, email, faculty, program, degree_level, registered_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [studentCode || null, firstName, lastName, country || null, email.trim().toLowerCase(), faculty || null, program || null, degreeLevel || null, registeredBy]
  );
  return res.insertId;
}

/** List students, filtered by faculty for faculty officers (IAD sees all). */
export async function listStudents(user, { query = '', faculty = '' } = {}) {
  const where = [];
  const params = [];

  if (user.role === ROLES.faculty) {
    where.push('s.faculty = ?');
    params.push(userFacultyName(user));
  }

  if (query) {
    where.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_code LIKE ? OR s.email LIKE ?)');
    const q = `%${query}%`;
    params.push(q, q, q, q);
  }
  if (faculty) {
    where.push('s.faculty = ?');
    params.push(faculty);
  }

  const sql = `SELECT s.*, u.email AS linked_user_email
    FROM students s LEFT JOIN users u ON u.id = s.user_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.created_at DESC LIMIT 200`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Faculty demo users are scoped to a placeholder faculty; real deployment
// derives this from the officer's profile. Kept as an explicit seam.
function userFacultyName() {
  return 'Faculty of Engineering';
}

export async function getStudent(id) {
  const [rows] = await pool.query(
    `SELECT s.*, u.email AS linked_user_email
     FROM students s LEFT JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    [id]
  );
  return rows[0] || null;
}

/** The student record linked to a logged-in user, if any. */
export async function getStudentForUser(userId) {
  const [rows] = await pool.query('SELECT * FROM students WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

export function canAccessStudent(user, student) {
  if (!student) return false;
  if (user.role === ROLES.student) {
    return student.user_id === user.id;
  }
  if (user.role === ROLES.faculty) {
    return student.faculty === userFacultyName();
  }
  // IAD officer / director / advisor see all.
  return true;
}
