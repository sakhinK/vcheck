import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '$lib/server/db/index.js';
import { BusinessError } from '$lib/server/business/registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../../..', 'uploads'));

const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/pdf': '.pdf'
};

/** Persist an uploaded buffer under a subdirectory and return its metadata. */
export async function saveUpload(buffer, originalName, mime, subdir) {
  const ext = EXT_BY_MIME[mime] || path.extname(originalName) || '.bin';
  const fileName = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOAD_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, buffer);
  return { filePath: path.relative(UPLOAD_ROOT, filePath), fileName: originalName, mime, size: buffer.length };
}

export const REQUIRED_DOC_KEYS = ['passport_photo', 'visa_stamp', 'entry_stamp', 'student_evidence', 'insurance'];

export async function attachVersionDocument({ studentId, dataVersionId, docKey, buffer, originalName, mime, uploadedBy }) {
  if (!REQUIRED_DOC_KEYS.includes(docKey)) throw new BusinessError(`Unknown document key: ${docKey}`);
  const meta = await saveUpload(buffer, originalName, mime, 'documents');
  await pool.query(
    'INSERT INTO documents (student_id, data_version_id, doc_key, file_path, file_name, mime, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [studentId, dataVersionId, docKey, meta.filePath, meta.fileName, meta.mime, meta.size, uploadedBy]
  );
}

export async function listVersionDocuments(dataVersionId) {
  const [rows] = await pool.query('SELECT * FROM documents WHERE data_version_id = ? ORDER BY created_at ASC', [dataVersionId]);
  return rows;
}

/** Checklist of required attachments with whether each is present. */
export async function requiredDocsChecklist(dataVersionId) {
  const docs = await listVersionDocuments(dataVersionId);
  const byKey = new Map(docs.map((d) => [d.doc_key, d]));
  return REQUIRED_DOC_KEYS.map((key) => ({ key, present: byKey.has(key), doc: byKey.get(key) || null }));
}

export async function attachApplicationDocument({ applicationId, docType, buffer, originalName, mime, uploadedBy }) {
  if (docType !== 'signed_memo' && docType !== 'signed_letter') {
    throw new BusinessError(`Unknown application document type: ${docType}`);
  }
  const meta = await saveUpload(buffer, originalName, mime, 'signed');
  await pool.query(
    'INSERT INTO application_documents (application_id, doc_type, file_path, file_name, mime, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [applicationId, docType, meta.filePath, meta.fileName, meta.mime, meta.size, uploadedBy]
  );
}

export function absoluteUploadPath(relativePath) {
  return path.join(UPLOAD_ROOT, relativePath);
}
