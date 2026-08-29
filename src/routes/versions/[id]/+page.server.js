import { redirect, error, fail } from '@sveltejs/kit';
import { getStudent, canAccessStudent } from '$lib/server/business/registry.js';
import {
  getVersion,
  applyScanToVersion,
  certifyName,
  officerEditName,
  getNameEdits,
  updateVersionDraft
} from '$lib/server/business/version.js';
import {
  attachVersionDocument,
  requiredDocsChecklist,
  listVersionDocuments
} from '$lib/server/business/documents.js';
import { parseTD3 } from '$lib/server/business/mrz.js';
import { scanPassportImage } from '$lib/server/business/mrz-ocr.js';
import { ROLES } from '$lib/server/auth/index.js';

// Published specimen from ICAO 9303 — the dev "scan specimen" action runs it
// through the full server-side scan/verify path so the flow works without an
// OCR model committed yet.
const SPECIMEN = {
  line1: 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  line2: 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'
};

async function loadVersion(user, id) {
  const version = await getVersion(id);
  if (!version) throw error(404, 'Data version not found.');
  const student = await getStudent(version.student_id);
  if (!canAccessStudent(user, student)) throw error(403, 'You cannot access this data version.');
  return { version, student };
}

export async function load({ locals, params }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');
  const { version, student } = await loadVersion(user, params.id);
  const checklist = await requiredDocsChecklist(version.id);
  const documents = await listVersionDocuments(version.id);
  const nameEdits = await getNameEdits(version.id);
  const canEditDraft = version.status === 'draft';
  const isOfficer = [ROLES.faculty, ROLES.iad].includes(user.role);
  return {
    user, version, student, checklist, documents, nameEdits, canEditDraft,
    isOfficer, devMode: process.env.DEV_MODE === 'true'
  };
}

export const actions = {
  scanPassport: async ({ request, locals, params }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const { version } = await loadVersion(user, params.id);
    if (version.status !== 'draft') return fail(400, { scanError: 'This version is locked.' });

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return fail(400, { scanError: 'Please upload a passport data page (image or PDF).' });
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const mrz = await scanPassportImage(buffer, {
        filename: file.name || 'passport.pdf',
        mimeType: file.type || 'application/octet-stream'
      });
      await applyScanToVersion(version.id, mrz, user.id);
      return { scanOk: true, warnings: mrz.warnings };
    } catch (err) {
      // The uploaded file is never persisted on failure (rule 2).
      return fail(400, { scanError: err.message });
    }
  },

  scanSpecimen: async ({ locals, params }) => {
    if (process.env.DEV_MODE !== 'true') throw error(404, 'Not found');
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const { version } = await loadVersion(user, params.id);
    const mrz = parseTD3(SPECIMEN.line1, SPECIMEN.line2);
    await applyScanToVersion(version.id, mrz, user.id);
    return { scanOk: true, warnings: mrz.warnings, specimen: true };
  },

  certifyName: async ({ request, locals, params }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const { version } = await loadVersion(user, params.id);
    const form = await request.formData();
    try {
      await certifyName(version.id, {
        primary: form.get('primary')?.toString(),
        secondary: form.get('secondary')?.toString(),
        certified: form.get('certified')?.toString()
      }, user.id);
      return { nameOk: true };
    } catch (err) {
      return fail(400, { nameError: err.message });
    }
  },

  editName: async ({ request, locals, params }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const { version } = await loadVersion(user, params.id);
    if (![ROLES.faculty, ROLES.iad].includes(user.role)) return fail(403, { nameError: 'Only faculty/IAD may correct a name.' });
    const form = await request.formData();
    try {
      await officerEditName(version.id, {
        primary: form.get('primary')?.toString(),
        secondary: form.get('secondary')?.toString(),
        reason: form.get('reason')?.toString()
      }, user);
      return { nameOk: true };
    } catch (err) {
      return fail(400, { nameError: err.message });
    }
  },

  updateDraft: async ({ request, locals, params }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const { version } = await loadVersion(user, params.id);
    const form = await request.formData();
    await updateVersionDraft(version.id, {
      passport_issue_date: form.get('passport_issue_date')?.toString() || null,
      visa_start_date: form.get('visa_start_date')?.toString() || null,
      visa_entry_date: form.get('visa_entry_date')?.toString() || null,
      visa_last_allowed_date: form.get('visa_last_allowed_date')?.toString() || null,
      phone: form.get('phone')?.toString() || null,
      insurance_company: form.get('insurance_company')?.toString() || null,
      insurance_start_date: form.get('insurance_start_date')?.toString() || null,
      insurance_end_date: form.get('insurance_end_date')?.toString() || null
    });
    return { draftOk: true };
  },

  uploadDoc: async ({ request, locals, params }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const { version, student } = await loadVersion(user, params.id);
    const form = await request.formData();
    const docKey = form.get('docKey')?.toString();
    const file = form.get('file');
    if (!docKey || !file || typeof file === 'string') return fail(400, { docError: 'Choose a file to upload.' });
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      await attachVersionDocument({
        studentId: student.id,
        dataVersionId: version.id,
        docKey,
        buffer,
        originalName: file.name,
        mime: file.type || 'application/octet-stream',
        uploadedBy: user.id
      });
      return { docOk: true };
    } catch (err) {
      return fail(400, { docError: err.message });
    }
  }
};

