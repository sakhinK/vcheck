import { redirect, error, fail } from '@sveltejs/kit';
import {
  getApplication,
  applyTransition,
  resubmitApplication,
  getAuditTrail,
  getApplicationDocuments,
  listAdvisors
} from '$lib/server/business/applications.js';
import { getStudentForUser } from '$lib/server/business/registry.js';
import { getNameEdits } from '$lib/server/business/version.js';
import { listVersionDocuments } from '$lib/server/business/documents.js';
import { attachApplicationDocument } from '$lib/server/business/documents.js';
import { availableActions, STATUS_LABELS, PUBLIC_MILESTONES, milestoneIndex } from '$lib/server/business/workflow.js';
import { ROLES } from '$lib/server/auth/index.js';
import { isPast, daysFromToday, formatDate } from '$lib/server/business/dates.js';

async function loadApp(user, id) {
  const app = await getApplication(id);
  if (!app) throw error(404, 'Application not found.');
  if (user.role === ROLES.student) {
    const student = await getStudentForUser(user.id);
    if (!student || student.id !== app.student_id) throw error(403, 'You cannot access this application.');
  } else if (user.role === ROLES.faculty) {
    if (app.faculty !== 'Faculty of Engineering') throw error(403, 'You cannot access this application.');
  } else if (user.role === ROLES.advisor) {
    if (app.assigned_advisor_id !== user.id) throw error(403, 'This application is not assigned to you.');
  }
  return app;
}

export async function load({ locals, params }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');
  const app = await loadApp(user, params.id);
  const isApplicant = user.role === ROLES.student;

  const audit = await getAuditTrail(app.id, isApplicant);
  const docs = await getApplicationDocuments(app.id);
  const versionDocs = await listVersionDocuments(app.data_version_id);
  const nameEdits = await getNameEdits(app.data_version_id);
  const actions = availableActions(app.status, user.role);
  const advisors =
    user.role === ROLES.faculty || user.role === ROLES.iad ? await listAdvisors() : [];

  const summary = {
    daysRemaining: daysFromToday(app.visa_last_allowed_date),
    passportExpiry: formatDate(app.passport_expiry_date),
    insuranceEnd: formatDate(app.insurance_end_date),
    passportExpired: isPast(app.passport_expiry_date),
    insuranceExpired: isPast(app.insurance_end_date)
  };

  return {
    user, app, audit, docs, versionDocs, nameEdits, actions, advisors, summary,
    isApplicant, statusLabels: STATUS_LABELS,
    milestones: PUBLIC_MILESTONES, currentMilestone: milestoneIndex(app.status)
  };
}

export const actions = {
  transition: async ({ request, locals, params }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const app = await loadApp(user, params.id);
    const form = await request.formData();
    const to = form.get('to')?.toString();
    const comment = form.get('comment')?.toString();
    const advisorId = Number(form.get('advisorId') || 0) || null;
    try {
      await applyTransition({ applicationId: app.id, to, actor: user, comment, advisorId });
      return { ok: true };
    } catch (err) {
      return fail(400, { error: err.message });
    }
  },

  resubmit: async ({ locals, params }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const app = await loadApp(user, params.id);
    try {
      await resubmitApplication(app.id, user);
      return { ok: true };
    } catch (err) {
      return fail(400, { error: err.message });
    }
  },

  uploadSigned: async ({ request, locals, params }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const app = await loadApp(user, params.id);
    const form = await request.formData();
    const docType = form.get('docType')?.toString();
    const file = form.get('file');
    if (!docType || !file || typeof file === 'string') return fail(400, { error: 'Choose a file to upload.' });
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      await attachApplicationDocument({
        applicationId: app.id,
        docType,
        buffer,
        originalName: file.name,
        mime: file.type || 'application/pdf',
        uploadedBy: user.id
      });
      return { ok: true };
    } catch (err) {
      return fail(400, { error: err.message });
    }
  }
};
