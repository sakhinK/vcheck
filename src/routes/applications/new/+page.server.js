import { redirect } from '@sveltejs/kit';
import { getStudentForUser } from '$lib/server/business/registry.js';
import { listVersions } from '$lib/server/business/version.js';
import { requiredDocsChecklist } from '$lib/server/business/documents.js';
import { createApplication } from '$lib/server/business/applications.js';

export async function load({ locals }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');
  if (user.role !== 'international_student') throw redirect(303, '/applications');
  const student = await getStudentForUser(user.id);
  if (!student) throw redirect(303, '/dashboard');

  const versions = await listVersions(student.id);
  const ready = [];
  for (const v of versions) {
    if (v.status !== 'draft') continue;
    const checklist = await requiredDocsChecklist(v.id);
    ready.push({
      ...v,
      nameCertified: v.name_certified === 1,
      allDocs: checklist.every((c) => c.present)
    });
  }
  return { user, student, versions: ready };
}

export const actions = {
  default: async ({ request, locals }) => {
    const user = locals.user;
    if (!user || user.role !== 'international_student') throw redirect(303, '/');
    const student = await getStudentForUser(user.id);
    if (!student) return { error: 'No student record is linked to your account.' };
    const form = await request.formData();
    const versionId = Number(form.get('versionId'));
    try {
      await createApplication({ studentId: student.id, dataVersionId: versionId, createdBy: user.id });
    } catch (err) {
      return { error: err.message };
    }
    throw redirect(303, '/applications');
  }
};
