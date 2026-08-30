import { redirect } from '@sveltejs/kit';
import { getStudentForUser } from '$lib/server/business/registry.js';
import { listVersions, deleteVersion } from '$lib/server/business/version.js';

export async function load({ locals }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');
  if (user.role !== 'international_student') throw redirect(303, '/dashboard');
  const student = await getStudentForUser(user.id);
  const versions = student ? await listVersions(student.id) : [];
  return { user, student, versions };
}

export const actions = {
  deleteVersion: async ({ request, locals }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    if (user.role !== 'international_student') throw redirect(303, '/dashboard');
    const student = await getStudentForUser(user.id);
    if (!student) return { error: 'No student record is linked to your account.' };

    const form = await request.formData();
    const versionId = Number(form.get('versionId'));
    const versions = await listVersions(student.id);
    const version = versions.find((v) => v.id === versionId);
    if (!version) return { error: 'Data version not found.' };

    try {
      await deleteVersion(versionId);
    } catch (err) {
      return { error: err.message };
    }
    throw redirect(303, '/profile');
  }
};
